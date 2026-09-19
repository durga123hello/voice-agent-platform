import { Router, Request, Response } from 'express';
import { sessionAuth } from '../middleware/sessionAuth';
import { requirePermission } from '../middleware/requirePermission';
import { PermissionService } from '../services/PermissionService';

const router = Router();
router.use(sessionAuth);

const permissionService = new PermissionService();

// 1. GET /api/permissions — List system permissions + tenant custom permissions
router.get('/', requirePermission('roles:view'), async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    const permissions = await permissionService.listPermissions(tenantId);
    return res.json(permissions.map((p) => p.toJSON()));
  } catch (error: any) {
    console.error('Error fetching permissions:', error);
    const status = error.status || 500;
    return res.status(status).json({ error: error.message || 'Failed to fetch permissions' });
  }
});

// 2. POST /api/permissions — Create a custom permission for tenant
router.post('/', requirePermission('roles:edit'), async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    const { module, action, label } = req.body || {};

    const created = await permissionService.createCustomPermission(tenantId, {
      module,
      action,
      label,
    });

    return res.status(201).json(created.toJSON());
  } catch (error: any) {
    console.error('Error creating permission:', error);
    const status = error.status || 500;
    return res.status(status).json({ error: error.message || 'Failed to create custom permission' });
  }
});

// 3. DELETE /api/permissions/:id — Delete custom permission
router.delete('/:id', requirePermission('roles:edit'), async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    const { id } = req.params;

    await permissionService.deleteCustomPermission(tenantId, id);
    return res.json({ message: 'Custom permission deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting permission:', error);
    const status = error.status || 500;
    return res.status(status).json({
      error: error.message || 'Failed to delete permission',
      role_count: error.role_count,
      role_names: error.role_names,
    });
  }
});

export default router;
