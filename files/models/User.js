// models/User.js
const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

const enrolledPackageSchema = new mongoose.Schema({
  packageId:   { type: Number, required: true },
  packageName: { type: String, required: true },
  amount:      { type: Number, required: true },   // in paise
  enrolledAt:  { type: Date,   default: Date.now },
}, { _id: false });

const userSchema = new mongoose.Schema({
  name: {
    type:     String,
    required: [true, 'Name is required'],
    trim:     true,
    maxlength: [100, 'Name too long'],
  },
  email: {
    type:      String,
    required:  [true, 'Email is required'],
    unique:    true,
    lowercase: true,
    trim:      true,
    match:     [/^\S+@\S+\.\S+$/, 'Invalid email format'],
  },
  phone: {
    type:  String,
    trim:  true,
    match: [/^\d{10,15}$/, 'Invalid phone number'],
  },
  password: {
    type:      String,
    required:  [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters'],
    select:    false,   // never returned in queries by default
  },
  role: {
    type:    String,
    enum:    ['user', 'admin'],
    default: 'user',
  },
  enrolledPackages: {
    type:    [enrolledPackageSchema],
    default: [],
  },
  isActive: { type: Boolean, default: true },
}, {
  timestamps: true,   // createdAt, updatedAt
});

// ── Hash password before save ─────────────────────────
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  try {
    const salt    = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err) { next(err); }
});

// ── Instance method: compare password ─────────────────
userSchema.methods.comparePassword = async function (plainText) {
  return bcrypt.compare(plainText, this.password);
};

// ── Instance method: safe public object ───────────────
userSchema.methods.toPublic = function () {
  return {
    _id:              this._id,
    name:             this.name,
    email:            this.email,
    phone:            this.phone,
    role:             this.role,
    enrolledPackages: this.enrolledPackages,
    createdAt:        this.createdAt,
  };
};

// ── Index ─────────────────────────────────────────────


module.exports = mongoose.model('User', userSchema);


