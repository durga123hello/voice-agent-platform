import prisma from '../db/client';
import { Role } from '../models/Role';

export class RoleService {
  /**
   * All roles for a tenant, each with permissions attached
   */
  async listRoles(tenantId: string): Promise<Role[]> {
    const raw = await prisma.role.findMany({
      where: {
        OR: [
          { isSystemRole: true },
          { tenantId: null },
          { tenantId: tenantId },
        ],
      },
      include: {
        rolePermissions: {
          include: {
            permission: true,
          },
        },
      },
      orderBy: [
        { isSystemRole: 'desc' },
        { name: 'asc' },
      ],
    });

    return raw.map(Role.fromPrisma);
  }

  /**
   * Get role details by ID
   */
  async getRole(tenantId: string, roleId: string): Promise<Role | null> {
    const raw = await prisma.role.findFirst({
      where: {
        id: roleId,
        OR: [
          { isSystemRole: true },
          { tenantId: null },
          { tenantId: tenantId },
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

    return raw ? Role.fromPrisma(raw) : null;
  }

  /**
   * Create a new custom role with initial zero permissions
   */
  async createRole(
    tenantId: string,
    data: { name: string; description?: string }
  ): Promise<Role> {
    const { name, description } = data;

    if (!name || typeof name !== 'string' || !name.trim()) {
      throw { status: 400, message: 'Role name is required' };
    }

    const trimmedName = name.trim();

    const existing = await prisma.role.findFirst({
      where: {
        tenantId,
        name: trimmedName,
      },
    });

    if (existing) {
      throw {
        status: 409,
        message: `A role named '${trimmedName}' already exists in your organization.`,
      };
    }

    const created = await prisma.role.create({
      data: {
        tenantId,
        name: trimmedName,
        description: description && typeof description === 'string' ? description.trim() : null,
        isSystemRole: false,
      },
      include: {
        rolePermissions: {
          include: {
            permission: true,
          },
        },
      },
    });

    return Role.fromPrisma(created);
  }

  /**
   * Replace the full set of permissions for a role in a single transaction
   */
  async setRolePermissions(
    tenantId: string,
    roleId: string,
    permissionIds: string[]
  ): Promise<Role> {
    const role = await prisma.role.findFirst({
      where: {
        id: roleId,
        OR: [
          { isSystemRole: true },
          { tenantId: null },
          { tenantId: tenantId },
        ],
      },
    });

    if (!role) {
      throw { status: 404, message: 'Role not found' };
    }

    // Verify all permissionIds exist and belong to tenant or are system permissions
    const validPermissionIds = Array.isArray(permissionIds)
      ? permissionIds.filter((pId) => typeof pId === 'string' && pId.trim().length > 0)
      : [];

    const foundPerms = await prisma.permission.findMany({
      where: {
        id: { in: validPermissionIds },
        OR: [
          { isSystemPermission: true },
          { tenantId: null },
          { tenantId: tenantId },
        ],
      },
      select: { id: true },
    });

    const validIdsSet = new Set(foundPerms.map((p) => p.id));
    const targetIds = Array.from(validIdsSet);

    // Execute diff replacement in a single Prisma transaction
    await prisma.$transaction(async (tx) => {
      // 1. Delete all existing permission links for this role
      await tx.rolePermission.deleteMany({
        where: { roleId },
      });

      // 2. Insert new permission links
      if (targetIds.length > 0) {
        await tx.rolePermission.createMany({
          data: targetIds.map((pId) => ({
            roleId,
            permissionId: pId,
          })),
          skipDuplicates: true,
        });
      }

      // 3. Touch updatedAt timestamp on the role
      await tx.role.update({
        where: { id: roleId },
        data: { updatedAt: new Date() },
      });
    });

    const updated = await prisma.role.findUnique({
      where: { id: roleId },
      include: {
        rolePermissions: {
          include: {
            permission: true,
          },
        },
      },
    });

    return Role.fromPrisma(updated);
  }

  /**
   * Delete custom role (blocks if isSystemRole or if any user currently has this role)
   */
  async deleteRole(tenantId: string, roleId: string): Promise<void> {
    const role = await prisma.role.findFirst({
      where: {
        id: roleId,
        OR: [
          { isSystemRole: true },
          { tenantId: null },
          { tenantId: tenantId },
        ],
      },
    });

    if (!role) {
      throw { status: 404, message: 'Role not found' };
    }

    if (role.isSystemRole || role.tenantId === null) {
      throw { status: 403, message: 'System roles are built-in and cannot be deleted.' };
    }

    if (role.tenantId !== tenantId) {
      throw { status: 403, message: 'Unauthorized access to role' };
    }

    // Check if any users currently have this role
    const usersWithRole = await prisma.user.count({
      where: {
        tenantId,
        role: { equals: role.name, mode: 'insensitive' },
      },
    });

    if (usersWithRole > 0) {
      throw {
        status: 409,
        message: `Cannot delete role '${role.name}' because ${usersWithRole} user account(s) currently hold this role. Reassign those users first.`,
      };
    }

    await prisma.role.delete({
      where: { id: roleId },
    });
  }
}
