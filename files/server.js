require('dotenv').config();
const express  = require('express');
const cors     = require('cors');
const mongoose = require('mongoose');
const path     = require('path');

// ── Route imports ───────────────────────────────────────────────────
const authRoutes     = require('./routes/auth');
const courseRoutes   = require('./routes/courses');
const paymentRoutes  = require('./routes/payments');

const app  = express();
const PORT = process.env.PORT || 5000;

// ════════════════════════════════════════════════════════════════════
//  MIDDLEWARE
// ════════════════════════════════════════════════════════════════════

// CORS — allow the Skillbrzee frontend (file:// for local dev OR domain)
const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:3000',
  'http://localhost:5500',    // VS Code Live Server
  'http://127.0.0.1:5500',
  'http://localhost:3000',
  'https://skillbrzee.in',
  'https://www.skillbrzee.in',
];

app.use(
  cors({
    origin: (origin, cb) => {
      // Allow requests with no origin (mobile apps, Postman, curl)
      // Also allow `Origin: null` (when opening the frontend as file://)
      if (!origin || origin === 'null' || allowedOrigins.includes(origin)) return cb(null, true);
      cb(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
  })
);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logger (dev only)
if (process.env.NODE_ENV !== 'production') {
  app.use((req, _res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
  });
}

// ════════════════════════════════════════════════════════════════════
//  ROUTES
// ════════════════════════════════════════════════════════════════════
const frontendFile = path.join(__dirname, '..', 'skillbrzee-frontend.html');
app.get(['/', '/index.html'], (_req, res) => {
  res.sendFile(frontendFile, (err) => {
    if (err) res.status(404).send('Frontend file not found. Expected skillbrzee-frontend.html in project root.');
  });
});

app.use('/api/auth',     authRoutes);
app.use('/api/courses',  courseRoutes);
app.use('/api/payments', paymentRoutes);

// Health-check
app.get('/api/health', (_req, res) => {
  res.json({
    status:    'ok',
    timestamp: new Date().toISOString(),
    db:        mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
  });
});

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found.' });
});

// Global error handler
app.use((err, _req, res, _next) => {
  console.error('[Global Error]', err.message);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error.' });
});

// ════════════════════════════════════════════════════════════════════
//  DATABASE + START
// ════════════════════════════════════════════════════════════════════
async function resolveMongoUri() {
  const configured = process.env.MONGODB_URI;

  const shouldUseMemory =
    process.env.USE_IN_MEMORY_DB === 'true' ||
    !configured ||
    configured.trim().length === 0;

  if (shouldUseMemory) {
    const { MongoMemoryServer } = require('mongodb-memory-server');
    const mongo = await MongoMemoryServer.create();
    const uri = mongo.getUri();
    console.log('🧪 Using in-memory MongoDB:', uri);
    return uri;
  }

  return configured;
}

async function startServer() {
  try {
    const uri = await resolveMongoUri();

    try {
      await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
    } catch (err) {
      // If local Mongo isn't running, fall back to in-memory for dev
      if (process.env.NODE_ENV !== 'production') {
        const { MongoMemoryServer } = require('mongodb-memory-server');
        const mongo = await MongoMemoryServer.create();
        const memUri = mongo.getUri();
        console.warn('⚠️  MongoDB connection failed, falling back to in-memory:', err.message);
        await mongoose.connect(memUri, { serverSelectionTimeoutMS: 5000 });
        console.log('🧪 In-memory MongoDB connected:', memUri);
      } else {
        throw err;
      }
    }

    console.log('✅ MongoDB connected.');

    app.listen(PORT, () => {
      console.log(`🚀 Skillbrzee running on http://localhost:${PORT}/`);
      console.log(`   API: http://localhost:${PORT}/api`);
      console.log(`   NODE_ENV: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (err) {
    console.error('❌ MongoDB connection failed:', err.message);
    console.error('   Make sure MongoDB is running or MONGODB_URI is correct in .env');
    process.exit(1);
  }
}

startServer();
