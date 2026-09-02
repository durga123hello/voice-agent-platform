import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../db/client';
import { hashApiKey } from '../utils/apiKey';

const JWT_SECRET = process.env.JWT_SECRET || 'jwt-secret-key-123';

export async function apiKeyAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const xApiKeyHeader = req.headers['x-api-key'];

  let rawKey: string | undefined;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    rawKey = authHeader.substring(7).trim();
  } else if (typeof xApiKeyHeader === 'string') {
    rawKey = xApiKeyHeader.trim();
  }

  if (!rawKey) {
    res.status(401).json({ error: 'Unauthorized: Missing API Key' });
    return;
  }

  // Check if it's a JWT Session Token
  if (!rawKey.startsWith('vap_live_') && !rawKey.startsWith('sk_live_') && !rawKey.startsWith('pk_live_')) {
    try {
      const payload = jwt.verify(rawKey, JWT_SECRET) as { tenantId: string; userId?: string; email: string };
      if (payload && payload.tenantId) {
        (req as any).tenantId = payload.tenantId;
        (req as any).userId = payload.userId;
        (req as any).userEmail = payload.email;
        next();
        return;
      }
    } catch (jwtErr) {
      res.status(401).json({ error: 'Unauthorized: Invalid credentials or token expired' });
      return;
    }
  }

  // Parse API key prefix: format is [sk|pk|vap]_live_[prefix]_[secret]
  const parts = rawKey.split('_');
  if (parts.length < 4 || (parts[0] !== 'vap' && parts[0] !== 'sk' && parts[0] !== 'pk') || parts[1] !== 'live') {
    res.status(401).json({ error: 'Unauthorized: Invalid API Key format' });
    return;
  }

  const keyPrefix = `${parts[0]}_${parts[1]}_${parts[2]}`;
  const keyHash = hashApiKey(rawKey);

  try {
    const apiKeyRow = await prisma.apiKey.findFirst({
      where: {
        keyPrefix,
        keyHash,
        isActive: true
      },
      include: {
        project: true
      }
    });

    if (!apiKeyRow) {
      res.status(401).json({ error: 'Unauthorized: Invalid or inactive API Key' });
      return;
    }

    // Scope Enforcement for PUBLIC keys
    if (apiKeyRow.keyType === 'public') {
      const path = req.originalUrl || req.path;
      const isSessionCreation = req.method === 'POST' && (
        path === '/api/sessions' || 
        path === '/api/sessions/' || 
        path.startsWith('/api/sessions?') ||
        path === '/sessions' ||
        path === '/sessions/' ||
        path.startsWith('/sessions?')
      );
      if (!isSessionCreation) {
        res.status(403).json({ error: 'Forbidden: Public keys are restricted to session creation only.' });
        return;
      }
    }

    // Update last_used_at asynchronously
    prisma.apiKey.update({
      where: { id: apiKeyRow.id },
      data: { lastUsedAt: new Date() }
    }).catch((err: any) => console.error('[API Key Auth] Failed to update lastUsedAt:', err));

    // Attach projectId and tenantId to request context
    (req as any).projectId = apiKeyRow.projectId;
    (req as any).tenantId = apiKeyRow.project.tenantId;

    next();
  } catch (error) {
    console.error('[API Key Auth Error]', error);
    res.status(500).json({ error: 'Internal server error during authentication' });
    return;
  }
}

export async function apiKeyAuthOptional(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const xApiKeyHeader = req.headers['x-api-key'];

  let rawKey: string | undefined;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    rawKey = authHeader.substring(7).trim();
  } else if (typeof xApiKeyHeader === 'string') {
    rawKey = xApiKeyHeader.trim();
  }

  // If no key is provided at all, let it slide to the next middleware (fallback to DEFAULT_TENANT_ID)
  if (!rawKey) {
    (req as any).tenantId = null;
    (req as any).projectId = null;
    next();
    return;
  }

  // Check if it's a JWT Session Token
  if (!rawKey.startsWith('vap_live_') && !rawKey.startsWith('sk_live_') && !rawKey.startsWith('pk_live_')) {
    try {
      const payload = jwt.verify(rawKey, JWT_SECRET) as { tenantId: string; userId?: string; email: string };
      if (payload && payload.tenantId) {
        (req as any).tenantId = payload.tenantId;
        (req as any).userId = payload.userId;
        (req as any).userEmail = payload.email;
        next();
        return;
      }
    } catch (jwtErr) {
      res.status(401).json({ error: 'Unauthorized: Invalid token or expired session' });
      return;
    }
  }

  // Parse API key format
  const parts = rawKey.split('_');
  if (parts.length < 4 || (parts[0] !== 'vap' && parts[0] !== 'sk' && parts[0] !== 'pk') || parts[1] !== 'live') {
    res.status(401).json({ error: 'Unauthorized: Invalid API Key format' });
    return;
  }

  const keyPrefix = `${parts[0]}_${parts[1]}_${parts[2]}`;
  const keyHash = hashApiKey(rawKey);

  try {
    const apiKeyRow = await prisma.apiKey.findFirst({
      where: {
        keyPrefix,
        keyHash,
        isActive: true
      },
      include: {
        project: true
      }
    });

    if (!apiKeyRow) {
      res.status(401).json({ error: 'Unauthorized: Invalid or inactive API Key' });
      return;
    }

    // Scope Enforcement for PUBLIC keys
    if (apiKeyRow.keyType === 'public') {
      const path = req.originalUrl || req.path;
      const isSessionCreation = req.method === 'POST' && (
        path === '/api/sessions' || 
        path === '/api/sessions/' || 
        path.startsWith('/api/sessions?') ||
        path === '/sessions' ||
        path === '/sessions/' ||
        path.startsWith('/sessions?')
      );
      if (!isSessionCreation) {
        res.status(403).json({ error: 'Forbidden: Public keys are restricted to session creation only.' });
        return;
      }
    }

    // Update last_used_at asynchronously
    prisma.apiKey.update({
      where: { id: apiKeyRow.id },
      data: { lastUsedAt: new Date() }
    }).catch((err: any) => console.error('[API Key Auth] Failed to update lastUsedAt:', err));

    // Attach projectId and tenantId to request context
    (req as any).projectId = apiKeyRow.projectId;
    (req as any).tenantId = apiKeyRow.project.tenantId;

    next();
  } catch (error) {
    console.error('[API Key Auth Error]', error);
    res.status(500).json({ error: 'Internal server error during authentication' });
    return;
  }
}
