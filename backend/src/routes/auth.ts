import { Router, Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import prisma from '../db/client';
import { sessionAuth } from '../middleware/sessionAuth';
import { emailRateLimiter } from '../utils/rateLimiter';
import { sendOtpEmail } from '../utils/mailer';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'jwt-secret-key-123';

/**
 * 1. Passwordless Signup endpoint (with rate limiter)
 */
router.post('/signup', emailRateLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, email } = req.body;
    if (!name || !email) {
      res.status(400).json({ error: 'name and email are required' });
      return;
    }

    const trimmedEmail = email.trim().toLowerCase();

    // Check if tenant with this contactEmail exists
    let tenant = await prisma.tenant.findUnique({
      where: { contactEmail: trimmedEmail }
    });

    if (tenant) {
      if (tenant.emailVerified) {
        res.status(400).json({ error: 'Email already registered. Please login instead.' });
        return;
      }
      tenant = await prisma.tenant.update({
        where: { id: tenant.id },
        data: { name }
      });
    } else {
      tenant = await prisma.tenant.create({
        data: {
          name,
          contactEmail: trimmedEmail,
          emailVerified: false
        }
      });
    }

    // Generate 6-digit OTP
    const code = crypto.randomInt(100000, 999999).toString();
    const codeHash = crypto.createHash('sha256').update(code).digest('hex');

    // Store in otp_codes
    await prisma.otpCode.create({
      data: {
        tenantId: tenant.id,
        email: trimmedEmail,
        codeHash,
        purpose: 'signup',
        expiresAt: new Date(Date.now() + 10 * 60 * 1000) // 10 mins TTL
      }
    });

    // Send email via SMTP (or fallback)
    await sendOtpEmail({ to: trimmedEmail, code, purpose: 'signup' });

    const responsePayload: any = {
      message: 'Signup successful. Please verify your email using the OTP sent.',
      email: trimmedEmail
    };
    if (process.env.NODE_ENV !== 'production' || !process.env.RESEND_API_KEY) {
      responsePayload.debugCode = code;
    }

    res.status(201).json(responsePayload);
  } catch (error) {
    next(error);
  }
});

/**
 * 2. Verify OTP (Signup) endpoint -> initializes User, Tenant, Membership & Default Project
 */
router.post('/verify-otp', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, code } = req.body;
    if (!email || !code) {
      res.status(400).json({ error: 'email and code are required' });
      return;
    }

    const trimmedEmail = email.trim().toLowerCase();
    const codeHash = crypto.createHash('sha256').update(code.trim()).digest('hex');

    const otp = await prisma.otpCode.findFirst({
      where: {
        email: trimmedEmail,
        codeHash,
        used: false,
        purpose: 'signup',
        expiresAt: { gt: new Date() }
      }
    });

    if (!otp) {
      res.status(400).json({ error: 'Invalid or expired verification code' });
      return;
    }

    // Mark OTP as used
    await prisma.otpCode.update({
      where: { id: otp.id },
      data: { used: true }
    });

    // Helper to get or create org-scoped user record
    const getOrCreateUserForTenant = async (tenantId: string, email: string, name?: string, role: string = 'owner') => {
      let user = await prisma.user.findUnique({
        where: { officialEmail: email }
      });
      if (!user) {
        const namePart = name || email.split('@')[0];
        const nameTokens = namePart.trim().split(' ');
        const firstName = nameTokens[0] || 'User';
        const lastName = nameTokens.slice(1).join(' ') || '';

        user = await prisma.user.create({
          data: {
            tenantId,
            officialEmail: email,
            firstName,
            lastName: lastName || undefined,
            role,
            status: 'active'
          }
        });
      }
      return user;
    };

    // Verify tenant
    const tenant = await prisma.tenant.update({
      where: { contactEmail: trimmedEmail },
      data: { emailVerified: true }
    });

    // Create or retrieve independent User record
    let user = await prisma.user.findFirst({
      where: { OR: [{ email: trimmedEmail }, { officialEmail: trimmedEmail }] }
    });

    if (!user) {
      const dummyPassword = await bcrypt.hash(crypto.randomBytes(16).toString('hex'), 10);
      user = await prisma.user.create({
        data: {
          tenantId: tenant.id,
          email: trimmedEmail,
          officialEmail: trimmedEmail,
          firstName: trimmedEmail.split('@')[0],
          lastName: 'User',
          role: 'owner',
          status: 'active',
          passwordHash: dummyPassword
        }
      });
    }

    // Link user to tenant in organization_members
    await prisma.tenantMember.upsert({
      where: {
        userId_tenantId: {
          userId: user.id,
          tenantId: tenant.id
        }
      },
      create: {
        userId: user.id,
        tenantId: tenant.id,
        role: 'owner'
      },
      update: {}
    });

    // Create a default project for this tenant if none exists
    const projectCount = await prisma.project.count({ where: { tenantId: tenant.id } });
    if (projectCount === 0) {
      await prisma.project.create({
        data: {
          name: 'Default Project',
          tenantId: tenant.id
        }
      });
    }

    // Issue JWT token with userId and active tenantId
    const token = jwt.sign(
      { userId: user.id, tenantId: tenant.id, email: user.email || user.officialEmail, role: user.role || 'owner' },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      message: 'Email successfully verified and logged in',
      token,
      user: {
        id: user.id,
        tenantId: user.tenantId || tenant.id,
        email: user.email || user.officialEmail,
        officialEmail: user.officialEmail || user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role || 'owner',
        status: user.status || 'active'
      },
      activeTenant: {
        id: tenant.id,
        name: tenant.name,
        contactEmail: tenant.contactEmail
      },
      tenant: {
        id: tenant.id,
        name: tenant.name,
        contactEmail: tenant.contactEmail
      },
      organizations: [
        {
          id: tenant.id,
          name: tenant.name,
          role: 'owner'
        }
      ]
    });
  } catch (error) {
    next(error);
  }
});

