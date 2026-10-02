const nodemailer = require('nodemailer');
require('dotenv').config();

async function testSmtp() {
  console.log('=== TESTING SMTP ===');
  console.log('SMTP_HOST:', process.env.SMTP_HOST);
  console.log('SMTP_USER:', process.env.SMTP_USER);
  console.log('SMTP_PASS:', process.env.SMTP_PASS ? 'SET (length ' + process.env.SMTP_PASS.length + ')' : 'NOT SET');

  const rawPass = process.env.SMTP_PASS || '';
  const cleanPass = rawPass.replace(/\s+/g, '');

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_HOST_PORT || '587', 10),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: cleanPass
    }
  });

  try {
    const verified = await transporter.verify();
    console.log('✅ SMTP Connection Verified successfully:', verified);
  } catch (err) {
    console.error('❌ SMTP Verify Error:', err.message);
  }
}

async function testResend() {
  console.log('\n=== TESTING RESEND ===');
  const apiKey = process.env.RESEND_API_KEY;
  console.log('RESEND_API_KEY:', apiKey ? apiKey.substring(0, 8) + '...' : 'NOT SET');
  if (!apiKey) return;

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'onboarding@resend.dev',
        to: 'delivered@resend.dev',
        subject: 'Test Resend OTP',
        html: '<p>Test code: 123456</p>'
      })
    });
    console.log('Resend Response Status:', res.status, await res.json());
  } catch (err) {
    console.error('❌ Resend Error:', err.message);
  }
}

async function run() {
  await testSmtp();
  await testResend();
}

run();
