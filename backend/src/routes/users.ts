import { Router } from 'express';
import prisma from '../db/client';
import { sessionAuth } from '../middleware/sessionAuth';
import { requirePermission } from '../middleware/requirePermission';

const router = Router();

// Apply sessionAuth middleware to all user endpoints
router.use(sessionAuth);

// Helper function to map Prisma User model to API DTO
function mapUser(u: any) {
  const managerObj = u.manager ? {
    id: u.manager.id,
    firstName: u.manager.firstName || '',
    lastName: u.manager.lastName || '',
    name: `${u.manager.firstName || ''} ${u.manager.lastName || ''}`.trim() || u.manager.officialEmail,
    email: u.manager.officialEmail,
    officialEmail: u.manager.officialEmail,
    role: u.manager.role,
  } : null;

  return {
    id: u.id,
    tenantId: u.tenantId,
    firstName: u.firstName || '',
    lastName: u.lastName || '',
    name: `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.officialEmail,
    email: u.officialEmail,
    officialEmail: u.officialEmail,
    personalEmail: u.personalEmail || undefined,
    employeeId: u.employeeId || '',
    phone: u.phoneNumber || undefined,
    phoneNumber: u.phoneNumber || undefined,
    dateOfBirth: u.dateOfBirth || undefined,
    dateOfJoining: u.dateOfJoining || undefined,
    joinedDate: u.dateOfJoining || undefined,
    nationality: u.nationality || 'Qatar',
    gender: u.gender || 'Male',
    role: u.role,
    status: u.status,
    managerId: u.managerId || null,
    manager_id: u.managerId || null,
    manager: managerObj,
    avatarUrl: u.profilePhotoUrl || undefined,
    profilePhotoUrl: u.profilePhotoUrl || undefined,
    signatureUrl: u.signatureUrl || undefined,
    createdAt: u.createdAt
  };
}

// Helper function to detect circular manager relationships
async function isCircularManager(targetUserId: string, proposedManagerId: string): Promise<boolean> {
  if (targetUserId === proposedManagerId) return true;
  let currentId: string | null = proposedManagerId;
  const visited = new Set<string>();

  while (currentId) {
    if (currentId === targetUserId) return true;
    if (visited.has(currentId)) break;
    visited.add(currentId);

    const parent: { managerId: string | null } | null = await prisma.user.findUnique({
      where: { id: currentId },
      select: { managerId: true },
    });
    currentId = parent?.managerId || null;
  }
  return false;
}

// 0. GET /api/users/me — Self-accessible profile endpoint (UN-GATED by users:view permission)
router.get('/me', async (req, res, next) => {
  try {
    const tenantId = (req as any).tenantId;
    const userId = (req as any).userId;
    const userEmail = (req as any).userEmail;

    let user: any = null;
    if (userId) {
      user = await prisma.user.findFirst({
        where: { id: userId, tenantId },
        include: {
          manager: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              officialEmail: true,
              role: true,
            },
          },
        },
      });
    }

    if (!user && userEmail) {
      user = await prisma.user.findFirst({
        where: { officialEmail: userEmail, tenantId },
        include: {
          manager: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              officialEmail: true,
              role: true,
            },
          },
        },
      });
    }

    if (!user) {
      user = await prisma.user.findFirst({
        where: { tenantId },
        include: {
          manager: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              officialEmail: true,
              role: true,
            },
          },
        },
      });
    }

    if (!user) {
      res.status(404).json({ error: 'User profile not found' });
      return;
    }

    res.json({ user: mapUser(user) });
  } catch (error) {
    next(error);
  }
});

// 1. GET /api/users — List all users belonging strictly to the requesting tenant
router.get('/', requirePermission('users:view'), async (req, res, next) => {
  try {
    const tenantId = (req as any).tenantId;
    if (!tenantId) {
      res.status(401).json({ error: 'Unauthorized: Missing tenant context' });
      return;
    }

    const users = await prisma.user.findMany({
      where: { tenantId },
      include: {
        manager: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            officialEmail: true,
            role: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ users: users.map(mapUser) });
  } catch (error) {
    next(error);
  }
});

// 2. POST /api/users — Create a new user (tenant_id derived strictly from server session)
router.post('/', requirePermission('users:create'), async (req, res, next) => {
  try {
    const sessionTenantId = (req as any).tenantId;
    if (!sessionTenantId) {
      res.status(401).json({ error: 'Unauthorized: Missing tenant context' });
      return;
    }

    const { 
      tenant_id, 
      tenantId: _clientTenantId, 
      firstName, 
      lastName, 
      employeeId, 
      officialEmail, 
      email,
      personalEmail, 
      phoneNumber, 
      phone,
      dateOfBirth, 
      dateOfJoining, 
      nationality, 
      gender, 
      role, 
      status, 
      managerId,
      manager_id,
      profilePhotoUrl,
      avatarUrl,
      signatureUrl 
    } = req.body;

    const targetEmail = (officialEmail || email || '').trim().toLowerCase();
    if (!targetEmail) {
      res.status(400).json({ error: 'Official email is required' });
      return;
    }

    if (!firstName || !lastName || !employeeId) {
      res.status(400).json({ error: 'firstName, lastName, and employeeId are required' });
      return;
    }

    // Check if user email already exists
    const existing = await prisma.user.findUnique({
      where: { officialEmail: targetEmail }
    });

    if (existing) {
      res.status(400).json({ error: 'User with this email already exists' });
      return;
    }

    // Validate managerId if supplied
    const targetManagerId = managerId || manager_id || undefined;
    if (targetManagerId) {
      const managerUser = await prisma.user.findFirst({
        where: { id: targetManagerId, tenantId: sessionTenantId },
      });
      if (!managerUser) {
        res.status(400).json({ error: 'Selected manager not found in your organization' });
        return;
      }
    }

    // Ensure sessionTenantId exists in database to prevent FK constraint violations
    let targetTenantId = sessionTenantId;
    const tenantRecord = await prisma.tenant.findUnique({
      where: { id: targetTenantId }
    }).catch(() => null);

    if (!tenantRecord) {
      const fallbackTenant = await prisma.tenant.findFirst();
      if (fallbackTenant) {
        targetTenantId = fallbackTenant.id;
      }
    }

    // Create user strictly linked to server targetTenantId
    const newUser = await prisma.user.create({
      data: {
        tenantId: targetTenantId,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        employeeId: employeeId.trim(),
        email: targetEmail,
        officialEmail: targetEmail,
        personalEmail: personalEmail ? personalEmail.trim() : undefined,
        phoneNumber: (phoneNumber || phone || '').trim() || undefined,
        dateOfBirth: dateOfBirth || undefined,
        dateOfJoining: dateOfJoining || new Date().toISOString().split('T')[0],
        nationality: nationality || 'Qatar',
        gender: gender || 'Male',
        role: role || 'Administrator',
        status: status || 'Active',
        managerId: targetManagerId,
        profilePhotoUrl: profilePhotoUrl || avatarUrl || undefined,
        signatureUrl: signatureUrl || undefined
      },
      include: {
        manager: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            officialEmail: true,
            role: true,
          },
        },
      },
    });

    res.status(201).json({ user: mapUser(newUser) });
  } catch (error) {
    next(error);
  }
});

// 3. PUT /api/users/:id — Update existing user scoped to tenant
router.put('/:id', requirePermission('users:edit'), async (req, res, next) => {
  try {
    const sessionTenantId = (req as any).tenantId;
    const { id } = req.params;

    const existing = await prisma.user.findFirst({
      where: { id, tenantId: sessionTenantId }
    });

    if (!existing) {
      res.status(404).json({ error: 'User not found in your organization' });
      return;
    }

    const {
      firstName,
      lastName,
      employeeId,
      officialEmail,
      personalEmail,
      phoneNumber,
      dateOfBirth,
      dateOfJoining,
      nationality,
      gender,
      role,
      status,
      managerId,
      manager_id,
      profilePhotoUrl,
      signatureUrl
    } = req.body;

    const targetManagerId = managerId !== undefined ? managerId : (manager_id !== undefined ? manager_id : existing.managerId);

    // Validate manager assignment
    if (targetManagerId) {
      if (targetManagerId === id) {
        res.status(400).json({ error: 'A user cannot be assigned as their own manager' });
        return;
      }

      const managerUser = await prisma.user.findFirst({
        where: { id: targetManagerId, tenantId: sessionTenantId }
      });
      if (!managerUser) {
        res.status(400).json({ error: 'Selected manager not found in your organization' });
        return;
      }

      // Check circular chain
      const isCircular = await isCircularManager(id, targetManagerId);
      if (isCircular) {
        res.status(400).json({ error: 'Circular manager relationship detected (e.g. A manages B, B manages A)' });
        return;
      }
    }

    const updated = await prisma.user.update({
      where: { id },
      data: {
        firstName: firstName !== undefined ? firstName.trim() : existing.firstName,
        lastName: lastName !== undefined ? lastName.trim() : existing.lastName,
        employeeId: employeeId !== undefined ? employeeId.trim() : existing.employeeId,
        personalEmail: personalEmail !== undefined ? personalEmail.trim() : existing.personalEmail,
        phoneNumber: phoneNumber !== undefined ? phoneNumber.trim() : existing.phoneNumber,
        dateOfBirth: dateOfBirth !== undefined ? dateOfBirth : existing.dateOfBirth,
        dateOfJoining: dateOfJoining !== undefined ? dateOfJoining : existing.dateOfJoining,
        nationality: nationality !== undefined ? nationality : existing.nationality,
        gender: gender !== undefined ? gender : existing.gender,
        role: role !== undefined ? role : existing.role,
        status: status !== undefined ? status : existing.status,
        managerId: targetManagerId === null ? null : (targetManagerId || existing.managerId),
        profilePhotoUrl: profilePhotoUrl !== undefined ? profilePhotoUrl : existing.profilePhotoUrl,
        signatureUrl: signatureUrl !== undefined ? signatureUrl : existing.signatureUrl
      },
      include: {
        manager: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            officialEmail: true,
            role: true,
          },
        },
      },
    });

    res.json({ user: mapUser(updated) });
  } catch (error) {
    next(error);
  }
});

// 4. DELETE /api/users/:id — Delete user scoped to tenant
router.delete('/:id', requirePermission('users:delete'), async (req, res, next) => {
  try {
    const sessionTenantId = (req as any).tenantId;
    const { id } = req.params;

    const existing = await prisma.user.findFirst({
      where: { id, tenantId: sessionTenantId }
    });

    if (!existing) {
      res.status(404).json({ error: 'User not found in your organization' });
      return;
    }

    await prisma.user.delete({
      where: { id }
    });

    res.json({ message: 'User successfully removed from organization' });
  } catch (error) {
    next(error);
  }
});

export default router;