/**
 * 3. Request Login OTP endpoint (with rate limiter)
 */
router.post('/request-login-otp', emailRateLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email } = req.body;
    if (!email) {
      res.status(400).json({ error: 'email is required' });
      return;
    }

    const trimmedEmail = email.trim().toLowerCase();

    // Check if user or tenant exists
    const user = await prisma.user.findFirst({ where: { OR: [{ email: trimmedEmail }, { officialEmail: trimmedEmail }] } });
    const tenant = await prisma.tenant.findUnique({ where: { contactEmail: trimmedEmail } });

    const responsePayload: any = {
      message: 'If this email is registered, a secure login OTP code has been sent.'
    };

    if (user || tenant) {
      const code = crypto.randomInt(100000, 999999).toString();
      const codeHash = crypto.createHash('sha256').update(code).digest('hex');

      await prisma.otpCode.create({
        data: {
          tenantId: tenant ? tenant.id : null,
          email: trimmedEmail,
          codeHash,
          purpose: 'login',
          expiresAt: new Date(Date.now() + 10 * 60 * 1000)
        }
      });

      await sendOtpEmail({ to: trimmedEmail, code, purpose: 'login' });

      if (process.env.NODE_ENV !== 'production' || !process.env.RESEND_API_KEY) {
        responsePayload.debugCode = code;
      }
    }

    res.json(responsePayload);
  } catch (error) {
    next(error);
  }
});

/**
 * 4. Verify Login OTP endpoint -> identifies organizations and issues session token
 */
router.post('/verify-login-otp', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, code } = req.body;
    if (!email || !code) {
      res.status(400).json({ error: 'email and code are required' });
      return;
    }

    const trimmedEmail = email.trim().toLowerCase();
    const codeHash = crypto.createHash('sha256').update(code.trim()).digest('hex');

    const otp = await prisma.otpCode.findFirst({
      where: {
        email: trimmedEmail,
        codeHash,
        used: false,
        purpose: 'login',
        expiresAt: { gt: new Date() }
      }
    });

    if (!otp) {
      res.status(400).json({ error: 'Invalid or expired login code' });
      return;
    }

    await prisma.otpCode.update({
      where: { id: otp.id },
      data: { used: true }
    });

    let user = await prisma.user.findFirst({
      where: { OR: [{ email: trimmedEmail }, { officialEmail: trimmedEmail }] }
    });

    if (!user) {
      const dummyPassword = await bcrypt.hash(crypto.randomBytes(16).toString('hex'), 10);
      const namePart = trimmedEmail.split('@')[0];
      user = await prisma.user.create({
        data: {
          email: trimmedEmail,
          officialEmail: trimmedEmail,
          firstName: namePart.charAt(0).toUpperCase() + namePart.slice(1),
          lastName: 'User',
          role: 'owner',
          status: 'active',
          passwordHash: dummyPassword
        }
      });
    }

    // Load organization memberships
    let memberships = await prisma.tenantMember.findMany({
      where: { userId: user.id },
      include: { tenant: true }
    });

    if (memberships.length === 0) {
      let matchedTenant = await prisma.tenant.findUnique({
        where: { contactEmail: trimmedEmail }
      });
      if (!matchedTenant) {
        const namePart = trimmedEmail.split('@')[0];
        const orgName = `${namePart.charAt(0).toUpperCase() + namePart.slice(1)} Org`;
        matchedTenant = await prisma.tenant.create({
          data: {
            name: orgName,
            contactEmail: trimmedEmail,
            emailVerified: true
          }
        });
      }
      const newMember = await prisma.tenantMember.create({
        data: {
          userId: user.id,
          tenantId: matchedTenant.id,
          role: 'owner'
        },
        include: { tenant: true }
      });
      memberships = [newMember];
    }

    const activeMembership = memberships[0];
    const activeTenant = activeMembership.tenant;

    if (!activeTenant.emailVerified) {
      await prisma.tenant.update({
        where: { id: activeTenant.id },
        data: { emailVerified: true }
      });
    }

    // Ensure default project exists
    const projectCount = await prisma.project.count({ where: { tenantId: activeTenant.id } });
    if (projectCount === 0) {
      await prisma.project.create({
        data: {
          name: 'Default Project',
          tenantId: activeTenant.id
        }
      });
    }

    // Issue JWT token containing tenantId AND userId
    const token = jwt.sign(
      { userId: user.id, tenantId: activeTenant.id, email: user.officialEmail || user.email, role: user.role || 'owner' },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        tenantId: activeTenant.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email || user.officialEmail,
        officialEmail: user.officialEmail || user.email,
        role: user.role || 'owner',
        status: user.status || 'active'
      },
      activeTenant: {
        id: activeTenant.id,
        name: activeTenant.name,
        contactEmail: activeTenant.contactEmail
      },
      tenant: {
        id: activeTenant.id,
        name: activeTenant.name,
        contactEmail: activeTenant.contactEmail
      },
      organizations: memberships.map((m: any) => ({
        id: m.tenant.id,
        name: m.tenant.name,
        role: m.role
      }))
    });
  } catch (error) {
    next(error);
  }
});

