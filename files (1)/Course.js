const mongoose = require('mongoose');

const courseSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    tag:  { type: String, required: true, trim: true },
    thumbnail: {
      url:      { type: String, default: '' },
      publicId: { type: String, default: '' },
    },
    description: { type: String, default: '' },
    level:       { type: String, enum: ['Beginner', 'Intermediate', 'Advanced', 'All Levels'], default: 'All Levels' },
    isActive:    { type: Boolean, default: true },
    order:       { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Course', courseSchema);
