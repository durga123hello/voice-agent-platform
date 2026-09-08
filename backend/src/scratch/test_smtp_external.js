const nodemailer = require('nodemailer');
require('dotenv').config();

async function main() {
  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = parseInt(process.env.SMTP_HOST_PORT || '587', 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const target = 'durgapriyadarshiniraj@gmail.com';

  console.log(`Sending SMTP test email to: ${target}`);

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass }
  });

  try {
    const info = await transporter.sendMail({
      from: `"SMTP External Test" <${user}>`,
      to: target,
      subject: 'SMTP External Configuration Test',
      text: 'If you receive this, your SMTP settings can send to external email addresses!'
    });
    console.log('SUCCESS! External email sent.');
    console.log('Message ID:', info.messageId);
  } catch (error) {
    console.error('SMTP External Error:', error);
  }
}

main();