/**
 * 5. Switch active organization: POST /api/auth/switch-tenant
 */
router.post('/switch-tenant', sessionAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).userId;
    const { tenantId } = req.body;

    if (!tenantId || typeof tenantId !== 'string') {
      res.status(400).json({ error: 'tenantId is required.' });
      return;
    }

    // Verify user is a member of the requested organization
    const membership = await prisma.tenantMember.findUnique({
      where: {
        userId_tenantId: {
          userId,
          tenantId
        }
      },
      include: { tenant: true }
    });

    if (!membership) {
      res.status(403).json({ error: 'Unauthorized: You are not a member of this organization.' });
      return;
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });

    // Issue new JWT token scoped to chosen organization
    const token = jwt.sign(
      { userId, tenantId: membership.tenantId, email: user?.email || user?.officialEmail },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      message: 'Switched organization successfully',
      token,
      activeTenant: {
        id: membership.tenant.id,
        name: membership.tenant.name,
        role: membership.role
      }
    });
  } catch (error) {
    next(error);
  }
});

// 6. Dashboard Direct Session Endpoint (for seamless passwordless OTP & signup)
router.post('/dashboard-session', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, fullName, orgName } = req.body;
    if (!email) {
      res.status(400).json({ error: 'email is required' });
      return;
    }

    const trimmedEmail = email.trim().toLowerCase();
    let tenant = await prisma.tenant.findUnique({
      where: { contactEmail: trimmedEmail }
    });

    if (!tenant) {
      const namePart = trimmedEmail.split('@')[0];
      const derivedOrgName = orgName || `${namePart.charAt(0).toUpperCase() + namePart.slice(1)} Corp`;
      tenant = await prisma.tenant.create({
        data: {
          name: derivedOrgName,
          contactEmail: trimmedEmail,
          emailVerified: true
        }
      });
    }

    let user = await prisma.user.findFirst({
      where: { OR: [{ email: trimmedEmail }, { officialEmail: trimmedEmail }] }
    });

    if (!user) {
      const nameToUse = fullName || trimmedEmail.split('@')[0];
      const nameTokens = nameToUse.trim().split(' ');
      const firstName = nameTokens[0] || 'User';
      const lastName = nameTokens.slice(1).join(' ') || 'Admin';

      user = await prisma.user.create({
        data: {
          tenantId: tenant.id,
          email: trimmedEmail,
          officialEmail: trimmedEmail,
          firstName,
          lastName,
          role: 'owner',
          status: 'active'
        }
      });
    }

    const token = jwt.sign(
      { userId: user.id, tenantId: tenant.id, email: user.officialEmail || user.email, role: user.role || 'owner' },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        tenantId: user.tenantId || tenant.id,
        firstName: user.firstName,
        lastName: user.lastName,
        officialEmail: user.officialEmail || user.email,
        email: user.email || user.officialEmail,
        role: user.role || 'owner',
        status: user.status || 'active'
      },
      tenant: {
        id: tenant.id,
        name: tenant.name,
        contactEmail: tenant.contactEmail
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * 6. Get authenticated user profile and organizations: GET /api/auth/me
 */
router.get('/me', sessionAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = (req as any).tenantId;
    const userId = (req as any).userId;

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId }
    });
    if (!tenant) {
      res.status(404).json({ error: 'Active tenant not found' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    const memberships = await prisma.tenantMember.findMany({
      where: { userId },
      include: { tenant: true }
    });

    res.json({
      user: {
        id: user ? user.id : userId,
        email: user ? user.email : (req as any).userEmail
      },
      activeTenant: {
        id: tenant.id,
        name: tenant.name,
        contactEmail: tenant.contactEmail
      },
      organizations: memberships.map((m: any) => ({
        id: m.tenant.id,
        name: m.tenant.name,
        role: m.role
      }))
    });
  } catch (error) {
    next(error);
  }
});

export default router;
