export class Permission {
  id: string;
  tenantId: string | null;
  module: string;
  action: string;
  label: string;
  isSystemPermission: boolean;
  createdAt?: Date | null;
  updatedAt?: Date | null;

  constructor(data: {
    id: string;
    tenantId: string | null;
    module: string;
    action: string;
    label: string;
    isSystemPermission: boolean;
    createdAt?: Date | null;
    updatedAt?: Date | null;
  }) {
    this.id = data.id;
    this.tenantId = data.tenantId;
    this.module = data.module;
    this.action = data.action;
    this.label = data.label;
    this.isSystemPermission = data.isSystemPermission;
    this.createdAt = data.createdAt;
    this.updatedAt = data.updatedAt;
  }

  get key(): string {
    return `${this.module}:${this.action}`;
  }

  static fromPrisma(p: any): Permission {
    return new Permission({
      id: p.id,
      tenantId: p.tenantId,
      module: p.module,
      action: p.action,
      label: p.label,
      isSystemPermission: p.isSystemPermission,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    });
  }

  toJSON() {
    return {
      id: this.id,
      tenant_id: this.tenantId,
      key: this.key,
      module: this.module,
      action: this.action,
      label: this.label,
      is_system_permission: this.isSystemPermission,
      created_at: this.createdAt,
      updated_at: this.updatedAt,
    };
  }
}
