const express = require('express');
const Post = require('./Post');
const { requireAuth } = require('./requireAuth');
const router = express.Router();

router.post('/', requireAuth, async (req, res) => {
  const { text, platform, scheduledAt } = req.body;
  if (!text || !scheduledAt) return res.status(400).json({ error: 'text and scheduledAt are required' });
  if (new Date(scheduledAt) <= new Date()) return res.status(400).json({ error: 'scheduledAt must be in the future' });
  const post = await Post.create({ userId: req.user.userId, text, platform: platform || 'linkedin', scheduledAt: new Date(scheduledAt) });
  res.status(201).json(post);
});

router.get('/', requireAuth, async (req, res) => {
  const posts = await Post.find({ userId: req.user.userId }).sort({ scheduledAt: 1 });
  res.json(posts);
});

router.delete('/:id', requireAuth, async (req, res) => {
  const post = await Post.findOneAndDelete({ _id: req.params.id, userId: req.user.userId, status: 'scheduled' });
  if (!post) return res.status(404).json({ error: 'Post not found or already published' });
  res.json({ message: 'Post deleted' });
});

module.exports = router;
