import { Router, Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../db/client';
import { generateApiKey, hashApiKey } from '../utils/apiKey';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'jwt-secret-key-123';

/**
 * Unified authentication middleware for dashboard (JWT) or programmatic callers (API Key)
 */
async function dashboardOrApiKeyAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const xApiKeyHeader = req.headers['x-api-key'];

  let token: string | undefined;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  } else if (typeof xApiKeyHeader === 'string') {
    token = xApiKeyHeader.trim();
  }

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
        where: { keyPrefix, keyHash, isActive: true },
        include: { project: true }
      });
      if (!apiKeyRow) {
        res.status(401).json({ error: 'Unauthorized: Invalid or inactive API Key' });
        return;
      }
      (req as any).projectId = apiKeyRow.projectId;
      (req as any).tenantId = apiKeyRow.project.tenantId;
      next();
    } catch (err) {
      res.status(500).json({ error: 'Internal server error during auth' });
      return;
    }
  } else {
    // Treat as JWT session token
    try {
      const payload = jwt.verify(token, JWT_SECRET) as { tenantId: string; userId?: string; email: string };
      if (!payload || !payload.tenantId) {
        res.status(401).json({ error: 'Unauthorized: Invalid session token' });
        return;
      }
      (req as any).tenantId = payload.tenantId;
      (req as any).userId = payload.userId;
      (req as any).userEmail = payload.email;
      next();
    } catch (err) {
      res.status(401).json({ error: 'Unauthorized: Session expired or invalid' });
      return;
    }
  }
}

// Apply auth middleware to all routes in this router
router.use(dashboardOrApiKeyAuth);

/**
 * 1. Create API Key: POST /api/api-keys or POST /v1/api-keys (or POST /)
 */
async function createApiKeyHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const tenantId = (req as any).tenantId;
    let { projectId, name, type } = req.body;

    if (!tenantId) {
      res.status(400).json({ error: 'tenantId is required' });
      return;
    }

    // Resolve project ID
    if (!projectId) {
      const firstProj = await prisma.project.findFirst({ where: { tenantId } });
      if (!firstProj) {
        res.status(400).json({ error: 'No projects found. Create a project first.' });
        return;
      }
      projectId = firstProj.id;
    } else {
      const proj = await prisma.project.findFirst({ where: { id: projectId, tenantId } });
      if (!proj) {
        res.status(404).json({ error: 'Project not found or unauthorized' });
        return;
      }
    }

    const keyType = type === 'public' ? 'public' : 'private';
    const { rawKey, keyPrefix } = generateApiKey(keyType);
    const keyHash = hashApiKey(rawKey);

    const apiKeyRow = await prisma.apiKey.create({
      data: {
        projectId,
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
        projectId: apiKeyRow.projectId,
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
}

/**
 * 2. List API Keys: GET /api/api-keys or GET /v1/api-keys (or GET /)
 */
async function listApiKeysHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const tenantId = (req as any).tenantId;
    const { projectId } = req.query;

    let whereClause: any = { project: { tenantId } };
    if (projectId && typeof projectId === 'string') {
      whereClause = { projectId, project: { tenantId } };
    }

    const keys = await prisma.apiKey.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' }
    });

    const sanitizedKeys = keys.map((k: any) => ({
      id: k.id,
      projectId: k.projectId,
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
}

/**
 * 3. Rotate API Key: POST /api/api-keys/rotate
 */
router.post('/api-keys/rotate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = (req as any).tenantId;
    const { oldKeyId, name } = req.body;
    
    if (!oldKeyId) {
      res.status(400).json({ error: 'oldKeyId is required' });
      return;
    }

    // Verify old key exists and belongs to tenant
    const oldKey = await prisma.apiKey.findUnique({
      where: { id: oldKeyId },
      include: { project: true }
    });

    if (!oldKey || oldKey.project.tenantId !== tenantId) {
      res.status(404).json({ error: 'Existing API Key not found or mismatched tenant' });
      return;
    }

    const { rawKey, keyPrefix } = generateApiKey(oldKey.keyType as 'public' | 'private');
    const keyHash = hashApiKey(rawKey);

    const [newKey, revokedKey] = await prisma.$transaction([
      prisma.apiKey.create({
        data: {
          projectId: oldKey.projectId,
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
        projectId: newKey.projectId,
        keyPrefix: newKey.keyPrefix,
        name: newKey.name,
        keyType: newKey.keyType,
        isActive: newKey.isActive,
        createdAt: newKey.createdAt,
        lastUsedAt: newKey.lastUsedAt
      },
      oldKey: {
        id: revokedKey.id,
        projectId: revokedKey.projectId,
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

/**
 * 4. Revoke API Key: POST /api/api-keys/revoke or DELETE /v1/api-keys/:id
 */
async function revokeApiKey(keyId: string, tenantId: string, res: Response) {
  const existingKey = await prisma.apiKey.findUnique({
    where: { id: keyId },
    include: { project: true }
  });
  if (!existingKey || existingKey.project.tenantId !== tenantId) {
    res.status(404).json({ error: 'API Key not found or unauthorized' });
    return;
  }

  const revokedKey = await prisma.apiKey.update({
    where: { id: keyId },
    data: { isActive: false }
  });

  res.json({
    success: true,
    message: 'API Key successfully revoked.',
    key: {
      id: revokedKey.id,
      projectId: revokedKey.projectId,
      keyPrefix: revokedKey.keyPrefix,
      name: revokedKey.name,
      keyType: revokedKey.keyType,
      isActive: revokedKey.isActive,
      createdAt: revokedKey.createdAt,
      lastUsedAt: revokedKey.lastUsedAt
    }
  });
}

router.post('/api-keys/revoke', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = (req as any).tenantId;
    const { keyId } = req.body;
    if (!keyId) {
      res.status(400).json({ error: 'keyId is required' });
      return;
    }
    await revokeApiKey(keyId, tenantId, res);
  } catch (error) {
    next(error);
  }
});

// Mount path variants for `/api-keys` and standard `/v1/api-keys`
router.post('/api-keys', createApiKeyHandler);
router.get('/api-keys', listApiKeysHandler);
router.delete('/api-keys/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = (req as any).tenantId;
    await revokeApiKey(req.params.id, tenantId, res);
  } catch (error) {
    next(error);
  }
});

router.post('/', createApiKeyHandler);
router.get('/', listApiKeysHandler);
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = (req as any).tenantId;
    await revokeApiKey(req.params.id, tenantId, res);
  } catch (error) {
    next(error);
  }
});

export default router;
