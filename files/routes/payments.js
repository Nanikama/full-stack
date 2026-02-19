// routes/payments.js
const express   = require('express');
const crypto    = require('crypto');
const Razorpay  = require('razorpay');
const { body, validationResult } = require('express-validator');
const { protect }  = require('../middleware/auth');
const Payment      = require('../models/Payment');
const User         = require('../models/User');
const { sendEnrollmentEmail } = require('../config/email');

const router = express.Router();

// ── Razorpay instance ─────────────────────────────────
let razorpay;
if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
  razorpay = new Razorpay({
    key_id:     process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });
} else {
  console.warn('⚠️  Razorpay keys not set — running in MOCK/DEV mode');
}

// ── Package catalogue (mirrors frontend) ──────────────
const PACKAGES = {
  1: { name: 'STARTER PACKAGE',  price: 50000  },   // ₹500   (paise)
  2: { name: 'BASIC PACKAGE',    price: 149900 },   // ₹1,499
  3: { name: 'SILVER PACKAGE',   price: 299900 },   // ₹2,999
  4: { name: 'GOLD PACKAGE',     price: 549900 },   // ₹5,499
  5: { name: 'DIAMOND PACKAGE',  price: 999900 },   // ₹9,999
  6: { name: 'PREMIUM PACKAGE',  price: 1499900},   // ₹14,999
};

// ────────────────────────────────────────────────────────
//  POST /api/payments/create-order
//  Creates a Razorpay order (or mock order in dev mode)
// ────────────────────────────────────────────────────────
router.post('/create-order',
  protect,
  [body('packageId').isInt({ min: 1, max: 6 }).withMessage('Invalid packageId')],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(422).json({ error: errors.array()[0].msg });
      }

      const { packageId } = req.body;
      const pkg = PACKAGES[packageId];
      if (!pkg) return res.status(400).json({ error: 'Unknown package.' });

      // Check if already enrolled
      const alreadyEnrolled = req.user.enrolledPackages.some(
        ep => Number(ep.packageId) === Number(packageId)
      );
      if (alreadyEnrolled) {
        return res.status(409).json({ error: `You are already enrolled in ${pkg.name}.` });
      }

      // ── DEV / MOCK mode (no Razorpay keys) ──────────
      if (!razorpay) {
        const payment = await Payment.create({
          userId:      req.user._id,
          packageId,
          packageName: pkg.name,
          amount:      pkg.price,
          status:      'pending',
          isMock:      true,
        });
        return res.json({
          mock:        true,
          paymentId:   payment._id,
          packageName: pkg.name,
          amount:      pkg.price,
        });
      }

      // ── Real Razorpay order ──────────────────────────
      const order = await razorpay.orders.create({
        amount:   pkg.price,
        currency: 'INR',
        receipt:  `sb_${Date.now()}_${req.user._id}`,
        notes:    { userId: String(req.user._id), packageId: String(packageId) },
      });

      // Persist pending payment record
      const payment = await Payment.create({
        userId:          req.user._id,
        packageId,
        packageName:     pkg.name,
        amount:          pkg.price,
        razorpayOrderId: order.id,
        status:          'pending',
      });

      return res.json({
        orderId:     order.id,
        keyId:       process.env.RAZORPAY_KEY_ID,
        amount:      pkg.price,
        packageName: pkg.name,
        paymentId:   payment._id,
        prefill: {
          name:    req.user.name,
          email:   req.user.email,
          contact: req.user.phone || '',
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

// ────────────────────────────────────────────────────────
//  POST /api/payments/verify
//  Called by frontend after Razorpay success callback
// ────────────────────────────────────────────────────────
router.post('/verify',
  protect,
  [
    body('razorpay_order_id').notEmpty(),
    body('razorpay_payment_id').notEmpty(),
    body('razorpay_signature').notEmpty(),
    body('paymentId').notEmpty(),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(422).json({ error: errors.array()[0].msg });
      }

      const {
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
        paymentId,
      } = req.body;

      // ── Verify HMAC signature ────────────────────────
      const expectedSig = crypto
        .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
        .update(`${razorpay_order_id}|${razorpay_payment_id}`)
        .digest('hex');

      if (expectedSig !== razorpay_signature) {
        await Payment.findByIdAndUpdate(paymentId, { status: 'failed' });
        return res.status(400).json({ error: 'Payment verification failed — signature mismatch.' });
      }

      // ── Mark payment as paid ─────────────────────────
      const payment = await Payment.findByIdAndUpdate(
        paymentId,
        {
          status:            'paid',
          razorpayPaymentId: razorpay_payment_id,
          razorpaySignature: razorpay_signature,
        },
        { new: true }
      );
      if (!payment) return res.status(404).json({ error: 'Payment record not found.' });

      // ── Enroll user ──────────────────────────────────
      await enrollUser(payment);

      return res.json({ message: 'Payment verified. Enrollment confirmed!' });
    } catch (err) {
      next(err);
    }
  }
);

// ────────────────────────────────────────────────────────
//  POST /api/payments/dev-confirm
//  Confirms a mock/dev payment without Razorpay
// ────────────────────────────────────────────────────────
router.post('/dev-confirm', protect, async (req, res, next) => {
  try {
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({ error: 'Dev endpoint disabled in production.' });
    }

    const { paymentId } = req.body;
    if (!paymentId) return res.status(400).json({ error: 'paymentId required.' });

    const payment = await Payment.findOneAndUpdate(
      { _id: paymentId, userId: req.user._id, isMock: true, status: 'pending' },
      { status: 'paid', razorpayPaymentId: `mock_${Date.now()}` },
      { new: true }
    );
    if (!payment) return res.status(404).json({ error: 'Mock payment not found.' });

    await enrollUser(payment);

    return res.json({ message: 'Dev payment confirmed. Enrollment complete.' });
  } catch (err) {
    next(err);
  }
});

