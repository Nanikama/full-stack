const express  = require('express');
const User     = require('../models/User');
const { signToken, protect } = require('../middleware/auth');

const router = express.Router();

// ══ POST /api/auth/register ════════════════════════════════════════
router.post('/register', async (req, res) => {
  try {
    const { name, email, phone, password } = req.body;

    if (!name || !email || !phone || !password) {
      return res.status(400).json({ error: 'All fields are required.' });
    }

    // Check duplicate email
    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(409).json({ error: 'Email already registered. Please log in.' });
    }

    const user  = await User.create({ name, email, phone, password });
    const token = signToken(user._id);

    res.status(201).json({
      message:     'Account created successfully.',
      accessToken: token,
      user: {
        id:    user._id,
        name:  user.name,
        email: user.email,
        phone: user.phone,
        role:  user.role,
      },
    });
  } catch (err) {
    console.error('[register]', err.message);
    res.status(500).json({ error: 'Server error. Please try again.' });
  }
});

// ══ POST /api/auth/login ══════════════════════════════════════════
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const user = await User.findOne({ email }).select('+password');
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    if (!user.isActive) {
      return res.status(403).json({ error: 'Account is disabled. Contact support.' });
    }

    // Update lastLoginAt
    user.lastLoginAt = new Date();
    await user.save({ validateBeforeSave: false });

    const token = signToken(user._id);

    res.json({
      message:     'Login successful.',
      accessToken: token,
      user: {
        id:    user._id,
        name:  user.name,
        email: user.email,
        phone: user.phone,
        role:  user.role,
        enrolledPackages: user.enrolledPackages,
      },
    });
  } catch (err) {
    console.error('[login]', err.message);
    res.status(500).json({ error: 'Server error. Please try again.' });
  }
});

// ══ GET /api/auth/me ═════════════════════════════════════════════
// Returns the logged-in user's profile (protected)
router.get('/me', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ error: 'User not found.' });
    res.json({ user });
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

module.exports = router;
