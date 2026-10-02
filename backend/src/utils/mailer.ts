import nodemailer from 'nodemailer';

interface SendOtpOptions {
  to: string;
  code: string;
  purpose?: 'signup' | 'login';
}

interface SmtpConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
  secure: boolean;
}

function getSmtpConfig(): SmtpConfig | null {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_HOST_PORT || process.env.SMTP_PORT || '587', 10);
  const user = process.env.SMTP_USER;
  const rawPass = process.env.SMTP_PASS || process.env.SMTP_PASSWORD || '';
  const pass = rawPass.replace(/\s+/g, ''); // Strip spaces (common in Gmail App Passwords)
  const from = process.env.SMTP_FROM || user || 'no-reply@vopx.ai';
  const secure = process.env.SMTP_SECURE === 'true' || port === 465;

  if (host && user && pass) {
    return { host, port, user, pass, from, secure };
  }
  return null;
}

let activeTransporter: nodemailer.Transporter | null = null;
let currentConfigHash: string | null = null;

export function getTransporter(): nodemailer.Transporter | null {
  const config = getSmtpConfig();
  if (!config) {
    return null;
  }

  const configHash = `${config.host}:${config.port}:${config.user}:${config.pass}:${config.secure}`;

  if (!activeTransporter || currentConfigHash !== configHash) {
    activeTransporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      family: 4, // Force IPv4 to prevent socket connection hangs on dual-stack hosts
      auth: {
        user: config.user,
        pass: config.pass,
      },
      tls: {
        rejectUnauthorized: process.env.SMTP_IGNORE_TLS === 'true' ? false : true,
      },
    } as any);
    currentConfigHash = configHash;
  }

  return activeTransporter;
}

/**
 * Verify current SMTP connection credentials.
 */
export async function verifySmtpConnection(): Promise<{ success: boolean; message: string }> {
  const config = getSmtpConfig();
  if (!config) {
    return {
      success: false,
      message: 'SMTP is not configured in environment variables. Please set SMTP_HOST, SMTP_USER, and SMTP_PASS.',
    };
  }

  const transporter = getTransporter();
  if (!transporter) {
    return { success: false, message: 'Failed to initialize SMTP transporter.' };
  }

  try {
    await transporter.verify();
    return {
      success: true,
      message: `SMTP connection successfully verified for ${config.user} via ${config.host}:${config.port}`,
    };
  } catch (err: any) {
    const errorMsg = err?.message || String(err);
    return {
      success: false,
      message: `SMTP Authentication Failed (${errorMsg}). Please check your SMTP_USER and SMTP_PASS (Gmail requires an App Password).`,
    };
  }
}

/**
 * Send an OTP email to the recipient via configured SMTP transport.
 */
