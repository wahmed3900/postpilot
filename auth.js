const express = require('express');
const axios = require('axios');
const User = require('../models/User');
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
    state: Math.random().toString(36).substring(7), // CSRF protection
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
    // Exchange code for access token
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

    // Get LinkedIn profile info
    const profileRes = await axios.get('https://api.linkedin.com/v2/userinfo', {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    const { sub: linkedinId, name, email } = profileRes.data;

    // Upsert user in DB
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

    // Save user to session
    req.session.userId = user._id;

    res.redirect(`${process.env.CLIENT_URL}/dashboard`);
  } catch (err) {
    console.error('LinkedIn OAuth error:', err.response?.data || err.message);
    res.redirect(`${process.env.CLIENT_URL}?error=oauth_failed`);
  }
});

// Get current logged-in user
router.get('/me', async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  const user = await User.findById(req.session.userId).select('-linkedinAccessToken');
  res.json(user);
});

// Logout
router.post('/logout', (req, res) => {
  req.session.destroy();
  res.json({ message: 'Logged out' });
});

module.exports = router;
