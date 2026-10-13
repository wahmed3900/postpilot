const cron = require('node-cron');
const axios = require('axios');
const Post = require('../models/Post');
const User = require('../models/User');

// Publish a post to LinkedIn
async function publishToLinkedIn(post, user) {
  // First get the LinkedIn member URN
  const profileRes = await axios.get('https://api.linkedin.com/v2/userinfo', {
    headers: { Authorization: `Bearer ${user.linkedinAccessToken}` },
  });
  const authorUrn = `urn:li:person:${profileRes.data.sub}`;

  // Create the post via LinkedIn API
  await axios.post(
    'https://api.linkedin.com/v2/ugcPosts',
    {
      author: authorUrn,
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': {
          shareCommentary: { text: post.text },
          shareMediaCategory: 'NONE',
        },
      },
      visibility: {
        'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC',
      },
    },
    {
      headers: {
        Authorization: `Bearer ${user.linkedinAccessToken}`,
        'Content-Type': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0',
      },
    }
  );
}

// Run every minute — check for posts due to be published
function startScheduler() {
  cron.schedule('* * * * *', async () => {
    const now = new Date();

    // Find all scheduled posts due now or overdue
    const duePosts = await Post.find({
      status: 'scheduled',
      scheduledAt: { $lte: now },
    });

    for (const post of duePosts) {
      try {
        const user = await User.findById(post.userId);
        if (!user) throw new Error('User not found');

        if (post.platform === 'linkedin') {
          await publishToLinkedIn(post, user);
        }
        // TikTok handler goes here in Week 2

        post.status = 'published';
        await post.save();
        console.log(`✅ Published post ${post._id} to ${post.platform}`);
      } catch (err) {
        post.status = 'failed';
        post.errorMessage = err.response?.data?.message || err.message;
        await post.save();
        console.error(`❌ Failed post ${post._id}:`, post.errorMessage);
      }
    }
  });

  console.log('📅 Post scheduler running');
}

module.exports = { startScheduler };
