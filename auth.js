const express = require('express');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const User = require('./User');
const { requireAuth } = require('./requireAuth');
const router = express.Router();

const LINKEDIN_AUTH_URL = 'https://www.linkedin.com/oauth/v2/authorization';
const LINKEDIN_TOKEN_URL = 'https://www.linkedin.com/oauth/v2/accessToken';
const LINKEDIN_SCOPE = 'openid profile email w_member_social';

// Step 1: Redirect user to LinkedIn
router.get('/linkedin', (req, res) => {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: process.env.LINKEDIN_CLIENT_ID,
    redirect_uri: process.env.LINKEDIN_REDIRECT_URI,
    scope: LINKEDIN_SCOPE,
    state: Math.random().toString(36).substring(7),
  });
  res.redirect(`${LINKEDIN_AUTH_URL}?${params}`);
});

// Step 2: LinkedIn redirects back with a code
router.get('/linkedin/callback', async (req, res) => {
  const { code, error } = req.query;

  if (error) {
    return res.redirect(`${process.env.CLIENT_URL}?error=linkedin_denied`);
  }

  try {
    const tokenRes = await axios.post(LINKEDIN_TOKEN_URL, null, {
      params: {
        grant_type: 'authorization_code',
        code,
        redirect_uri: process.env.LINKEDIN_REDIRECT_URI,
        client_id: process.env.LINKEDIN_CLIENT_ID,
        client_secret: process.env.LINKEDIN_CLIENT_SECRET,
      },
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });

    const { access_token, expires_in } = tokenRes.data;

    const profileRes = await axios.get('https://api.linkedin.com/v2/userinfo', {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    const { sub: linkedinId, name, email } = profileRes.data;

    const user = await User.findOneAndUpdate(
      { linkedinId },
      {
        linkedinId,
        name,
        email,
        linkedinAccessToken: access_token,
        linkedinTokenExpiry: new Date(Date.now() + expires_in * 1000),
      },
      { upsert: true, new: true }
    );

    // Issue JWT — avoids cross-origin cookie issues
    const token = jwt.sign(
      { userId: user._id.toString() },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.redirect(`${process.env.CLIENT_URL}/dashboard?token=${token}`);
  } catch (err) {
    console.error('LinkedIn OAuth error:', err.response?.data || err.message);
    res.redirect(`${process.env.CLIENT_URL}?error=oauth_failed`);
  }
});

// Get current logged-in user
router.get('/me', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('-linkedinAccessToken');
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Logout (stateless — client deletes token from localStorage)
router.post('/logout', (req, res) => {
  res.json({ message: 'Logged out' });
});

module.exports = router;
