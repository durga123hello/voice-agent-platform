import prisma from '../db/client';
import { Permission } from '../models/Permission';

export class PermissionService {
  /**
   * List all system permissions + tenant's custom permissions
   */
  async listPermissions(tenantId: string): Promise<Permission[]> {
    const raw = await prisma.permission.findMany({
      where: {
        OR: [
          { isSystemPermission: true },
          { tenantId: null },
          { tenantId: tenantId },
        ],
      },
      orderBy: [
        { module: 'asc' },
        { action: 'asc' },
      ],
    });

    return raw.map(Permission.fromPrisma);
  }

  /**
   * Create a custom permission for tenant
   */
  async createCustomPermission(
    tenantId: string,
    data: { module: string; action: string; label: string }
  ): Promise<Permission> {
    const { module, action, label } = data;

    if (!module || typeof module !== 'string' || !module.trim()) {
      throw { status: 400, message: 'Permission module is required' };
    }
    if (!action || typeof action !== 'string' || !action.trim()) {
      throw { status: 400, message: 'Permission action is required' };
    }
    if (!label || typeof label !== 'string' || !label.trim()) {
      throw { status: 400, message: 'Permission label is required' };
    }

    const cleanModule = module.trim().toLowerCase().replace(/[^a-z0-9_]+/g, '_');
    const cleanAction = action.trim().toLowerCase().replace(/[^a-z0-9_]+/g, '_');
    const key = `${cleanModule}:${cleanAction}`;

    // Check uniqueness within tenant and system permissions
    const existing = await prisma.permission.findFirst({
      where: {
        key,
        OR: [
          { tenantId: tenantId },
          { tenantId: null },
          { isSystemPermission: true },
        ],
      },
    });

    if (existing) {
      throw {
        status: 409,
        message: `A permission with key '${key}' already exists for this organization or system catalog.`,
      };
    }

    const created = await prisma.permission.create({
      data: {
        tenantId,
        key,
        module: cleanModule,
        action: cleanAction,
        label: label.trim(),
        isSystemPermission: false,
      },
    });

    return Permission.fromPrisma(created);
  }

  /**
   * Delete a custom permission
   */
  async deleteCustomPermission(tenantId: string, permissionId: string): Promise<void> {
    const permission = await prisma.permission.findUnique({
      where: { id: permissionId },
      include: {
        rolePermissions: {
          include: {
            role: true,
          },
        },
      },
    });

    if (!permission) {
      throw { status: 404, message: 'Permission not found' };
    }

    if (permission.isSystemPermission || permission.tenantId === null) {
      throw { status: 403, message: 'System permissions are built-in and cannot be deleted.' };
    }

    if (permission.tenantId !== tenantId) {
      throw { status: 403, message: 'Unauthorized access to permission' };
    }

    const attachedRoleCount = permission.rolePermissions.length;
    if (attachedRoleCount > 0) {
      const roleNames = permission.rolePermissions.map((rp) => rp.role.name).join(', ');
      throw {
        status: 409,
        message: `Cannot delete permission '${permission.label}' because it is assigned to ${attachedRoleCount} role(s) (${roleNames}). Please remove it from those roles first.`,
        role_count: attachedRoleCount,
        role_names: permission.rolePermissions.map((rp) => rp.role.name),
      };
    }

    await prisma.permission.delete({
      where: { id: permissionId },
    });
  }
}
