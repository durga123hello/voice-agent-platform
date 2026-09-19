import { Router, Request, Response } from 'express';
import prisma from '../db/client';
import { sessionAuth } from '../middleware/sessionAuth';
import { requirePermission } from '../middleware/requirePermission';

const router = Router();
router.use(sessionAuth);

function mapTeamMember(m: any) {
  const firstName = m.firstName || '';
  const lastName = m.lastName || '';
  const fullName = `${firstName} ${lastName}`.trim() || m.officialEmail || 'Unnamed Member';

  return {
    id: m.id,
    tenant_id: m.tenantId,
    tenantId: m.tenantId,
    firstName,
    first_name: firstName,
    lastName,
    last_name: lastName,
    name: fullName,
    employeeId: m.employeeId || '',
    employee_id: m.employeeId || '',
    officialEmail: m.officialEmail || '',
    official_email: m.officialEmail || '',
    email: m.officialEmail || '',
    personalEmail: m.personalEmail || '',
    personal_email: m.personalEmail || '',
    phone: m.phoneNumber || '',
    phoneNumber: m.phoneNumber || '',
    phone_number: m.phoneNumber || '',
    dateOfBirth: m.dateOfBirth || '',
    date_of_birth: m.dateOfBirth || '',
    dateOfJoining: m.dateOfJoining || '',
    date_of_joining: m.dateOfJoining || '',
    nationality: m.nationality || 'Qatar',
    gender: m.gender || 'Male',
    role: m.role || 'Administrator',
    status: m.status || 'active',
    project_assigned: m.projectAssigned || 'Both',
    projectAssigned: m.projectAssigned || 'Both',
    is_deleted: Boolean(m.isDeleted),
    isDeleted: Boolean(m.isDeleted),
    deleted_at: m.deletedAt ? m.deletedAt.toISOString() : null,
    deletedAt: m.deletedAt ? m.deletedAt.toISOString() : null,
    created_at: m.createdAt ? m.createdAt.toISOString() : undefined,
    createdAt: m.createdAt ? m.createdAt.toISOString() : undefined,
    updated_at: m.updatedAt ? m.updatedAt.toISOString() : undefined,
    updatedAt: m.updatedAt ? m.updatedAt.toISOString() : undefined,
  };
}

// 1. GET /api/teams — List team members
router.get('/', requirePermission('users:view'), async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    if (!tenantId) {
      return res.status(401).json({ error: 'Unauthorized: Missing tenant context' });
    }

    const includeDeleted = req.query.includeDeleted === 'true';

    const members = await prisma.teamMember.findMany({
      where: {
        tenantId,
        ...(includeDeleted ? {} : { isDeleted: false }),
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.json(members.map(mapTeamMember));
  } catch (error: any) {
    console.error('Error fetching team members:', error);
    return res.status(500).json({ error: 'Failed to fetch team members' });
  }
});

// 2. POST /api/teams — Create team member with full user attributes
router.post('/', requirePermission('users:create'), async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    if (!tenantId) {
      return res.status(401).json({ error: 'Unauthorized: Missing tenant context' });
    }

    const {
      firstName,
      first_name,
      lastName,
      last_name,
      name,
      employeeId,
      employee_id,
      officialEmail,
      official_email,
      email,
      personalEmail,
      personal_email,
      phone,
      phoneNumber,
      phone_number,
      dateOfBirth,
      date_of_birth,
      dateOfJoining,
      date_of_joining,
      nationality,
      gender,
      role,
      status,
      projectAssigned,
      project_assigned,
    } = req.body;

    const fName = (firstName || first_name || (name ? name.split(' ')[0] : '') || '').trim();
    const lName = (lastName || last_name || (name ? name.split(' ').slice(1).join(' ') : '') || '').trim();
    const empId = (employeeId || employee_id || '').trim();
    const oEmail = (officialEmail || official_email || email || '').trim();
    const pEmail = (personalEmail || personal_email || '').trim();
    const pPhone = (phoneNumber || phone_number || phone || '').trim();
    const dob = dateOfBirth || date_of_birth || '';
    const doj = dateOfJoining || date_of_joining || new Date().toISOString().split('T')[0];
    const nat = nationality || 'Qatar';
    const gen = gender || 'Male';
    const r = role || 'Administrator';
    const stat = status || 'active';
    const assigned = projectAssigned || project_assigned || 'Both';

    if (!fName && !oEmail) {
      return res.status(400).json({ error: 'First name or official email is required' });
    }

    const created = await prisma.teamMember.create({
      data: {
        tenantId,
        firstName: fName,
        lastName: lName,
        employeeId: empId,
        officialEmail: oEmail,
        personalEmail: pEmail || undefined,
        phoneNumber: pPhone || undefined,
        dateOfBirth: dob || undefined,
        dateOfJoining: doj,
        nationality: nat,
        gender: gen,
        role: r,
        status: stat,
        projectAssigned: assigned,
        isDeleted: false,
      },
    });

    return res.status(201).json(mapTeamMember(created));
  } catch (error: any) {
    console.error('Error creating team member:', error);
    return res.status(500).json({ error: 'Failed to create team member' });
  }
});

