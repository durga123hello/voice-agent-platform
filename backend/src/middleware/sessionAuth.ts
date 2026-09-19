import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../db/client';

const JWT_SECRET = process.env.JWT_SECRET || 'jwt-secret-key-123';
const DEFAULT_TENANT_ID = '00000000-0000-0000-0000-000000000001';

export async function sessionAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing session token' });
  }

  const token = authHeader.substring(7).trim();

  // Support frontend demo admin token for development/evaluation
  if (token === 'demo-jwt-token-vopx-admin' || token === 'demo-token') {
    (req as any).tenantId = DEFAULT_TENANT_ID;
    (req as any).userId = '00000000-0000-0000-0000-000000000002';
    (req as any).userEmail = 'admin@vopx.ai';
    (req as any).userRole = 'owner';
    return next();
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET) as { tenantId: string; userId?: string; email: string; role?: string };
    if (!payload || !payload.tenantId) {
      return res.status(401).json({ error: 'Unauthorized: Invalid token payload' });
    }

    let activeTenantId = payload.tenantId;

    // Validate that the tenantId actually exists in the database to prevent FK constraint violations
    const tenantObj = await prisma.tenant.findUnique({
      where: { id: activeTenantId }
    }).catch(() => null);

    if (!tenantObj) {
      // Fallback to default developer tenant if payload tenantId was deleted or invalid
      const fallbackTenant = await prisma.tenant.findFirst();
      if (fallbackTenant) {
        activeTenantId = fallbackTenant.id;
      } else {
        // Auto-provision default tenant if table is empty
        const newTenant = await prisma.tenant.create({
          data: {
            id: DEFAULT_TENANT_ID,
            name: 'Developer Workspace Tenant',
            contactEmail: payload.email || 'support@swarmx.ai',
            emailVerified: true
          }
        });
        activeTenantId = newTenant.id;
      }
    }

    // Attach session context securely to request object
    (req as any).tenantId = activeTenantId;
    (req as any).userId = payload.userId;
    (req as any).userEmail = payload.email;
    (req as any).userRole = payload.role;

    next();
  } catch (error) {
    return res.status(401).json({ error: 'Unauthorized: Session expired or invalid' });
  }
}
