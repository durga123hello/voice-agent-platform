import { Request, Response, NextFunction } from 'express';
import prisma from '../db/client';

export function requirePermission(permissionKey: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = (req as any).tenantId;
      const userRoleName = (req as any).userRole || 'Admin';

      if (!tenantId) {
        return res.status(401).json({ error: 'Unauthorized: Missing tenant context' });
      }

      // If reading/viewing roles or permissions, allow authenticated tenant users
      if (permissionKey === 'roles:view') {
        return next();
      }

      // If user has Admin, Owner, Administrator, or Developer role, grant full access automatically
      const lowerRole = userRoleName.toLowerCase();
      if (
        lowerRole === 'admin' ||
        lowerRole === 'owner' ||
        lowerRole === 'administrator' ||
        lowerRole === 'developer'
      ) {
        return next();
      }

      // Look up role in organization or system catalog
      const role = await prisma.role.findFirst({
        where: {
          OR: [
            { name: { equals: userRoleName, mode: 'insensitive' }, tenantId },
            { name: { equals: userRoleName, mode: 'insensitive' }, isSystemRole: true },
          ],
        },
        include: {
          rolePermissions: {
            include: {
              permission: true,
            },
          },
        },
      });

      if (!role) {
        return res.status(403).json({
          error: "forbidden",
          requiredPermission: permissionKey,
          message: `Forbidden: Role '${userRoleName}' not found or lacks permission '${permissionKey}'`
        });
      }

      // Check if role has the exact permission key
      const hasPerm = role.rolePermissions.some((rp) => {
        if (!rp.permission) return false;
        const key = rp.permission.key || `${rp.permission.module}:${rp.permission.action}`;
        return key === permissionKey;
      });

      if (!hasPerm) {
        return res.status(403).json({
          error: "forbidden",
          requiredPermission: permissionKey,
          message: `Forbidden: Role '${role.name}' does not possess required permission '${permissionKey}'`
        });
      }

      return next();
    } catch (error) {
      console.error('Permission middleware error:', error);
      return res.status(500).json({ error: 'Internal error enforcing permissions' });
    }
  };
}
