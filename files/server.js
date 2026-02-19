require('dotenv').config();
const path      = require('path');
const express   = require('express');
const mongoose  = require('mongoose');
const cors      = require('cors');
const helmet    = require('helmet');
const rateLimit = require('express-rate-limit');
const morgan    = require('morgan');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: '*', methods: ['GET','POST','PUT','DELETE','OPTIONS'], credentials: true }));
app.options('*', cors());

app.use('/api/auth', rateLimit({ windowMs: 15*60*1000, max: 20, message: { error: 'Too many requests.' } }));
app.use('/api/payments', rateLimit({ windowMs: 10*60*1000, max: 30, message: { error: 'Too many requests.' } }));

app.use('/api/payments/webhook', express.raw({ type: 'application/json' }));
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

app.get('/health', (_, res) => res.json({ status: 'ok', time: new Date() }));

app.use('/api/auth',     require('./routes/auth'));
app.use('/api/courses',  require('./routes/courses'));
app.use('/api/payments', require('./routes/payments'));

app.use(express.static(path.join(__dirname)));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

app.use((err, req, res, next) => {
  console.error('[ERROR]', err.message || err);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error.' });
});

if (!process.env.MONGO_URI) {
  console.error('❌ MONGO_URI is not set.');
  process.exit(1);
}

mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('✅ MongoDB connected');
    app.listen(PORT, () => console.log('🚀 Server running on port ' + PORT));
  })
  .catch(err => {
    console.error('❌ MongoDB connection failed:', err.message);
    process.exit(1);
  });

module.exports = app;
