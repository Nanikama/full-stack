// routes/auth.js
const express            = require('express');
const jwt                = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const User               = require('../models/User');
const { protect }        = require('../middleware/auth');
const { sendWelcomeEmail } = require('../config/email');

const router = express.Router();

// ── Helper: sign JWT ──────────────────────────────────
function signToken(userId) {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
}

// ── Validation rules ──────────────────────────────────
const registerValidation = [
  body('name')
    .trim().notEmpty().withMessage('Name is required')
    .isLength({ max: 100 }).withMessage('Name too long'),
  body('email')
    .normalizeEmail().isEmail().withMessage('Invalid email'),
  body('phone')
    .trim().notEmpty().withMessage('Phone is required')
    .matches(/^\d{10,15}$/).withMessage('Phone must be 10–15 digits'),
  body('password')
    .isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
];

const loginValidation = [
  body('email').normalizeEmail().isEmail().withMessage('Invalid email'),
  body('password').notEmpty().withMessage('Password is required'),
];

// ── POST /api/auth/register ───────────────────────────
router.post('/register', registerValidation, async (req, res, next) => {
  try {
    // Validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({ error: errors.array()[0].msg });
    }

    const { name, email, phone, password } = req.body;

    // Check duplicate email
    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }

    // Create user (password hashed by pre-save hook in model)
    const user  = await User.create({ name, email, phone, password });
    const token = signToken(user._id);

    // Send welcome email (non-blocking — don't crash on SMTP failure)
    sendWelcomeEmail({ name: user.name, email: user.email }).catch(e =>
      console.warn('[Email] Welcome send failed:', e.message)
    );

    return res.status(201).json({
      message:     'Account created successfully.',
      accessToken: token,
      user:        user.toPublic(),
    });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/auth/login ──────────────────────────────
router.post('/login', loginValidation, async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({ error: errors.array()[0].msg });
    }

    const { email, password } = req.body;

    // Fetch user WITH password (select: false by default)
    const user = await User.findOne({ email }).select('+password');
    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const token = signToken(user._id);

    return res.json({
      message:     'Login successful.',
      accessToken: token,
      user:        user.toPublic(),
    });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/auth/me ──────────────────────────────────
// Returns current user from JWT — used by frontend on page load
router.get('/me', protect, async (req, res) => {
  // req.user already populated by protect middleware (no password)
  return res.json({ user: req.user.toPublic() });
});

// ── PUT /api/auth/me ──────────────────────────────────
// Update profile (name, phone)
router.put('/me', protect, [
  body('name').optional().trim().notEmpty().withMessage('Name cannot be empty'),
  body('phone').optional().matches(/^\d{10,15}$/).withMessage('Invalid phone'),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({ error: errors.array()[0].msg });
    }

    const allowed = ['name', 'phone'];
    const updates = {};
    allowed.forEach(f => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });

    const user = await User.findByIdAndUpdate(req.user._id, updates, {
      new: true, runValidators: true,
    });

    return res.json({ message: 'Profile updated.', user: user.toPublic() });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