export async function sendOtpEmail({ to, code, purpose = 'login' }: SendOtpOptions): Promise<boolean> {
  const trimmedEmail = to.trim().toLowerCase();

  console.log(`\n==================================================`);
  console.log(`🔑 [vop.x OTP Code]: ${code} for ${trimmedEmail} (Purpose: ${purpose})`);
  console.log(`==================================================\n`);

  const mailTransporter = getTransporter();
  const config = getSmtpConfig();

  // 1. Primary Email Delivery: SMTP
  if (mailTransporter && config) {
    const subject =
      purpose === 'signup'
        ? 'Verify your email - vop.x Voice AI Platform'
        : 'Your Login Verification Code - vop.x Voice AI Platform';

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${subject}</title>
      </head>
      <body style="margin: 0; padding: 0; background-color: #090d16; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f1f5f9;">
        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #090d16; padding: 40px 10px;">
          <tr>
            <td align="center">
              <table role="presentation" width="100%" max-width="560" border="0" cellspacing="0" cellpadding="0" style="max-width: 560px; background-color: #0f172a; border: 1px solid #1e293b; border-radius: 16px; overflow: hidden; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);">
                
                <!-- Header Logo Bar -->
                <tr>
                  <td style="padding: 32px 32px 24px 32px; text-align: center; border-bottom: 1px solid #1e293b;">
                    <div style="display: inline-block; background-color: #0f766e; color: #ffffff; font-weight: 900; font-size: 18px; padding: 8px 16px; border-radius: 10px; letter-spacing: -0.5px;">
                      vop<span style="color: #2dd4bf;">.x</span>
                    </div>
                    <div style="margin-top: 8px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: #14b8a6;">
                      Voice AI Orchestration Platform
                    </div>
                  </td>
                </tr>

                <!-- Content Body -->
                <tr>
                  <td style="padding: 32px;">
                    <h1 style="margin: 0 0 16px 0; font-size: 22px; font-weight: 800; color: #ffffff; text-align: center; letter-spacing: -0.5px;">
                      ${purpose === 'signup' ? 'Welcome to vop.x!' : 'Secure Account Login'}
                    </h1>

                    <p style="margin: 0 0 24px 0; font-size: 14px; line-height: 1.6; color: #94a3b8; text-align: center;">
                      Use the 6-digit verification code below to complete your ${purpose === 'signup' ? 'email verification' : 'passwordless login'}:
                    </p>

                    <!-- OTP Code Box -->
                    <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
                      <tr>
                        <td align="center" style="padding: 12px 0 24px 0;">
                          <div style="background-color: #020617; border: 1px solid #0d9488; border-radius: 12px; padding: 20px 32px; display: inline-block; text-align: center;">
                            <span style="font-family: 'Courier New', Courier, monospace; font-size: 38px; font-weight: 900; letter-spacing: 10px; color: #2dd4bf; text-shadow: 0 0 10px rgba(45, 212, 191, 0.3);">
                              ${code}
                            </span>
                          </div>
                        </td>
                      </tr>
                    </table>

                    <p style="margin: 0 0 16px 0; font-size: 13px; line-height: 1.5; color: #64748b; text-align: center;">
                      ⏰ This code will expire in <strong style="color: #cbd5e1;">10 minutes</strong>.
                    </p>

                    <p style="margin: 0; font-size: 12px; line-height: 1.5; color: #64748b; text-align: center; background-color: #020617; padding: 12px; border-radius: 8px; border: 1px solid #1e293b;">
                      🔒 If you did not request this verification code, please ignore this email.
                    </p>
                  </td>
                </tr>

                <!-- Footer -->
                <tr>
                  <td style="padding: 20px 32px; background-color: #020617; border-top: 1px solid #1e293b; text-align: center;">
                    <p style="margin: 0; font-size: 11px; color: #475569;">
                      © ${new Date().getFullYear()} vop.x Voice Orchestration Platform. All rights reserved.
                    </p>
                  </td>
                </tr>

              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    try {
      const info = await mailTransporter.sendMail({
        from: `"vop.x Voice Platform" <${config.from}>`,
        to: trimmedEmail,
        subject,
        html: htmlContent,
      });
      console.log(`[SMTP] Successfully delivered OTP email to ${trimmedEmail} (MessageId: ${info.messageId})`);
      return true;
    } catch (err: any) {
      console.error('[SMTP Send Error]:', err?.message || err);
    }
  } else {
    console.warn('[SMTP Warning]: SMTP is not fully configured in environment variables.');
  }

  // 2. Fallback: Resend API if configured
  const resendApiKey = process.env.RESEND_API_KEY;
  if (resendApiKey && resendApiKey.startsWith('re_')) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'vop.x Voice Platform <onboarding@resend.dev>',
          to: trimmedEmail,
          subject: purpose === 'signup' ? 'Verify your email - vop.x OTP' : 'Your Login Code - vop.x OTP',
          html: `<p>Your vop.x verification code is <strong>${code}</strong>. It expires in 10 minutes.</p>`,
        }),
      });

      if (!res.ok) {
        console.error('[Resend API Error Response]:', await res.text());
      } else {
        console.log(`[Resend] Successfully delivered OTP email to ${trimmedEmail}`);
        return true;
      }
    } catch (err: any) {
      console.error('[Resend Fetch Error]:', err?.message || err);
    }
  }

  return false;
}
