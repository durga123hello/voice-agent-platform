import { Permission } from './Permission';

export class Role {
  id: string;
  tenantId: string | null;
  name: string;
  description: string | null;
  isSystemRole: boolean;
  permissions: Permission[];
  createdAt?: Date | null;
  updatedAt?: Date | null;

  constructor(data: {
    id: string;
    tenantId: string | null;
    name: string;
    description: string | null;
    isSystemRole: boolean;
    permissions?: Permission[];
    createdAt?: Date | null;
    updatedAt?: Date | null;
  }) {
    this.id = data.id;
    this.tenantId = data.tenantId;
    this.name = data.name;
    this.description = data.description;
    this.isSystemRole = data.isSystemRole;
    this.permissions = data.permissions || [];
    this.createdAt = data.createdAt;
    this.updatedAt = data.updatedAt;
  }

  static fromPrisma(role: any): Role {
    const permissions = role.rolePermissions
      ? role.rolePermissions
          .filter((rp: any) => rp.permission)
          .map((rp: any) => Permission.fromPrisma(rp.permission))
      : [];

    return new Role({
      id: role.id,
      tenantId: role.tenantId,
      name: role.name,
      description: role.description,
      isSystemRole: role.isSystemRole,
      permissions,
      createdAt: role.createdAt,
      updatedAt: role.updatedAt,
    });
  }

  toJSON() {
    return {
      id: this.id,
      tenant_id: this.tenantId,
      name: this.name,
      description: this.description,
      is_system_role: this.isSystemRole,
      permissions: this.permissions.map((p) => p.toJSON()),
      created_at: this.createdAt,
      updated_at: this.updatedAt,
    };
  }
}
