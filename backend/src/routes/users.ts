import { Router } from 'express';
import prisma from '../db/client';
import { sessionAuth } from '../middleware/sessionAuth';

const router = Router();

// Apply sessionAuth middleware to all user endpoints
router.use(sessionAuth);

// 1. GET /api/users — List all users belonging strictly to the requesting tenant
router.get('/', async (req, res, next) => {
  try {
    const tenantId = (req as any).tenantId;
    if (!tenantId) {
      res.status(401).json({ error: 'Unauthorized: Missing tenant context' });
      return;
    }

    const users = await prisma.user.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' }
    });

    // Map database records to standard API schema
    const mappedUsers = users.map((u) => ({
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
      avatarUrl: u.profilePhotoUrl || undefined,
      profilePhotoUrl: u.profilePhotoUrl || undefined,
      signatureUrl: u.signatureUrl || undefined,
      createdAt: u.createdAt
    }));

    res.json({ users: mappedUsers });
  } catch (error) {
    next(error);
  }
});

// 2. POST /api/users — Create a new user (tenant_id derived strictly from server session)
router.post('/', async (req, res, next) => {
  try {
    const sessionTenantId = (req as any).tenantId;
    if (!sessionTenantId) {
      res.status(401).json({ error: 'Unauthorized: Missing tenant context' });
      return;
    }

    // SECURITY GUARANTEE: Explicitly ignore any tenant_id supplied in request body
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

    // Create user strictly linked to server sessionTenantId
    const newUser = await prisma.user.create({
      data: {
        tenantId: sessionTenantId, // SERVER DERIVED FOREIGN KEY
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        employeeId: employeeId.trim(),
        officialEmail: targetEmail,
        personalEmail: personalEmail ? personalEmail.trim() : undefined,
        phoneNumber: (phoneNumber || phone || '').trim() || undefined,
        dateOfBirth: dateOfBirth || undefined,
        dateOfJoining: dateOfJoining || new Date().toISOString().split('T')[0],
        nationality: nationality || 'Qatar',
        gender: gender || 'Male',
        role: role || 'Administrator',
        status: status || 'Active',
        profilePhotoUrl: profilePhotoUrl || avatarUrl || undefined,
        signatureUrl: signatureUrl || undefined
      }
    });

    const responseUser = {
      id: newUser.id,
      tenantId: newUser.tenantId, // Real relational foreign key
      firstName: newUser.firstName,
      lastName: newUser.lastName,
      name: `${newUser.firstName} ${newUser.lastName}`,
      email: newUser.officialEmail,
      officialEmail: newUser.officialEmail,
      personalEmail: newUser.personalEmail || undefined,
      employeeId: newUser.employeeId,
      phone: newUser.phoneNumber || undefined,
      dateOfBirth: newUser.dateOfBirth || undefined,
      joinedDate: newUser.dateOfJoining,
      nationality: newUser.nationality,
      gender: newUser.gender,
      role: newUser.role,
      status: newUser.status,
      avatarUrl: newUser.profilePhotoUrl || undefined,
      signatureUrl: newUser.signatureUrl || undefined,
      createdAt: newUser.createdAt
    };

    res.status(201).json({ user: responseUser });
  } catch (error) {
    next(error);
  }
});

// 3. PUT /api/users/:id — Update existing user scoped to tenant
router.put('/:id', async (req, res, next) => {
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
      profilePhotoUrl,
      signatureUrl
    } = req.body;

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
        profilePhotoUrl: profilePhotoUrl !== undefined ? profilePhotoUrl : existing.profilePhotoUrl,
        signatureUrl: signatureUrl !== undefined ? signatureUrl : existing.signatureUrl
      }
    });

    res.json({ user: updated });
  } catch (error) {
    next(error);
  }
});

// 4. DELETE /api/users/:id — Delete user scoped to tenant
router.delete('/:id', async (req, res, next) => {
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
