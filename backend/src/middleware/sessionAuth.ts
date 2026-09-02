import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'jwt-secret-key-123';

export function sessionAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing session token' });
  }

  const token = authHeader.substring(7).trim();
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { tenantId: string; userId?: string; email: string };
    if (!payload || !payload.tenantId) {
      return res.status(401).json({ error: 'Unauthorized: Invalid token payload' });
    }

    // Attach tenantId and userId to request context
    (req as any).tenantId = payload.tenantId;
    (req as any).userId = payload.userId;
    (req as any).userEmail = payload.email;

    next();
  } catch (error) {
    return res.status(401).json({ error: 'Unauthorized: Session expired or invalid' });
  }
}
