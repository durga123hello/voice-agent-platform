import { Router, Request, Response } from 'express';
import { sessionAuth } from '../middleware/sessionAuth';
import { requirePermission } from '../middleware/requirePermission';
import { RoleService } from '../services/RoleService';

const router = Router();
router.use(sessionAuth);

const roleService = new RoleService();

// 1. GET /api/roles — List system roles + tenant custom roles
router.get('/', requirePermission('roles:view'), async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    const roles = await roleService.listRoles(tenantId);
    return res.json(roles.map((r) => r.toJSON()));
  } catch (error: any) {
    console.error('Error fetching roles:', error);
    const status = error.status || 500;
    return res.status(status).json({ error: error.message || 'Failed to fetch roles' });
  }
});

// 2. GET /api/roles/:id — Get role by ID
router.get('/:id', requirePermission('roles:view'), async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    const { id } = req.params;
    const role = await roleService.getRole(tenantId, id);

    if (!role) {
      return res.status(404).json({ error: 'Role not found' });
    }

    return res.json(role.toJSON());
  } catch (error: any) {
    console.error('Error fetching role details:', error);
    const status = error.status || 500;
    return res.status(status).json({ error: error.message || 'Failed to fetch role details' });
  }
});

// 3. POST /api/roles — Create a custom role for tenant (initially zero permissions or optional initial set)
router.post('/', requirePermission('roles:create'), async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    const { name, description, permission_ids } = req.body || {};

    const role = await roleService.createRole(tenantId, { name, description });

    // If initial permission_ids provided, set them
    if (Array.isArray(permission_ids) && permission_ids.length > 0) {
      const updated = await roleService.setRolePermissions(tenantId, role.id, permission_ids);
      return res.status(201).json(updated.toJSON());
    }

    return res.status(201).json(role.toJSON());
  } catch (error: any) {
    console.error('Error creating role:', error);
    const status = error.status || 500;
    return res.status(status).json({ error: error.message || 'Failed to create role' });
  }
});

// 4. PUT /api/roles/:id/permissions — Replaces full set of permissions for a role in one call ("Persist Changes")
router.put('/:id/permissions', requirePermission('roles:edit'), async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    const { id } = req.params;
    const { permission_ids } = req.body || {};

    if (!Array.isArray(permission_ids)) {
      return res.status(400).json({ error: 'permission_ids must be an array of permission IDs' });
    }

    const updatedRole = await roleService.setRolePermissions(tenantId, id, permission_ids);
    return res.json(updatedRole.toJSON());
  } catch (error: any) {
    console.error('Error updating role permissions:', error);
    const status = error.status || 500;
    return res.status(status).json({ error: error.message || 'Failed to update role permissions' });
  }
});

// 5. PUT /api/roles/:id — Update role name/description or permissions
router.put('/:id', requirePermission('roles:edit'), async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    const { id } = req.params;
    const { permission_ids } = req.body || {};

    let role = await roleService.getRole(tenantId, id);
    if (!role) {
      return res.status(404).json({ error: 'Role not found' });
    }

    if (Array.isArray(permission_ids)) {
      role = await roleService.setRolePermissions(tenantId, id, permission_ids);
    }

    return res.json(role.toJSON());
  } catch (error: any) {
    console.error('Error updating role:', error);
    const status = error.status || 500;
    return res.status(status).json({ error: error.message || 'Failed to update role' });
  }
});

// 6. DELETE /api/roles/:id — Delete custom role
router.delete('/:id', requirePermission('roles:delete'), async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    const { id } = req.params;

    await roleService.deleteRole(tenantId, id);
    return res.json({ message: 'Role deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting role:', error);
    const status = error.status || 500;
    return res.status(status).json({ error: error.message || 'Failed to delete role' });
  }
});

export default router;
