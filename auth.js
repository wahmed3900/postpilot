require('dotenv').config();
const express = require('express');
const router = express.Router();
const axios = require('axios');
const jwt = require('jsonwebtoken');

const CLIENT_ID = process.env.LINKEDIN_CLIENT_ID;
const CLIENT_SECRET = process.env.LINKEDIN_CLIENT_SECRET;
const REDIRECT_URI = process.env.LINKEDIN_REDIRECT_URI || 'https://postpilot-tr8j.onrender.com/auth/linkedin/callback';
const CLIENT_URL = process.env.CLIENT_URL || 'https://postpilot-frontend-zeta.vercel.app';
const JWT_SECRET = process.env.JWT_SECRET || process.env.SESSION_SECRET;

// ── Helpers ──────────────────────────────────────────────────────────────────

function signToken(user) {
  return jwt.sign(
    { linkedinId: user.linkedinId, name: user.name, email: user.email, photo: user.photo },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

// Middleware — attach req.user from Bearer token if present
function optionalAuth(req, res, next) {
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) {
    try {
      req.user = jwt.verify(header.slice(7), JWT_SECRET);
    } catch {
      req.user = null;
    }
  }
  next();
}

// Middleware — require valid JWT
function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) return res.status(401).json({ error: 'Not authenticated' });
  try {
    req.user = jwt.verify(header.slice(7), JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Token expired or invalid' });
  }
}

// ── Routes ───────────────────────────────────────────────────────────────────

// Step 1 — Redirect user to LinkedIn
router.get('/linkedin', (req, res) => {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    scope: 'openid profile email w_member_social',
  });
  res.redirect(`https://www.linkedin.com/oauth/v2/authorization?${params}`);
});

// Step 2 — LinkedIn calls back here with ?code=
router.get('/linkedin/callback', async (req, res) => {
  const { code, error } = req.query;

  if (error || !code) {
    return res.redirect(`${CLIENT_URL}/?error=${encodeURIComponent(error || 'oauth_failed')}`);
  }

  try {
    // Exchange code for access token
    const tokenRes = await axios.post(
      'https://www.linkedin.com/oauth/v2/accessToken',
      new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: REDIRECT_URI,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
      }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    const { access_token, id_token } = tokenRes.data;

    // Decode id_token (OpenID Connect) to get basic profile
    // Or fetch profile via userinfo endpoint
    const userInfoRes = await axios.get('https://api.linkedin.com/v2/userinfo', {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    const li = userInfoRes.data;
    const user = {
      linkedinId: li.sub,
      name: li.name || `${li.given_name || ''} ${li.family_name || ''}`.trim(),
      email: li.email || '',
      photo: li.picture || '',
      accessToken: access_token,
    };

    // Issue our own JWT so the frontend can stay stateless
    const token = signToken(user);

    // Redirect to frontend dashboard with token
    res.redirect(`${CLIENT_URL}/dashboard?token=${encodeURIComponent(token)}`);
  } catch (err) {
    console.error('LinkedIn callback error:', err.response?.data || err.message);
    res.redirect(`${CLIENT_URL}/?error=auth_failed`);
  }
});

// GET /auth/me — verify token and return user
router.get('/me', requireAuth, (req, res) => {
  const { linkedinId, name, email, photo } = req.user;
  res.json({ linkedinId, name, email, photo });
});

// GET /auth/logout — client handles clearing localStorage; this is a no-op
router.get('/logout', (req, res) => {
  res.json({ ok: true });
});

module.exports = { router, requireAuth, optionalAuth };
