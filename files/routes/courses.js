// routes/courses.js
const express = require('express');
const Course  = require('../models/Course');
const { protect, adminOnly } = require('../middleware/auth');

const router = express.Router();

// ── Fallback courses (shown if DB is empty) ───────────
const FALLBACK_COURSES = [
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

// ── GET /api/courses ─────────────────────────────────
router.get('/', async (req, res, next) => {
  try {
    const courses = await Course.find({ isActive: true }).sort({ createdAt: -1 });
    if (courses.length === 0) {
      return res.json({ courses: FALLBACK_COURSES, source: 'fallback' });
    }
    return res.json({ courses, source: 'db' });
  } catch (err) {
    // On DB error, return fallback so frontend never breaks
    console.error('[Courses] DB error, serving fallback:', err.message);
    return res.json({ courses: FALLBACK_COURSES, source: 'fallback' });
  }
});

// ── POST /api/courses  (admin: add a course) ──────────
router.post('/', protect, adminOnly, async (req, res, next) => {
  try {
    const { name, tag, thumbnail, description } = req.body;
    if (!name) return res.status(400).json({ error: 'Course name is required.' });

    const course = await Course.create({ name, tag, thumbnail, description });
    return res.status(201).json({ message: 'Course created.', course });
  } catch (err) {
    next(err);
  }
});

// ── DELETE /api/courses/:id  (admin) ─────────────────
router.delete('/:id', protect, adminOnly, async (req, res, next) => {
  try {
    await Course.findByIdAndDelete(req.params.id);
    return res.json({ message: 'Course deleted.' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
