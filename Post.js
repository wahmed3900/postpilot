const mongoose = require('mongoose');

const postSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  text: { type: String, required: true },
  platform: {
    type: String,
    enum: ['linkedin', 'tiktok'],
    default: 'linkedin',
  },
  scheduledAt: { type: Date, required: true },
  status: {
    type: String,
    enum: ['scheduled', 'published', 'failed'],
    default: 'scheduled',
  },
  linkedinPostId: String, // returned by LinkedIn after publishing
  errorMessage: String,
}, { timestamps: true });

module.exports = mongoose.model('Post', postSchema);
