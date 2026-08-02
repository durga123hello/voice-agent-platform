import { Router, Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../db/client';
import { generateApiKey, hashApiKey } from '../utils/apiKey';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'jwt-secret-key-123';

// 1. Unified authentication middleware for dashboard (JWT) or programmatic callers (API Key)
async function dashboardOrApiKeyAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const xApiKeyHeader = req.headers['x-api-key'];

  let token: string | undefined;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  } else if (typeof xApiKeyHeader === 'string') {
    token = xApiKeyHeader.trim();
  }

  // Fallback check for testing: if it's the internal system config UI flow (using DEFAULT_TENANT_ID)
  // we can let it pass if no auth header is present and we're not in production.
  // But for key generation, we require active auth.
  if (!token) {
    res.status(401).json({ error: 'Unauthorized: Missing credentials' });
    return;
  }

  if (token.startsWith('vap_live_') || token.startsWith('sk_live_') || token.startsWith('pk_live_')) {
    // Treat as raw API Key
    const parts = token.split('_');
    if (parts.length < 4 || (parts[0] !== 'vap' && parts[0] !== 'sk' && parts[0] !== 'pk') || parts[1] !== 'live') {
      res.status(401).json({ error: 'Unauthorized: Invalid API Key format' });
      return;
    }
    const keyPrefix = `${parts[0]}_${parts[1]}_${parts[2]}`;
    const keyHash = hashApiKey(token);

    try {
      const apiKeyRow = await prisma.apiKey.findFirst({
        where: { keyPrefix, keyHash, isActive: true }
      });
      if (!apiKeyRow) {
        res.status(401).json({ error: 'Unauthorized: Invalid or inactive API Key' });
        return;
      }
      (req as any).tenantId = apiKeyRow.tenantId;
      next();
    } catch (err) {
      res.status(500).json({ error: 'Internal server error during auth' });
      return;
    }
  } else {
    // Treat as JWT session token
    try {
      const payload = jwt.verify(token, JWT_SECRET) as { tenantId: string; email: string };
      if (!payload || !payload.tenantId) {
        res.status(401).json({ error: 'Unauthorized: Invalid session token' });
        return;
      }
      (req as any).tenantId = payload.tenantId;
      next();
    } catch (err) {
      res.status(401).json({ error: 'Unauthorized: Session expired or invalid' });
      return;
    }
  }
}

// Endpoint to create a tenant (Admin Helper)
router.post('/tenants', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, contactEmail } = req.body;
    if (!name) {
      res.status(400).json({ error: 'Name is required' });
      return;
    }

    const tenant = await prisma.tenant.create({
      data: {
        name,
        contactEmail
      }
    });

    res.status(201).json({ tenant });
  } catch (error) {
    next(error);
  }
});

// Apply auth middleware to all api-keys endpoints
router.use('/api-keys', dashboardOrApiKeyAuth);

// Endpoint to issue a new API key
router.post('/api-keys', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = (req as any).tenantId; // Securely resolved from auth token
    const { name, type } = req.body;

    if (!tenantId) {
      res.status(400).json({ error: 'tenantId is required' });
      return;
    }

    // Verify tenant exists
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId }
    });
    if (!tenant) {
      res.status(404).json({ error: 'Tenant not found' });
      return;
    }

    const keyType = type === 'public' ? 'public' : 'private';
    const { rawKey, keyPrefix } = generateApiKey(keyType);
    const keyHash = hashApiKey(rawKey);

    const apiKeyRow = await prisma.apiKey.create({
      data: {
        tenantId,
        keyPrefix,
        keyHash,
        name: name || null,
        keyType
      }
    });

    res.status(201).json({
      message: 'API Key generated successfully. Save this secret key as it will never be displayed again.',
      rawKey,
      key: {
        id: apiKeyRow.id,
        tenantId: apiKeyRow.tenantId,
        keyPrefix: apiKeyRow.keyPrefix,
        name: apiKeyRow.name,
        keyType: apiKeyRow.keyType,
        isActive: apiKeyRow.isActive,
        createdAt: apiKeyRow.createdAt,
        lastUsedAt: apiKeyRow.lastUsedAt
      }
    });
  } catch (error) {
    next(error);
  }
});

