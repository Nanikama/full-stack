const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema(
  {
    userId:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    packageId:   { type: Number, required: true },
    packageName: { type: String, required: true },
    amount:      { type: Number, required: true },       // in paise (INR * 100)
    currency:    { type: String, default: 'INR' },
    status:      {
      type: String,
      enum: ['created', 'paid', 'failed', 'refunded'],
      default: 'created',
    },
    // Razorpay IDs
    razorpayOrderId:   { type: String },
    razorpayPaymentId: { type: String },
    razorpaySignature: { type: String },
    // Error info
    errorCode:    { type: String },
    errorMessage: { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Payment', paymentSchema);
