import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import prisma from '../db/client';
import { sessionAuth } from '../middleware/sessionAuth';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'jwt-secret-key-123';

async function sendOtpEmail(email: string, code: string) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || !apiKey.startsWith('re_')) {
    console.log(`\n==================================================`);
    console.log(`[OTP Verification Code]: ${code} for ${email}`);
    console.log(`==================================================\n`);
    return;
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'Voice Platform <onboarding@resend.dev>',
        to: email,
        subject: 'Verify your email - Voice Platform OTP',
        html: `<p>Your verification code is <strong>${code}</strong>. It expires in 10 minutes.</p>`
      })
    });
    if (!res.ok) {
      console.error('[Resend Error] Failed to send email:', await res.text());
    } else {
      console.log(`[Resend] Successfully sent OTP email to ${email}`);
    }
  } catch (err) {
    console.error('[Resend Fetch Error]', err);
  }
}

// 1. Signup endpoint
router.post('/signup', async (req, res, next) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      res.status(400).json({ error: 'name, email, and password are required' });
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
      // If they signup again before verification, reuse the tenant and update password hash
      const passwordHash = await bcrypt.hash(password, 10);
      tenant = await prisma.tenant.update({
        where: { id: existing.id },
        data: {
          name,
          passwordHash
        }
      });
    } else {
      const passwordHash = await bcrypt.hash(password, 10);
      tenant = await prisma.tenant.create({
        data: {
          name,
          contactEmail: trimmedEmail,
          passwordHash,
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

    // Send email
    await sendOtpEmail(trimmedEmail, code);

    // Return debugCode in dev environments for testing convenience
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

// 2. Verify OTP endpoint
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

    if (otp.purpose === 'signup') {
      // Verify tenant
      await prisma.tenant.update({
        where: { contactEmail: trimmedEmail },
        data: { emailVerified: true }
      });
    }

    res.json({ message: 'Email successfully verified' });
  } catch (error) {
    next(error);
  }
});

// 3. Login endpoint
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ error: 'email and password are required' });
      return;
    }

    const trimmedEmail = email.trim().toLowerCase();

    const tenant = await prisma.tenant.findUnique({
      where: { contactEmail: trimmedEmail }
    });

    if (!tenant || !tenant.passwordHash) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    if (!tenant.emailVerified) {
      res.status(403).json({ error: 'Email not verified. Please verify your email first' });
      return;
    }

    const isMatch = await bcrypt.compare(password, tenant.passwordHash);
    if (!isMatch) {
      res.status(401).json({ error: 'Invalid credentials' });
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

// 4. Get logged-in tenant profile
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
