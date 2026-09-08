const nodemailer = require('nodemailer');
require('dotenv').config();

async function main() {
  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = parseInt(process.env.SMTP_HOST_PORT || '587', 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  console.log(`Testing SMTP with:`);
  console.log(`Host: ${host}`);
  console.log(`Port: ${port}`);
  console.log(`User: ${user}`);
  console.log(`Password length: ${pass ? pass.length : 0}`);

  if (!user || !pass) {
    console.error('Error: SMTP_USER or SMTP_PASS not set in .env');
    return;
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass }
  });

  try {
    console.log('Attempting to send test email...');
    const info = await transporter.sendMail({
      from: `"SMTP Test" <${user}>`,
      to: user,
      subject: 'SMTP Configuration Test',
      text: 'If you receive this, your SMTP settings are working perfectly!'
    });
    console.log('SUCCESS! Email sent.');
    console.log('Message ID:', info.messageId);
  } catch (error) {
    console.error('SMTP Error details:', error);
  }
}

main();