// 3. GET /api/teams/:id — Get team member details
router.get('/:id', requirePermission('users:view'), async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    const { id } = req.params;

    const member = await prisma.teamMember.findFirst({
      where: { id, tenantId },
    });

    if (!member) {
      return res.status(404).json({ error: 'Team member not found' });
    }

    return res.json(mapTeamMember(member));
  } catch (error: any) {
    console.error('Error fetching team member details:', error);
    return res.status(500).json({ error: 'Failed to fetch team member details' });
  }
});

// 4. PUT /api/teams/:id — Update team member with user attributes
router.put('/:id', requirePermission('users:edit'), async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    const { id } = req.params;

    const member = await prisma.teamMember.findFirst({
      where: { id, tenantId },
    });

    if (!member) {
      return res.status(404).json({ error: 'Team member not found' });
    }

    const {
      firstName,
      first_name,
      lastName,
      last_name,
      employeeId,
      employee_id,
      officialEmail,
      official_email,
      personalEmail,
      personal_email,
      phone,
      phoneNumber,
      phone_number,
      dateOfBirth,
      date_of_birth,
      dateOfJoining,
      date_of_joining,
      nationality,
      gender,
      role,
      status,
      projectAssigned,
      project_assigned,
    } = req.body;

    const updated = await prisma.teamMember.update({
      where: { id },
      data: {
        ...(firstName !== undefined && { firstName: firstName.trim() }),
        ...(first_name !== undefined && { firstName: first_name.trim() }),
        ...(lastName !== undefined && { lastName: lastName.trim() }),
        ...(last_name !== undefined && { lastName: last_name.trim() }),
        ...(employeeId !== undefined && { employeeId: employeeId.trim() }),
        ...(employee_id !== undefined && { employeeId: employee_id.trim() }),
        ...(officialEmail !== undefined && { officialEmail: officialEmail.trim() }),
        ...(official_email !== undefined && { officialEmail: official_email.trim() }),
        ...(personalEmail !== undefined && { personalEmail: personalEmail.trim() }),
        ...(personal_email !== undefined && { personalEmail: personal_email.trim() }),
        ...(phone !== undefined && { phoneNumber: phone.trim() }),
        ...(phoneNumber !== undefined && { phoneNumber: phoneNumber.trim() }),
        ...(phone_number !== undefined && { phoneNumber: phone_number.trim() }),
        ...(dateOfBirth !== undefined && { dateOfBirth }),
        ...(date_of_birth !== undefined && { dateOfBirth: date_of_birth }),
        ...(dateOfJoining !== undefined && { dateOfJoining }),
        ...(date_of_joining !== undefined && { dateOfJoining: date_of_joining }),
        ...(nationality !== undefined && { nationality }),
        ...(gender !== undefined && { gender }),
        ...(role !== undefined && { role }),
        ...(status !== undefined && { status }),
        ...(projectAssigned !== undefined && { projectAssigned }),
        ...(project_assigned !== undefined && { projectAssigned: project_assigned }),
      },
    });

    return res.json(mapTeamMember(updated));
  } catch (error: any) {
    console.error('Error updating team member:', error);
    return res.status(500).json({ error: 'Failed to update team member' });
  }
});

// 5. DELETE /api/teams/:id — Soft Delete team member
router.delete('/:id', requirePermission('users:delete'), async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    const { id } = req.params;

    const member = await prisma.teamMember.findFirst({
      where: { id, tenantId },
    });

    if (!member) {
      return res.status(404).json({ error: 'Team member not found' });
    }

    const softDeleted = await prisma.teamMember.update({
      where: { id },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
      },
    });

    return res.json({
      message: 'Team member soft-deleted (archived) successfully',
      member: mapTeamMember(softDeleted),
    });
  } catch (error: any) {
    console.error('Error soft-deleting team member:', error);
    return res.status(500).json({ error: 'Failed to delete team member' });
  }
});

// 6. POST /api/teams/:id/restore — Restore soft-deleted team member
router.post('/:id/restore', requirePermission('users:edit'), async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    const { id } = req.params;

    const member = await prisma.teamMember.findFirst({
      where: { id, tenantId },
    });

    if (!member) {
      return res.status(404).json({ error: 'Team member not found' });
    }

    const restored = await prisma.teamMember.update({
      where: { id },
      data: {
        isDeleted: false,
        deletedAt: null,
      },
    });

    return res.json({
      message: 'Team member restored successfully',
      member: mapTeamMember(restored),
    });
  } catch (error: any) {
    console.error('Error restoring team member:', error);
    return res.status(500).json({ error: 'Failed to restore team member' });
  }
});

// 7. DELETE /api/teams/:id/hard — Permanently hard delete team member
router.delete('/:id/hard', async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    const { id } = req.params;

    const member = await prisma.teamMember.findFirst({
      where: { id, tenantId },
    });

    if (!member) {
      return res.status(404).json({ error: 'Team member not found' });
    }

    await prisma.teamMember.delete({
      where: { id },
    });

    return res.json({ message: 'Team member permanently deleted', id });
  } catch (error: any) {
    console.error('Error hard-deleting team member:', error);
    return res.status(500).json({ error: 'Failed to permanently delete team member' });
  }
});

export default router;
