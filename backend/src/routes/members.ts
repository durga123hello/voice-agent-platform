import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import prisma from '../db/client';
import { sessionAuth } from '../middleware/sessionAuth';

const router = Router();

router.use(sessionAuth);

/**
 * 1. List all members in caller's active organization: GET /api/members
 */
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = (req as any).tenantId;

    const members = await prisma.tenantMember.findMany({
      where: { tenantId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            createdAt: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const formatted = members.map((m: any) => ({
      id: m.id,
      userId: m.userId,
      email: m.user.email,
      role: m.role,
      createdAt: m.createdAt
    }));

    res.json(formatted);
  } catch (error) {
    next(error);
  }
});

/**
 * 2. Add / Create user directly in organization: POST /api/members
 */
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = (req as any).tenantId;
    const { email, role } = req.body;

    if (!email || typeof email !== 'string') {
      res.status(400).json({ error: 'email is required and must be a string.' });
      return;
    }

    const trimmedEmail = email.trim().toLowerCase();
    const assignedRole = ['owner', 'admin', 'member'].includes(role) ? role : 'member';

    // Find or create user
    let user = await prisma.user.findUnique({
      where: { email: trimmedEmail }
    });

    if (!user) {
      const dummyPassword = await bcrypt.hash(crypto.randomBytes(16).toString('hex'), 10);
      user = await prisma.user.create({
        data: {
          email: trimmedEmail,
          passwordHash: dummyPassword
        }
      });
    }

    // Check if membership already exists
    const existingMember = await prisma.tenantMember.findUnique({
      where: {
        userId_tenantId: {
          userId: user.id,
          tenantId
        }
      }
    });

    if (existingMember) {
      res.status(400).json({ error: 'User is already a member of this organization.' });
      return;
    }

    // Create join table record
    const newMember = await prisma.tenantMember.create({
      data: {
        userId: user.id,
        tenantId,
        role: assignedRole
      },
      include: { user: true }
    });

    res.status(201).json({
      success: true,
      message: 'User successfully added to organization.',
      member: {
        id: newMember.id,
        userId: newMember.userId,
        email: newMember.user.email,
        role: newMember.role,
        createdAt: newMember.createdAt
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * 3. Update member role: PATCH /api/members/:id
 */
router.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = (req as any).tenantId;
    const { id } = req.params;
    const { role } = req.body;

    if (!role || !['owner', 'admin', 'member'].includes(role)) {
      res.status(400).json({ error: "role is required and must be 'owner', 'admin', or 'member'." });
      return;
    }

    const existing = await prisma.tenantMember.findFirst({
      where: { id, tenantId }
    });

    if (!existing) {
      res.status(404).json({ error: 'Member record not found in active organization.' });
      return;
    }

    const updated = await prisma.tenantMember.update({
      where: { id },
      data: { role }
    });

    res.json({
      success: true,
      member: {
        id: updated.id,
        userId: updated.userId,
        role: updated.role,
        createdAt: updated.createdAt
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * 4. Remove member from organization: DELETE /api/members/:id
 */
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = (req as any).tenantId;
    const { id } = req.params;

    const existing = await prisma.tenantMember.findFirst({
      where: { id, tenantId }
    });

    if (!existing) {
      res.status(404).json({ error: 'Member record not found in active organization.' });
      return;
    }

    await prisma.tenantMember.delete({
      where: { id }
    });

    res.json({
      success: true,
      message: 'User successfully removed from organization.'
    });
  } catch (error) {
    next(error);
  }
});

export default router;
