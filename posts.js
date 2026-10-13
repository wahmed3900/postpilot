require('dotenv').config();
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

// ── Schema ────────────────────────────────────────────────────────────────────

const postSchema = new mongoose.Schema({
  linkedinId: { type: String, required: true, index: true },
  text:       { type: String, required: true },       // matches frontend field name
  scheduledAt: { type: Date, required: true },
  platform:   { type: String, default: 'linkedin' },
  status:     { type: String, enum: ['scheduled', 'published', 'failed'], default: 'scheduled' },
  linkedinPostId: { type: String },                   // filled after publishing
  error:      { type: String },                       // filled on failure
}, { timestamps: true });

const Post = mongoose.models.Post || mongoose.model('Post', postSchema);

// ── Routes ────────────────────────────────────────────────────────────────────

// GET /api/posts — list this user's posts
router.get('/', async (req, res) => {
  try {
    const posts = await Post.find({ linkedinId: req.user.linkedinId })
      .sort({ scheduledAt: 1 })
      .lean();
    res.json(posts);
  } catch (err) {
    console.error('GET /api/posts error:', err);
    res.status(500).json({ error: 'Failed to fetch posts' });
  }
});

// POST /api/posts — schedule a new post
router.post('/', async (req, res) => {
  const { text, scheduledAt, platform } = req.body;

  if (!text || !text.trim()) {
    return res.status(400).json({ error: 'text is required' });
  }
  if (!scheduledAt) {
    return res.status(400).json({ error: 'scheduledAt is required' });
  }

  const scheduledDate = new Date(scheduledAt);
  if (isNaN(scheduledDate.getTime())) {
    return res.status(400).json({ error: 'scheduledAt must be a valid date' });
  }
  if (scheduledDate <= new Date()) {
    return res.status(400).json({ error: 'scheduledAt must be in the future' });
  }

  try {
    const post = await Post.create({
      linkedinId: req.user.linkedinId,
      text: text.trim(),
      scheduledAt: scheduledDate,
      platform: platform || 'linkedin',
      status: 'scheduled',
    });
    res.status(201).json(post);
  } catch (err) {
    console.error('POST /api/posts error:', err);
    res.status(500).json({ error: 'Failed to create post' });
  }
});

// DELETE /api/posts/:id — delete a scheduled post
router.delete('/:id', async (req, res) => {
  try {
    const post = await Post.findOne({
      _id: req.params.id,
      linkedinId: req.user.linkedinId,   // scoped to this user
    });

    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }
    if (post.status !== 'scheduled') {
      return res.status(400).json({ error: 'Only scheduled posts can be deleted' });
    }

    await post.deleteOne();
    res.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/posts/:id error:', err);
    res.status(500).json({ error: 'Failed to delete post' });
  }
});

module.exports = { router, Post };
