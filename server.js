require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const { router: authRouter, requireAuth } = require('./auth');
const { router: postsRouter } = require('./posts');

const app = express();
const PORT = process.env.PORT || 3000;

// ── CORS ──────────────────────────────────────────────────────────────────────
const CLIENT_URL = process.env.CLIENT_URL || 'https://postpilot-frontend-zeta.vercel.app';

app.use(cors({
  origin: [CLIENT_URL, 'http://localhost:3000', 'http://localhost:5173'],
  credentials: false,   // no cookies — we use Bearer tokens
}));

app.use(express.json());

// ── MongoDB ───────────────────────────────────────────────────────────────────
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => { console.error('MongoDB connection error:', err); process.exit(1); });

// ── Routes ────────────────────────────────────────────────────────────────────
app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.use('/auth', authRouter);
app.use('/api/posts', requireAuth, postsRouter);   // all post routes require JWT

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => console.log(`PostPilot backend listening on port ${PORT}`));
