const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  linkedinId: { type: String, required: true, unique: true },
  name: String,
  email: String,
  linkedinAccessToken: String,
  linkedinTokenExpiry: Date,
  plan: {
    type: String,
    enum: ['free', 'starter', 'growth'],
    default: 'free',
  },
  stripeCustomerId: String,
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
