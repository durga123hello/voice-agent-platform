import {
  Permission,
  Role,
  CreatePermissionPayload,
  CreateRolePayload,
  SetRolePermissionsPayload,
} from '../types/rbac';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

function getAuthHeaders(token?: string | null) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

async function ensureValidToken(currentToken: string | null): Promise<string> {
  if (currentToken && currentToken.length > 20) {
    return currentToken;
  }

  try {
    const savedSession = typeof window !== 'undefined' ? localStorage.getItem('vopx_auth_session') : null;
    let email = 'user@vopx.ai';
    if (savedSession) {
      try {
        const parsed = JSON.parse(savedSession);
        if (parsed && parsed.email) email = parsed.email;
      } catch (e) {}
    }

    const res = await fetch(`${API_BASE}/api/auth/dashboard-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });

    if (res.ok) {
      const data = await res.json();
      const freshToken = data.token;
      if (freshToken) {
        if (typeof window !== 'undefined' && savedSession) {
          try {
            const parsed = JSON.parse(savedSession);
            parsed.token = freshToken;
            localStorage.setItem('vopx_auth_session', JSON.stringify(parsed));
          } catch (e) {}
        }
        return freshToken;
      }
    }
  } catch (e) {
    console.error('Failed acquiring fresh dashboard JWT session token:', e);
  }

  return currentToken || '';
}

function getErrorMessage(errData: any, fallback: string): string {
  if (!errData) return fallback;
  if (typeof errData.error === 'string') return errData.error;
  if (typeof errData.error?.message === 'string') return errData.error.message;
  if (typeof errData.message === 'string') return errData.message;
  return fallback;
}

// 1. Fetch permissions (with auto-session recovery on 401)
export async function fetchPermissions(token: string | null): Promise<Permission[]> {
  let authToken = await ensureValidToken(token);
  let headers = getAuthHeaders(authToken);

  let res = await fetch(`${API_BASE}/api/permissions`, { headers });
  if (res.status === 401) {
    authToken = await ensureValidToken(null);
    headers = getAuthHeaders(authToken);
    res = await fetch(`${API_BASE}/api/permissions`, { headers });
  }

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(getErrorMessage(errData, 'Failed to fetch permissions'));
  }

  return await res.json();
}

// 2. Create custom permission
export async function createPermission(
  payload: CreatePermissionPayload,
  token: string | null
): Promise<Permission> {
  let authToken = await ensureValidToken(token);
  let headers = getAuthHeaders(authToken);

  let res = await fetch(`${API_BASE}/api/permissions`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });

  if (res.status === 401) {
    authToken = await ensureValidToken(null);
    headers = getAuthHeaders(authToken);
    res = await fetch(`${API_BASE}/api/permissions`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
  }

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(getErrorMessage(errData, 'Failed to create custom permission'));
  }

  return await res.json();
}

// 3. Delete custom permission
export async function deletePermission(
  id: string,
  token: string | null
): Promise<void> {
  let authToken = await ensureValidToken(token);
  let headers = getAuthHeaders(authToken);

  let res = await fetch(`${API_BASE}/api/permissions/${id}`, {
    method: 'DELETE',
    headers,
  });

  if (res.status === 401) {
    authToken = await ensureValidToken(null);
    headers = getAuthHeaders(authToken);
    res = await fetch(`${API_BASE}/api/permissions/${id}`, {
      method: 'DELETE',
      headers,
    });
  }

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(getErrorMessage(errData, 'Failed to delete permission'));
  }
}

// 4. Fetch roles (with auto-session recovery on 401)
export async function fetchRoles(token: string | null): Promise<Role[]> {
  let authToken = await ensureValidToken(token);
  let headers = getAuthHeaders(authToken);

  let res = await fetch(`${API_BASE}/api/roles`, { headers });
  if (res.status === 401) {
    authToken = await ensureValidToken(null);
    headers = getAuthHeaders(authToken);
    res = await fetch(`${API_BASE}/api/roles`, { headers });
  }

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(getErrorMessage(errData, 'Failed to fetch roles'));
  }

  return await res.json();
}

// 5. Create role
export async function createRole(
  payload: CreateRolePayload,
  token: string | null
): Promise<Role> {
  let authToken = await ensureValidToken(token);
  let headers = getAuthHeaders(authToken);

  let res = await fetch(`${API_BASE}/api/roles`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });

  if (res.status === 401) {
    authToken = await ensureValidToken(null);
    headers = getAuthHeaders(authToken);
    res = await fetch(`${API_BASE}/api/roles`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
  }

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(getErrorMessage(errData, 'Failed to create role'));
  }

  return await res.json();
}

// 6. Set role permissions ("Persist Changes")
export async function setRolePermissions(
  roleId: string,
  permissionIds: string[],
  token: string | null
): Promise<Role> {
  let authToken = await ensureValidToken(token);
  let headers = getAuthHeaders(authToken);

  let res = await fetch(`${API_BASE}/api/roles/${roleId}/permissions`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ permission_ids: permissionIds }),
  });

  if (res.status === 401) {
    authToken = await ensureValidToken(null);
    headers = getAuthHeaders(authToken);
    res = await fetch(`${API_BASE}/api/roles/${roleId}/permissions`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ permission_ids: permissionIds }),
    });
  }

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(getErrorMessage(errData, 'Failed to update role permissions'));
  }

  return await res.json();
}

// 7. Delete role
export async function deleteRole(
  id: string,
  token: string | null
): Promise<void> {
  let authToken = await ensureValidToken(token);
  let headers = getAuthHeaders(authToken);

  let res = await fetch(`${API_BASE}/api/roles/${id}`, {
    method: 'DELETE',
    headers,
  });

  if (res.status === 401) {
    authToken = await ensureValidToken(null);
    headers = getAuthHeaders(authToken);
    res = await fetch(`${API_BASE}/api/roles/${id}`, {
      method: 'DELETE',
      headers,
    });
  }

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(getErrorMessage(errData, 'Failed to delete role'));
  }
}
