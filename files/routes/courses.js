const express = require('express');
const Course  = require('../models/Course');
const { protect, restrictToAdmin } = require('../middleware/auth');

const router = express.Router();

// Fallback courses if DB is empty — matches frontend COURSES array
const DEFAULT_COURSES = [
  { name: 'AFFILIATE MARKETING',     tag: 'Marketing',    thumbnail: { url: 'https://images.unsplash.com/photo-1563986768609-322da13575f3?w=400&auto=format&fit=crop&q=80' } },
  { name: 'INSTAGRAM MARKETING',     tag: 'Social Media', thumbnail: { url: 'https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=400&auto=format&fit=crop&q=80' } },
  { name: 'GRAPHIC DESIGNING',       tag: 'Design',       thumbnail: { url: 'https://images.unsplash.com/photo-1561070791-2526d30994b5?w=400&auto=format&fit=crop&q=80' } },
  { name: 'VIDEO EDITING',           tag: 'Creative',     thumbnail: { url: 'https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?w=400&auto=format&fit=crop&q=80' } },
  { name: 'FACEBOOK ADS',            tag: 'Advertising',  thumbnail: { url: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=400&auto=format&fit=crop&q=80' } },
  { name: 'GOOGLE ADS',              tag: 'Advertising',  thumbnail: { url: 'https://images.unsplash.com/photo-1573804633927-bfcbcd909acd?w=400&auto=format&fit=crop&q=80' } },
  { name: 'YOUTUBE MASTERY',         tag: 'Content',      thumbnail: { url: 'https://images.unsplash.com/photo-1611162616305-c69b3fa7fbe0?w=400&auto=format&fit=crop&q=80' } },
  { name: 'CONTENT CREATION',        tag: 'Creative',     thumbnail: { url: 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=400&auto=format&fit=crop&q=80' } },
  { name: 'SOCIAL MEDIA MANAGEMENT', tag: 'Social Media', thumbnail: { url: 'https://images.unsplash.com/photo-1542744173-8e7e53415bb0?w=400&auto=format&fit=crop&q=80' } },
  { name: 'DROP SHIPPING',           tag: 'eCommerce',    thumbnail: { url: 'https://images.unsplash.com/photo-1563013544-824ae1b704d3?w=400&auto=format&fit=crop&q=80' } },
  { name: 'FREELANCING',             tag: 'Career',       thumbnail: { url: 'https://images.unsplash.com/photo-1498049794561-7780e7231661?w=400&auto=format&fit=crop&q=80' } },
  { name: 'WHATSAPP MARKETING',      tag: 'Marketing',    thumbnail: { url: 'https://images.unsplash.com/photo-1611944212129-29977ae1398c?w=400&auto=format&fit=crop&q=80' } },
];

// ══ GET /api/courses ══════════════════════════════════════════════
// Public — returns all active courses (seeded defaults if DB empty)
router.get('/', async (_req, res) => {
  try {
    let courses = await Course.find({ isActive: true }).sort({ order: 1, createdAt: 1 });

    // Seed defaults on first run
    if (courses.length === 0) {
      courses = await Course.insertMany(DEFAULT_COURSES.map((c, i) => ({ ...c, order: i })));
    }

    res.json({ courses });
  } catch (err) {
    console.error('[courses GET]', err.message);
    // Graceful fallback — frontend also has local array
    res.status(500).json({ courses: DEFAULT_COURSES, error: 'DB unavailable, using defaults.' });
  }
});

// ══ POST /api/courses ══════════════════════════════════════════════
// Admin only — add a course
router.post('/', protect, restrictToAdmin, async (req, res) => {
  try {
    const { name, tag, description, level, thumbnail } = req.body;
    if (!name || !tag) return res.status(400).json({ error: 'Name and tag are required.' });

    const course = await Course.create({ name, tag, description, level, thumbnail });
    res.status(201).json({ course });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ══ PUT /api/courses/:id ══════════════════════════════════════════
router.put('/:id', protect, restrictToAdmin, async (req, res) => {
  try {
    const course = await Course.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!course) return res.status(404).json({ error: 'Course not found.' });
    res.json({ course });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ══ DELETE /api/courses/:id ═══════════════════════════════════════
router.delete('/:id', protect, restrictToAdmin, async (req, res) => {
  try {
    await Course.findByIdAndUpdate(req.params.id, { isActive: false });
    res.json({ message: 'Course deactivated.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

