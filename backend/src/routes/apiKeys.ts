import { Router, Request, Response, NextFunction } from 'express';
import prisma from '../db/client';
import { generateApiKey, hashApiKey } from '../utils/apiKey';

const router = Router();

// Endpoint to create a tenant (Admin Helper)
router.post('/tenants', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, contactEmail } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const tenant = await prisma.tenant.create({
      data: {
        name,
        contactEmail
      }
    });

    return res.status(201).json({ tenant });
  } catch (error) {
    next(error);
  }
});

// Endpoint to issue a new API key
router.post('/api-keys', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { tenantId, name } = req.body;
    if (!tenantId) {
      return res.status(400).json({ error: 'tenantId is required' });
    }

    // Verify tenant exists
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId }
    });
    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    const { rawKey, keyPrefix } = generateApiKey();
    const keyHash = hashApiKey(rawKey);

    const apiKeyRow = await prisma.apiKey.create({
      data: {
        tenantId,
        keyPrefix,
        keyHash,
        name: name || null
      }
    });

    return res.status(201).json({
      message: 'API Key generated successfully. Save this secret key as it will never be displayed again.',
      rawKey,
      key: {
        id: apiKeyRow.id,
        tenantId: apiKeyRow.tenantId,
        keyPrefix: apiKeyRow.keyPrefix,
        name: apiKeyRow.name,
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
    const tenantId = req.query.tenantId as string;
    if (!tenantId) {
      return res.status(400).json({ error: 'tenantId is required' });
    }

    const keys = await prisma.apiKey.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' }
    });

    const sanitizedKeys = keys.map(k => ({
      id: k.id,
      tenantId: k.tenantId,
      keyPrefix: k.keyPrefix,
      name: k.name,
      isActive: k.isActive,
      createdAt: k.createdAt,
      lastUsedAt: k.lastUsedAt
    }));

    return res.json({ keys: sanitizedKeys });
  } catch (error) {
    next(error);
  }
});

// Endpoint to rotate an API key (issues new key, revokes old one)
router.post('/api-keys/rotate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { tenantId, oldKeyId, name } = req.body;
    if (!tenantId || !oldKeyId) {
      return res.status(400).json({ error: 'tenantId and oldKeyId are required' });
    }

    // Verify old key exists and belongs to the tenant
    const oldKey = await prisma.apiKey.findUnique({
      where: { id: oldKeyId }
    });

    if (!oldKey || oldKey.tenantId !== tenantId) {
      return res.status(404).json({ error: 'Existing API Key not found or mismatched tenant' });
    }

    const { rawKey, keyPrefix } = generateApiKey();
    const keyHash = hashApiKey(rawKey);

    const [newKey, revokedKey] = await prisma.$transaction([
      prisma.apiKey.create({
        data: {
          tenantId,
          keyPrefix,
          keyHash,
          name: name || oldKey.name
        }
      }),
      prisma.apiKey.update({
        where: { id: oldKeyId },
        data: { isActive: false }
      })
    ]);

    return res.status(200).json({
      message: 'API Key rotated successfully. Save this secret key as it will never be displayed again.',
      rawKey,
      newKey: {
        id: newKey.id,
        tenantId: newKey.tenantId,
        keyPrefix: newKey.keyPrefix,
        name: newKey.name,
        isActive: newKey.isActive,
        createdAt: newKey.createdAt,
        lastUsedAt: newKey.lastUsedAt
      },
      oldKey: {
        id: revokedKey.id,
        tenantId: revokedKey.tenantId,
        keyPrefix: revokedKey.keyPrefix,
        name: revokedKey.name,
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
    const { keyId } = req.body;
    if (!keyId) {
      return res.status(400).json({ error: 'keyId is required' });
    }

    const revokedKey = await prisma.apiKey.update({
      where: { id: keyId },
      data: { isActive: false }
    });

    return res.json({
      success: true,
      key: {
        id: revokedKey.id,
        tenantId: revokedKey.tenantId,
        keyPrefix: revokedKey.keyPrefix,
        name: revokedKey.name,
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
