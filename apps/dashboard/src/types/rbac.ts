export interface Permission {
  id: string;
  key: string;
  module: string;
  action: string;
  label: string;
  is_system_permission: boolean;
  tenant_id: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface Role {
  id: string;
  name: string;
  description: string | null;
  is_system_role: boolean;
  tenant_id: string | null;
  created_at?: string;
  updated_at?: string;
  permissions: Permission[];
}

export interface CreateRolePayload {
  name: string;
  description?: string;
}

export interface SetRolePermissionsPayload {
  permission_ids: string[];
}

export interface CreatePermissionPayload {
  module: string;
  action: string;
  label: string;
}
