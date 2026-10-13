const express = require('express');
const Post = require('../models/Post');
const { requireAuth } = require('../middleware/requireAuth');
const router = express.Router();

// Create a scheduled post
router.post('/', requireAuth, async (req, res) => {
  const { text, platform, scheduledAt } = req.body;

  if (!text || !scheduledAt) {
    return res.status(400).json({ error: 'text and scheduledAt are required' });
  }

  if (new Date(scheduledAt) <= new Date()) {
    return res.status(400).json({ error: 'scheduledAt must be in the future' });
  }

  const post = await Post.create({
    userId: req.session.userId,
    text,
    platform: platform || 'linkedin',
    scheduledAt: new Date(scheduledAt),
  });

  res.status(201).json(post);
});

// Get all posts for the logged-in user
router.get('/', requireAuth, async (req, res) => {
  const posts = await Post.find({ userId: req.session.userId })
    .sort({ scheduledAt: 1 });
  res.json(posts);
});

// Delete a scheduled post
router.delete('/:id', requireAuth, async (req, res) => {
  const post = await Post.findOneAndDelete({
    _id: req.params.id,
    userId: req.session.userId,
    status: 'scheduled', // can't delete already published
  });
  if (!post) return res.status(404).json({ error: 'Post not found or already published' });
  res.json({ message: 'Post deleted' });
});

module.exports = router;