// Endpoint to list all keys for a tenant
router.get('/api-keys', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = (req as any).tenantId; // Securely resolved from auth token

    const keys = await prisma.apiKey.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' }
    });

    const sanitizedKeys = keys.map(k => ({
      id: k.id,
      tenantId: k.tenantId,
      keyPrefix: k.keyPrefix,
      name: k.name,
      keyType: k.keyType,
      isActive: k.isActive,
      createdAt: k.createdAt,
      lastUsedAt: k.lastUsedAt
    }));

    res.json({ keys: sanitizedKeys });
  } catch (error) {
    next(error);
  }
});

// Endpoint to rotate an API key (issues new key, revokes old one)
router.post('/api-keys/rotate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = (req as any).tenantId; // Securely resolved from auth token
    const { oldKeyId, name } = req.body;
    
    if (!oldKeyId) {
      res.status(400).json({ error: 'oldKeyId is required' });
      return;
    }

    // Verify old key exists and belongs to the tenant
    const oldKey = await prisma.apiKey.findUnique({
      where: { id: oldKeyId }
    });

    if (!oldKey || oldKey.tenantId !== tenantId) {
      res.status(404).json({ error: 'Existing API Key not found or mismatched tenant' });
      return;
    }

    const { rawKey, keyPrefix } = generateApiKey(oldKey.keyType as 'public' | 'private');
    const keyHash = hashApiKey(rawKey);

    const [newKey, revokedKey] = await prisma.$transaction([
      prisma.apiKey.create({
        data: {
          tenantId,
          keyPrefix,
          keyHash,
          name: name || oldKey.name,
          keyType: oldKey.keyType
        }
      }),
      prisma.apiKey.update({
        where: { id: oldKeyId },
        data: { isActive: false }
      })
    ]);

    res.status(200).json({
      message: 'API Key rotated successfully. Save this secret key as it will never be displayed again.',
      rawKey,
      newKey: {
        id: newKey.id,
        tenantId: newKey.tenantId,
        keyPrefix: newKey.keyPrefix,
        name: newKey.name,
        keyType: newKey.keyType,
        isActive: newKey.isActive,
        createdAt: newKey.createdAt,
        lastUsedAt: newKey.lastUsedAt
      },
      oldKey: {
        id: revokedKey.id,
        tenantId: revokedKey.tenantId,
        keyPrefix: revokedKey.keyPrefix,
        name: revokedKey.name,
        keyType: revokedKey.keyType,
        isActive: revokedKey.isActive,
        createdAt: revokedKey.createdAt,
        lastUsedAt: revokedKey.lastUsedAt
      }
    });
  } catch (error) {
    next(error);
  }
});

// Endpoint to revoke a specific API key
router.post('/api-keys/revoke', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = (req as any).tenantId; // Securely resolved from auth token
    const { keyId } = req.body;
    if (!keyId) {
      res.status(400).json({ error: 'keyId is required' });
      return;
    }

    // Verify key belongs to the authenticated tenant
    const existingKey = await prisma.apiKey.findUnique({
      where: { id: keyId }
    });
    if (!existingKey || existingKey.tenantId !== tenantId) {
      res.status(404).json({ error: 'API Key not found or unauthorized' });
      return;
    }

    const revokedKey = await prisma.apiKey.update({
      where: { id: keyId },
      data: { isActive: false }
    });

    res.json({
      success: true,
      key: {
        id: revokedKey.id,
        tenantId: revokedKey.tenantId,
        keyPrefix: revokedKey.keyPrefix,
        name: revokedKey.name,
        keyType: revokedKey.keyType,
        isActive: revokedKey.isActive,
        createdAt: revokedKey.createdAt,
        lastUsedAt: revokedKey.lastUsedAt
      }
    });
  } catch (error) {
    next(error);
  }
});

export default router;
