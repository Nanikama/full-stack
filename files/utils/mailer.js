// config/email.js
const nodemailer = require('nodemailer');

// ── Create transporter ────────────────────────────────
const transporter = nodemailer.createTransport({
  host:   process.env.SMTP_HOST || 'smtp.gmail.com',
  port:   Number(process.env.SMTP_PORT) || 465,
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// ── Verify connection (on startup, optional) ──────────
transporter.verify().then(() => {
  console.log('📧 SMTP connection verified');
}).catch(err => {
  console.warn('⚠️  SMTP not configured or failed:', err.message);
});

// ── Generic send helper ───────────────────────────────
async function sendMail({ to, subject, html, text }) {
  if (!process.env.SMTP_USER) {
    console.log(`[EMAIL SKIP] To: ${to} | Subject: ${subject}`);
    return;
  }
  return transporter.sendMail({
    from:    process.env.EMAIL_FROM || '"Skillbrzee" <support@skillbrzee.in>',
    to, subject, html, text,
  });
}

// ── Welcome email after registration ─────────────────
async function sendWelcomeEmail({ name, email }) {
  await sendMail({
    to:      email,
    subject: `Welcome to Skillbrzee, ${name}! 🎉`,
    html: `
      <div style="font-family:sans-serif;max-width:560px;margin:auto;background:#0a1628;color:#eef2ff;padding:32px;border-radius:12px;">
        <h1 style="color:#f97316;font-size:1.8rem;margin-bottom:8px;">Welcome to Skillbrzee! 🚀</h1>
        <p style="color:#94a3b8;margin-bottom:20px;">Hi <strong style="color:#eef2ff">${name}</strong>,</p>
        <p style="color:#94a3b8;line-height:1.7;">
          Your account has been successfully created. You're now part of India's trusted learning platform. 
          Start your digital journey today and unlock new skills!
        </p>
        <a href="${process.env.APP_URL || 'https://skillbrzee.in'}" 
           style="display:inline-block;margin-top:24px;background:linear-gradient(135deg,#f97316,#fb923c);color:#fff;padding:13px 28px;border-radius:10px;text-decoration:none;font-weight:700;">
          Explore Courses →
        </a>
        <hr style="border-color:rgba(255,255,255,.08);margin:28px 0;"/>
        <p style="color:#64748b;font-size:.78rem;">
          If you didn't create this account, please contact 
          <a href="mailto:${process.env.SUPPORT_EMAIL}" style="color:#f97316;">${process.env.SUPPORT_EMAIL}</a>
        </p>
      </div>`,
    text: `Welcome to Skillbrzee, ${name}! Your account is ready. Visit ${process.env.APP_URL}`,
  });
}

// ── Enrollment confirmation email ─────────────────────
async function sendEnrollmentEmail({ name, email, packageName, amount }) {
  const amountFormatted = `₹${(amount / 100).toLocaleString('en-IN')}`;
  await sendMail({
    to:      email,
    subject: `🎓 Enrolled in ${packageName} — Skillbrzee`,
    html: `
      <div style="font-family:sans-serif;max-width:560px;margin:auto;background:#0a1628;color:#eef2ff;padding:32px;border-radius:12px;">
        <h1 style="color:#f97316;font-size:1.6rem;margin-bottom:8px;">Enrollment Confirmed! 🎓</h1>
        <p style="color:#94a3b8;">Hi <strong style="color:#eef2ff">${name}</strong>,</p>
        <p style="color:#94a3b8;line-height:1.7;">
          Your enrollment in <strong style="color:#f97316">${packageName}</strong> has been confirmed. 
          You now have <strong style="color:#eef2ff">lifetime access</strong> to all course materials.
        </p>
        <div style="background:#111e33;border:1px solid rgba(249,115,22,.2);border-radius:10px;padding:16px 20px;margin:24px 0;">
          <p style="margin:0;color:#94a3b8;font-size:.88rem;">Package: <strong style="color:#f97316">${packageName}</strong></p>
          <p style="margin:8px 0 0;color:#94a3b8;font-size:.88rem;">Amount Paid: <strong style="color:#22c55e">${amountFormatted}</strong></p>
        </div>
        <a href="${process.env.APP_URL || 'https://skillbrzee.in'}" 
           style="display:inline-block;background:linear-gradient(135deg,#f97316,#fb923c);color:#fff;padding:13px 28px;border-radius:10px;text-decoration:none;font-weight:700;">
          Start Learning →
        </a>
        <hr style="border-color:rgba(255,255,255,.08);margin:28px 0;"/>
        <p style="color:#64748b;font-size:.78rem;">
          Need help? Contact us at 
          <a href="mailto:${process.env.SUPPORT_EMAIL}" style="color:#f97316;">${process.env.SUPPORT_EMAIL}</a> 
          or call 9573472183.
        </p>
      </div>`,
    text: `Enrollment confirmed! You are now enrolled in ${packageName} (${amountFormatted}). Visit ${process.env.APP_URL}`,
  });
}

module.exports = { sendWelcomeEmail, sendEnrollmentEmail };