// ────────────────────────────────────────────────────────
//  POST /api/payments/webhook
//  Razorpay webhook (raw body — registered in server.js)
// ────────────────────────────────────────────────────────
router.post('/webhook', async (req, res) => {
  try {
    const sig       = req.headers['x-razorpay-signature'];
    const secret    = process.env.RAZORPAY_WEBHOOK_SECRET;
    const body      = req.body;   // raw Buffer

    if (secret && sig) {
      const expected = crypto
        .createHmac('sha256', secret)
        .update(body)
        .digest('hex');
      if (expected !== sig) {
        return res.status(400).json({ error: 'Invalid webhook signature.' });
      }
    }

    const event   = JSON.parse(body.toString());
    const payload = event?.payload?.payment?.entity;

    if (event.event === 'payment.captured' && payload) {
      const payment = await Payment.findOne({ razorpayOrderId: payload.order_id });
      if (payment && payment.status !== 'paid') {
        payment.status            = 'paid';
        payment.razorpayPaymentId = payload.id;
        payment.webhookEvents.push(event.event);
        await payment.save();
        await enrollUser(payment);
      }
    }

    if (event.event === 'payment.failed' && payload) {
      await Payment.findOneAndUpdate(
        { razorpayOrderId: payload.order_id, status: 'pending' },
        { status: 'failed', $push: { webhookEvents: event.event } }
      );
    }

    return res.json({ received: true });
  } catch (err) {
    console.error('[Webhook]', err);
    return res.status(500).json({ error: 'Webhook processing error.' });
  }
});

// ────────────────────────────────────────────────────────
//  GET /api/payments/my-payments
//  Returns logged-in user's payment history
// ────────────────────────────────────────────────────────
router.get('/my-payments', protect, async (req, res, next) => {
  try {
    const payments = await Payment
      .find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    return res.json({ payments });
  } catch (err) {
    next(err);
  }
});

// ────────────────────────────────────────────────────────
//  Helper: enroll user after confirmed payment
// ────────────────────────────────────────────────────────
async function enrollUser(payment) {
  const user = await User.findById(payment.userId);
  if (!user) return;

  // Avoid duplicate enrollments
  const alreadyEnrolled = user.enrolledPackages.some(
    ep => Number(ep.packageId) === Number(payment.packageId)
  );
  if (alreadyEnrolled) return;

  user.enrolledPackages.push({
    packageId:   payment.packageId,
    packageName: payment.packageName,
    amount:      payment.amount,
    enrolledAt:  new Date(),
  });
  await user.save();

  // Send confirmation email (non-blocking)
  sendEnrollmentEmail({
    name:        user.name,
    email:       user.email,
    packageName: payment.packageName,
    amount:      payment.amount,
  }).catch(e => console.warn('[Email] Enrollment email failed:', e.message));
}

module.exports = router;
