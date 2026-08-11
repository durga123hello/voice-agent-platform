import nodemailer from 'nodemailer';

interface SendOtpOptions {
  to: string;
  code: string;
  purpose?: 'signup' | 'login';
}

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter | null {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_HOST_PORT || process.env.SMTP_PORT || '587', 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS || process.env.SMTP_PASSWORD;

  if (host && user && pass) {
    if (!transporter) {
      transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465, // true for 465, false for 587
        auth: {
          user,
          pass
        }
      });
    }
    return transporter;
  }
  return null;
}

export async function sendOtpEmail({ to, code, purpose = 'login' }: SendOtpOptions): Promise<boolean> {
  console.log(`\n==================================================`);
  console.log(`🔑 [OTP Verification Code]: ${code} for ${to} (Purpose: ${purpose})`);
  console.log(`==================================================\n`);

  const mailTransporter = getTransporter();

  // 1. Try SMTP (Gmail, custom mail server, etc.)
  if (mailTransporter) {
    const fromAddress = process.env.SMTP_FROM || process.env.SMTP_USER || 'no-reply@voiceplatform.com';
    const subject = purpose === 'signup' 
      ? 'Verify your email - Voice Platform Sign Up' 
      : 'Your Login Verification Code - Voice Platform';

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e1e4e8; border-radius: 8px;">
        <h2 style="color: #24292e; text-align: center;">Voice Orchestration Platform</h2>
        <p style="font-size: 15px; color: #586069;">Hello,</p>
        <p style="font-size: 15px; color: #586069;">Use the verification code below to complete your ${purpose}:</p>
        <div style="background-color: #f6f8fa; padding: 16px; text-align: center; border-radius: 6px; margin: 24px 0;">
          <span style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #0366d6;">${code}</span>
        </div>
        <p style="font-size: 13px; color: #586069;">This code will expire in <strong>10 minutes</strong>. If you did not request this, you can safely ignore this email.</p>
        <hr style="border: 0; border-top: 1px solid #e1e4e8; margin: 20px 0;" />
        <p style="font-size: 12px; color: #6a737d; text-align: center;">Secure Passwordless Authentication</p>
      </div>
    `;

    try {
      const info = await mailTransporter.sendMail({
        from: `"Voice Platform" <${fromAddress}>`,
        to,
        subject,
        html: htmlContent
      });
      console.log(`[SMTP] Successfully delivered OTP email to ${to} (MessageId: ${info.messageId})`);
      return true;
    } catch (err: any) {
      console.error('[SMTP Send Error]:', err?.message || err);
    }
  }

  // 2. Fallback to Resend API if SMTP is not configured
  const resendApiKey = process.env.RESEND_API_KEY;
  if (resendApiKey && resendApiKey.startsWith('re_')) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: 'Voice Platform <onboarding@resend.dev>',
          to,
          subject: 'Verify your email - Voice Platform OTP',
          html: `<p>Your verification code is <strong>${code}</strong>. It expires in 10 minutes.</p>`
        })
      });
      if (!res.ok) {
        console.error('[Resend API Error Response]:', await res.text());
      } else {
        console.log(`[Resend] Successfully delivered OTP email to ${to}`);
        return true;
      }
    } catch (err) {
      console.error('[Resend Fetch Error]', err);
    }
  }

  return false;
}
