const express  = require('express');
const crypto   = require('crypto');
const Razorpay = require('razorpay');
const Payment  = require('../models/Payment');
const User     = require('../models/User');
const { protect } = require('../middleware/auth');
const { sendEnrollmentEmail } = require('../utils/mailer');

const router = express.Router();

// Package catalogue — matches frontend PACKAGES array exactly
const PACKAGES = {
  1: { name: 'STARTER PACKAGE',  priceINR: 500   },
  2: { name: 'BASIC PACKAGE',    priceINR: 1499  },
  3: { name: 'SILVER PACKAGE',   priceINR: 2999  },
  4: { name: 'GOLD PACKAGE',     priceINR: 5499  },
  5: { name: 'DIAMOND PACKAGE',  priceINR: 9999  },
  6: { name: 'PREMIUM PACKAGE',  priceINR: 14999 },
};

function devPaymentsEnabled() {
  return process.env.ENABLE_DEV_PAYMENTS === 'true' && process.env.NODE_ENV !== 'production';
}

// Lazily create Razorpay instance (so server still boots without keys)
function getRazorpay() {
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    throw new Error('Razorpay credentials not configured in .env');
  }
  return new Razorpay({
    key_id:     process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });
}

async function enrollUserForPayment(userId, payment, razorpayPaymentId = '') {
  const user = await User.findById(userId);
  if (!user) throw new Error('User not found.');

  const alreadyEnrolled = user.enrolledPackages?.some((ep) => ep.packageId === payment.packageId);
  if (!alreadyEnrolled) {
    user.enrolledPackages.push({
      packageId:   payment.packageId,
      packageName: payment.packageName,
      enrolledAt:  new Date(),
      paymentId:   razorpayPaymentId || payment.razorpayPaymentId || '',
    });
    await user.save({ validateBeforeSave: false });
  }

  sendEnrollmentEmail(user, payment).catch((err) =>
    console.error('[mailer] Failed to send enrollment email:', err.message)
  );

  return user;
}

// ══ POST /api/payments/create-order ═══════════════════════════════
// Creates a Razorpay order and a pending Payment document
router.post('/create-order', protect, async (req, res) => {
  try {
    const { packageId } = req.body;
    const pkg = PACKAGES[packageId];

    if (!pkg) {
      return res.status(400).json({ error: 'Invalid package selected.' });
    }

    // Check if already enrolled
    const alreadyEnrolled = req.user.enrolledPackages?.some(
      (ep) => ep.packageId === Number(packageId)
    );
    if (alreadyEnrolled) {
      return res.status(400).json({ error: 'You are already enrolled in this package.' });
    }

    const amountPaise = pkg.priceINR * 100; // Razorpay uses paise

    // Save pending payment record
    const payment = await Payment.create({
      userId:      req.user._id,
      packageId:   Number(packageId),
      packageName: pkg.name,
      amount:      amountPaise,
      status:      'created',
    });

    // Dev-only mode: allow end-to-end flow without Razorpay keys
    if ((!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) && devPaymentsEnabled()) {
      return res.json({
        mock:       true,
        orderId:     `order_mock_${payment._id}`,
        amount:      amountPaise,
        currency:    'INR',
        keyId:       'rzp_dev_mock',
        paymentId:   payment._id,
        packageName: pkg.name,
        prefill: {
          name:    req.user.name,
          email:   req.user.email,
          contact: req.user.phone,
        },
      });
    }

    const razorpay = getRazorpay();

    // Create Razorpay order
    const order = await razorpay.orders.create({
      amount:   amountPaise,
      currency: 'INR',
      receipt:  `sb_${req.user._id}_${packageId}_${Date.now()}`,
      notes: {
        userId:      String(req.user._id),
        packageId:   String(packageId),
        packageName: pkg.name,
      },
    });

    await Payment.findByIdAndUpdate(payment._id, { razorpayOrderId: order.id }, { new: false });

    res.json({
      orderId:     order.id,
      amount:      amountPaise,
      currency:    'INR',
      keyId:       process.env.RAZORPAY_KEY_ID,
      paymentId:   payment._id,         // our internal ID for verify step
      packageName: pkg.name,
      prefill: {
        name:    req.user.name,
        email:   req.user.email,
        contact: req.user.phone,
      },
    });
  } catch (err) {
    console.error('[create-order]', err.message);
    res.status(500).json({ error: err.message || 'Could not create payment order.' });
  }
});

// ══ POST /api/payments/dev-confirm ════════════════════════════════
// Dev-only: marks a created payment as paid and enrolls user (no Razorpay)
router.post('/dev-confirm', protect, async (req, res) => {
  try {
    if (!devPaymentsEnabled()) {
      return res.status(404).json({ error: 'Not found.' });
    }

    const { paymentId } = req.body;
    if (!paymentId) return res.status(400).json({ error: 'paymentId is required.' });

    const payment = await Payment.findOne({ _id: paymentId, userId: req.user._id });
    if (!payment) return res.status(404).json({ error: 'Payment record not found.' });

    if (payment.status === 'paid') {
      return res.json({ success: true, message: 'Already confirmed.', packageName: payment.packageName });
    }

    payment.status = 'paid';
    payment.razorpayPaymentId = `dev_${Date.now()}`;
    await payment.save();

    await enrollUserForPayment(req.user._id, payment, payment.razorpayPaymentId);

    res.json({ success: true, message: 'Dev payment confirmed. Enrollment updated.', packageName: payment.packageName });
  } catch (err) {
    console.error('[dev-confirm]', err.message);
    res.status(500).json({ error: 'Server error during dev confirmation.' });
  }
});

// ══ POST /api/payments/verify ═════════════════════════════════════
// Verifies Razorpay signature, marks payment as paid, enrolls user
router.post('/verify', protect, async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      paymentId,            // our internal Payment _id
    } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !paymentId) {
      return res.status(400).json({ error: 'Missing payment verification fields.' });
    }

    // ── Verify HMAC signature ──────────────────────────────────────
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      // Mark payment as failed
      await Payment.findByIdAndUpdate(paymentId, {
        status:       'failed',
        errorMessage: 'Signature mismatch',
        razorpayPaymentId: razorpay_payment_id,
      });
      return res.status(400).json({ error: 'Payment verification failed. Signature mismatch.' });
    }

    // ── Update payment record ──────────────────────────────────────
    const payment = await Payment.findByIdAndUpdate(
      paymentId,
      {
        status:            'paid',
        razorpayPaymentId: razorpay_payment_id,
        razorpaySignature: razorpay_signature,
        razorpayOrderId:   razorpay_order_id,
      },
      { new: true }
    );

    if (!payment) {
      return res.status(404).json({ error: 'Payment record not found.' });
    }

    await enrollUserForPayment(req.user._id, payment, razorpay_payment_id);

    res.json({
      success:     true,
      message:     'Payment verified. Enrollment confirmed!',
      packageName: payment.packageName,
      paymentId:   razorpay_payment_id,
    });
  } catch (err) {
    console.error('[verify]', err.message);
    res.status(500).json({ error: 'Server error during payment verification.' });
  }
});

// ══ GET /api/payments/my-payments ════════════════════════════════
// Returns all payments for the logged-in user
router.get('/my-payments', protect, async (req, res) => {
  try {
    const payments = await Payment.find({ userId: req.user._id }).sort({ createdAt: -1 });
    res.json({ payments });
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

module.exports = router;

