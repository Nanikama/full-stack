const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: Number(process.env.SMTP_PORT) || 465,
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

transporter.verify().then(() => {
  console.log('📧 SMTP connection verified');
}).catch(err => {
  console.warn('SMTP not configured:', err.message);
});

async function sendMail({ to, subject, html, text }) {
  if (!process.env.SMTP_USER) {
    console.log('[EMAIL SKIP] To: ' + to + ' | Subject: ' + subject);
    return;
  }
  return transporter.sendMail({
    from: process.env.EMAIL_FROM || 'Skillbrzee <support@skillbrzee.in>',
    to: to,
    subject: subject,
    html: html,
    text: text,
  });
}

async function sendWelcomeEmail({ name, email }) {
  await sendMail({
    to: email,
    subject: 'Welcome to Skillbrzee!',
    html: '<div style="font-family:sans-serif;padding:32px;background:#0a1628;color:#eef2ff;border-radius:12px;"><h1 style="color:#f97316;">Welcome to Skillbrzee!</h1><p>Hi ' + name + ',</p><p>Your account has been created successfully. Start your digital journey today!</p><a href="' + (process.env.APP_URL || 'https://skillbrzee.in') + '" style="display:inline-block;margin-top:24px;background:#f97316;color:#fff;padding:13px 28px;border-radius:10px;text-decoration:none;font-weight:700;">Explore Courses</a></div>',
    text: 'Welcome to Skillbrzee, ' + name + '! Visit ' + (process.env.APP_URL || 'https://skillbrzee.in'),
  });
}

async function sendEnrollmentEmail({ name, email, packageName, amount }) {
  var amountFormatted = '₹' + (amount / 100).toLocaleString('en-IN');
  await sendMail({
    to: email,
    subject: 'Enrolled in ' + packageName + ' - Skillbrzee',
    html: '<div style="font-family:sans-serif;padding:32px;background:#0a1628;color:#eef2ff;border-radius:12px;"><h1 style="color:#f97316;">Enrollment Confirmed!</h1><p>Hi ' + name + ',</p><p>Your enrollment in <strong>' + packageName + '</strong> is confirmed. You now have lifetime access.</p><p>Amount Paid: <strong>' + amountFormatted + '</strong></p><a href="' + (process.env.APP_URL || 'https://skillbrzee.in') + '" style="display:inline-block;margin-top:24px;background:#f97316;color:#fff;padding:13px 28px;border-radius:10px;text-decoration:none;font-weight:700;">Start Learning</a></div>',
    text: 'Enrolled in ' + packageName + ' (' + amountFormatted + '). Visit ' + (process.env.APP_URL || 'https://skillbrzee.in'),
  });
}

module.exports = { sendWelcomeEmail, sendEnrollmentEmail };
