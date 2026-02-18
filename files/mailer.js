const nodemailer = require('nodemailer');

// ── Create reusable transporter ────────────────────────────────────
function createTransporter() {
  return nodemailer.createTransport({
    host:   process.env.SMTP_HOST || 'smtp.gmail.com',
    port:   Number(process.env.SMTP_PORT) || 587,
    secure: false, // true for port 465
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

// ── Send Enrollment Confirmation Email ────────────────────────────
async function sendEnrollmentEmail(user, payment) {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn('[mailer] SMTP not configured — skipping email.');
    return;
  }

  const transporter = createTransporter();
  const amountINR   = (payment.amount / 100).toLocaleString('en-IN');

  const html = `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="UTF-8"/>
    <style>
      body { font-family: Arial, sans-serif; background: #f4f4f4; margin: 0; padding: 0; }
      .wrapper { max-width: 600px; margin: 40px auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.1); }
      .header { background: linear-gradient(135deg, #f97316, #fbbf24); padding: 36px; text-align: center; }
      .header h1 { color: #fff; font-size: 28px; margin: 0; letter-spacing: -1px; }
      .header p  { color: rgba(255,255,255,0.9); margin: 8px 0 0; font-size: 15px; }
      .body { padding: 36px; }
      .body h2 { color: #1a1a1a; font-size: 22px; margin-bottom: 12px; }
      .body p  { color: #555; line-height: 1.7; font-size: 15px; }
      .detail-box { background: #fef9f5; border: 1px solid #fde68a; border-radius: 8px; padding: 20px; margin: 24px 0; }
      .detail-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #fde68a; font-size: 14px; }
      .detail-row:last-child { border-bottom: none; font-weight: bold; color: #f97316; }
      .detail-label { color: #777; }
      .detail-value { color: #1a1a1a; font-weight: 600; }
      .cta { text-align: center; margin: 28px 0; }
      .cta a { background: linear-gradient(135deg, #f97316, #fb923c); color: #fff; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 700; font-size: 15px; }
      .footer { background: #f9fafb; padding: 24px; text-align: center; color: #999; font-size: 13px; border-top: 1px solid #eee; }
      .footer a { color: #f97316; }
    </style>
  </head>
  <body>
    <div class="wrapper">
      <div class="header">
        <h1>🎓 Skillbrzee</h1>
        <p>India's Trusted Learning Platform</p>
      </div>
      <div class="body">
        <h2>Congratulations, ${user.name}! 🎉</h2>
        <p>
          You have successfully enrolled in <strong>${payment.packageName}</strong>.
          Your payment has been confirmed and your learning journey starts now!
        </p>

        <div class="detail-box">
          <div class="detail-row">
            <span class="detail-label">Package</span>
            <span class="detail-value">${payment.packageName}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Payment ID</span>
            <span class="detail-value">${payment.razorpayPaymentId}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Date</span>
            <span class="detail-value">${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Amount Paid</span>
            <span class="detail-value">₹${amountINR}</span>
          </div>
        </div>

        <p>Our team will reach out to you within 24 hours with your course access details. You can also reach us at any time:</p>
        <p>📞 9573472183 &nbsp;|&nbsp; ✉️ support@skillbrzee.in</p>

        <div class="cta">
          <a href="https://skillbrzee.in">Visit Skillbrzee →</a>
        </div>
      </div>
      <div class="footer">
        <p>© 2026 Skillbrzee | Hyderabad, Telangana, India</p>
        <p><a href="https://skillbrzee.in/privacy">Privacy Policy</a> · <a href="https://skillbrzee.in/refund">Refund Policy</a></p>
      </div>
    </div>
  </body>
  </html>`;

  await transporter.sendMail({
    from:    process.env.EMAIL_FROM || 'Skillbrzee <support@skillbrzee.in>',
    to:      user.email,
    subject: `✅ Enrollment Confirmed — ${payment.packageName} | Skillbrzee`,
    html,
  });

  console.log(`[mailer] Enrollment email sent to ${user.email}`);
}

// ── Send Welcome / OTP email (extensible) ─────────────────────────
async function sendWelcomeEmail(user) {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) return;

  const transporter = createTransporter();
  await transporter.sendMail({
    from:    process.env.EMAIL_FROM || 'Skillbrzee <support@skillbrzee.in>',
    to:      user.email,
    subject: `Welcome to Skillbrzee, ${user.name}! 🚀`,
    html: `<p>Hi ${user.name}, welcome aboard! Start exploring our courses at skillbrzee.in</p>`,
  });
}

module.exports = { sendEnrollmentEmail, sendWelcomeEmail };
