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

    const razorpay   = getRazorpay();
    const amountPaise = pkg.priceINR * 100; // Razorpay uses paise

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

    // Save pending payment record
    const payment = await Payment.create({
      userId:          req.user._id,
      packageId:       Number(packageId),
      packageName:     pkg.name,
      amount:          amountPaise,
      razorpayOrderId: order.id,
      status:          'created',
    });

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
      },
      { new: true }
    );

    if (!payment) {
      return res.status(404).json({ error: 'Payment record not found.' });
    }

    // ── Enroll user in package ─────────────────────────────────────
    const user = await User.findById(req.user._id);
    const alreadyEnrolled = user.enrolledPackages?.some(
      (ep) => ep.packageId === payment.packageId
    );

    if (!alreadyEnrolled) {
      user.enrolledPackages.push({
        packageId:   payment.packageId,
        packageName: payment.packageName,
        enrolledAt:  new Date(),
        paymentId:   razorpay_payment_id,
      });
      await user.save({ validateBeforeSave: false });
    }

    // ── Send confirmation email (non-blocking) ─────────────────────
    sendEnrollmentEmail(user, payment).catch((err) =>
      console.error('[mailer] Failed to send enrollment email:', err.message)
    );

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
