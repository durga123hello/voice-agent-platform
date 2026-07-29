import { Request, Response, NextFunction } from 'express';
import prisma from '../db/client';
import { hashApiKey } from '../utils/apiKey';

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
    return res.status(401).json({ error: 'Unauthorized: Missing API Key' });
  }

  // Parse prefix: format is vap_live_[prefix]_[secret]
  const parts = rawKey.split('_');
  if (parts.length < 4 || parts[0] !== 'vap' || parts[1] !== 'live') {
    return res.status(401).json({ error: 'Unauthorized: Invalid API Key format' });
  }

  const keyPrefix = `${parts[0]}_${parts[1]}_${parts[2]}`;
  const keyHash = hashApiKey(rawKey);

  try {
    const apiKeyRow = await prisma.apiKey.findFirst({
      where: {
        keyPrefix,
        keyHash,
        isActive: true
      }
    });

    if (!apiKeyRow) {
      return res.status(401).json({ error: 'Unauthorized: Invalid or inactive API Key' });
    }

    // Update last_used_at asynchronously
    prisma.apiKey.update({
      where: { id: apiKeyRow.id },
      data: { lastUsedAt: new Date() }
    }).catch(err => console.error('[API Key Auth] Failed to update lastUsedAt:', err));

    // Attach tenantId to request context
    (req as any).tenantId = apiKeyRow.tenantId;

    next();
  } catch (error) {
    console.error('[API Key Auth Error]', error);
    return res.status(500).json({ error: 'Internal server error during authentication' });
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
    return next();
  }

  // If key is present but format is wrong, reject it
  const parts = rawKey.split('_');
  if (parts.length < 4 || parts[0] !== 'vap' || parts[1] !== 'live') {
    return res.status(401).json({ error: 'Unauthorized: Invalid API Key format' });
  }

  const keyPrefix = `${parts[0]}_${parts[1]}_${parts[2]}`;
  const keyHash = hashApiKey(rawKey);

  try {
    const apiKeyRow = await prisma.apiKey.findFirst({
      where: {
        keyPrefix,
        keyHash,
        isActive: true
      }
    });

    if (!apiKeyRow) {
      return res.status(401).json({ error: 'Unauthorized: Invalid or inactive API Key' });
    }

    // Update last_used_at asynchronously
    prisma.apiKey.update({
      where: { id: apiKeyRow.id },
      data: { lastUsedAt: new Date() }
    }).catch(err => console.error('[API Key Auth] Failed to update lastUsedAt:', err));

    // Attach tenantId to request context
    (req as any).tenantId = apiKeyRow.tenantId;

    next();
  } catch (error) {
    console.error('[API Key Auth Error]', error);
    return res.status(500).json({ error: 'Internal server error during authentication' });
  }
}
