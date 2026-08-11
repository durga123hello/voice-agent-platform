
import { Router } from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import prisma from '../db/client';
import { sessionAuth } from '../middleware/sessionAuth';
import { emailRateLimiter } from '../utils/rateLimiter';
import { sendOtpEmail } from '../utils/mailer';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'jwt-secret-key-123';

// 1. Passwordless Signup endpoint (with rate limiter)
router.post('/signup', emailRateLimiter, async (req, res, next) => {
  try {
    const { name, email } = req.body;
    if (!name || !email) {
      res.status(400).json({ error: 'name and email are required' });
      return;
    }

    const trimmedEmail = email.trim().toLowerCase();

    // Check if tenant with this email already exists
    const existing = await prisma.tenant.findUnique({
      where: { contactEmail: trimmedEmail }
    });

    let tenant;
    if (existing) {
      if (existing.emailVerified) {
        res.status(400).json({ error: 'Email already registered' });
        return;
      }
      tenant = await prisma.tenant.update({
        where: { id: existing.id },
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

// 2. Verify OTP (Signup) endpoint -> logs in directly on success
router.post('/verify-otp', async (req, res, next) => {
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

    // Verify tenant
    const tenant = await prisma.tenant.update({
      where: { contactEmail: trimmedEmail },
      data: { emailVerified: true }
    });

    // Issue JWT token directly
    const token = jwt.sign(
      { tenantId: tenant.id, email: tenant.contactEmail },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      message: 'Email successfully verified and logged in',
      token,
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

// 3. Request Login OTP endpoint (with rate limiter)
router.post('/request-login-otp', emailRateLimiter, async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) {
      res.status(400).json({ error: 'email is required' });
      return;
    }

    const trimmedEmail = email.trim().toLowerCase();

    const tenant = await prisma.tenant.findUnique({
      where: { contactEmail: trimmedEmail }
    });

    // Setup generic success response to prevent email leaks
    const responsePayload: any = {
      message: 'If this email is registered, a secure login OTP code has been sent.'
    };

    if (tenant && tenant.emailVerified) {
      // Generate 6-digit OTP
      const code = crypto.randomInt(100000, 999999).toString();
      const codeHash = crypto.createHash('sha256').update(code).digest('hex');

      // Store in otp_codes
      await prisma.otpCode.create({
        data: {
          tenantId: tenant.id,
          email: trimmedEmail,
          codeHash,
          purpose: 'login',
          expiresAt: new Date(Date.now() + 10 * 60 * 1000) // 10 mins TTL
        }
      });

      // Send email via SMTP (or fallback)
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

// 4. Verify Login OTP endpoint
router.post('/verify-login-otp', async (req, res, next) => {
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

    // Mark OTP as used
    await prisma.otpCode.update({
      where: { id: otp.id },
      data: { used: true }
    });

    const tenant = await prisma.tenant.findUnique({
      where: { contactEmail: trimmedEmail }
    });

    if (!tenant) {
      res.status(404).json({ error: 'Tenant no longer exists' });
      return;
    }

    // Issue JWT token
    const token = jwt.sign(
      { tenantId: tenant.id, email: tenant.contactEmail },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      token,
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

// 5. Deprecate /login
router.post('/login', (req, res) => {
  res.status(410).json({ error: 'Password login is deprecated. Please use passwordless OTP login.' });
});

// 6. Get logged-in tenant profile
router.get('/me', sessionAuth, async (req, res, next) => {
  try {
    const tenantId = (req as any).tenantId;
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId }
    });
    if (!tenant) {
      res.status(404).json({ error: 'Tenant not found' });
      return;
    }
    res.json({
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

export default router;
