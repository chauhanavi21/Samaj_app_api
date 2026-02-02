const express = require('express');
const { Webhook } = require('svix');
const User = require('../models/User');
const FamilyTree = require('../models/FamilyTree');
const { protect } = require('../middleware/clerkAuth');

const router = express.Router();

// @route   POST /api/auth/webhook
// @desc    Handle Clerk webhooks (user created, updated, deleted)
// @access  Public (verified by webhook secret)
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;

    if (!WEBHOOK_SECRET) {
      console.error('❌ CLERK_WEBHOOK_SECRET is not configured');
      return res.status(500).json({
        success: false,
        message: 'Webhook secret not configured',
      });
    }

    // Get Svix headers
    const svix_id = req.headers['svix-id'];
    const svix_timestamp = req.headers['svix-timestamp'];
    const svix_signature = req.headers['svix-signature'];

    if (!svix_id || !svix_timestamp || !svix_signature) {
      return res.status(400).json({
        success: false,
        message: 'Missing svix headers',
      });
    }

    // Get the raw body
    const payload = req.body;

    // Verify webhook
    const wh = new Webhook(WEBHOOK_SECRET);
    let evt;

    try {
      evt = wh.verify(payload, {
        'svix-id': svix_id,
        'svix-timestamp': svix_timestamp,
        'svix-signature': svix_signature,
      });
    } catch (err) {
      console.error('❌ Webhook verification failed:', err.message);
      return res.status(400).json({
        success: false,
        message: 'Webhook verification failed',
      });
    }

    // Handle different webhook events
    const eventType = evt.type;
    console.log(`\n=== CLERK WEBHOOK: ${eventType} ===`);

    switch (eventType) {
      case 'user.created':
        await handleUserCreated(evt.data);
        break;

      case 'user.updated':
        await handleUserUpdated(evt.data);
        break;

      case 'user.deleted':
        await handleUserDeleted(evt.data);
        break;

      default:
        console.log('Unhandled event type:', eventType);
    }

    console.log('=== WEBHOOK PROCESSED ===\n');
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({
      success: false,
      message: 'Webhook processing failed',
    });
  }
});

// Handle user created event
async function handleUserCreated(data) {
  try {
    const clerkId = data.id;
    const email = data.email_addresses[0]?.email_address;
    const name = `${data.first_name || ''} ${data.last_name || ''}`.trim() || 'User';
    
    // Get custom fields from metadata
    const memberId = data.public_metadata?.memberId || data.unsafe_metadata?.memberId;
    const phone = data.public_metadata?.phone || data.unsafe_metadata?.phone || '';

    if (!memberId) {
      console.error('❌ Member ID not found in user metadata');
      return;
    }

    console.log('Creating user in MongoDB:', { clerkId, email, name, memberId });

    // Check if user already exists
    const existingUser = await User.findOne({ clerkId });
    if (existingUser) {
      console.log('User already exists in MongoDB');
      return;
    }

    // Determine if user is admin
    const adminEmails = process.env.ADMIN_EMAILS?.split(',').map(e => e.trim()) || [];
    const role = adminEmails.includes(email.toLowerCase()) ? 'admin' : 'user';

    // Create user in MongoDB
    const user = await User.create({
      clerkId,
      name,
      email,
      phone,
      memberId,
      role,
    });

    console.log('✅ User created in MongoDB:', user._id);

    // Automatically create Family Tree entry
    try {
      await FamilyTree.create({
        createdBy: user._id,
        personName: name,
        personPhone: phone,
      });
      console.log('✅ Family Tree entry created automatically');
    } catch (familyTreeError) {
      console.log('⚠️ Failed to create Family Tree entry:', familyTreeError.message);
    }
  } catch (error) {
    console.error('❌ Error handling user.created:', error);
    throw error;
  }
}

// Handle user updated event
async function handleUserUpdated(data) {
  try {
    const clerkId = data.id;
    const email = data.email_addresses[0]?.email_address;
    const name = `${data.first_name || ''} ${data.last_name || ''}`.trim();
    const phone = data.public_metadata?.phone || data.unsafe_metadata?.phone;

    console.log('Updating user in MongoDB:', clerkId);

    const updateData = {
      email,
      updatedAt: Date.now(),
    };

    if (name) updateData.name = name;
    if (phone) updateData.phone = phone;

    const user = await User.findOneAndUpdate(
      { clerkId },
      updateData,
      { new: true }
    );

    if (user) {
      console.log('✅ User updated in MongoDB');
    } else {
      console.log('⚠️ User not found in MongoDB');
    }
  } catch (error) {
    console.error('❌ Error handling user.updated:', error);
    throw error;
  }
}

// Handle user deleted event
async function handleUserDeleted(data) {
  try {
    const clerkId = data.id;

    console.log('Deleting user from MongoDB:', clerkId);

    const user = await User.findOneAndDelete({ clerkId });

    if (user) {
      console.log('✅ User deleted from MongoDB');
      
      // Optionally delete associated Family Tree entries
      await FamilyTree.deleteMany({ createdBy: user._id });
      console.log('✅ Family Tree entries deleted');
    } else {
      console.log('⚠️ User not found in MongoDB');
    }
  } catch (error) {
    console.error('❌ Error handling user.deleted:', error);
    throw error;
  }
}

// @route   GET /api/auth/me
// @desc    Get current user
// @access  Private
router.get('/me', protect, async (req, res) => {
  try {
    res.json({
      success: true,
      user: {
        id: req.user._id,
        name: req.user.name,
        email: req.user.email,
        role: req.user.role,
        phone: req.user.phone,
        memberId: req.user.memberId,
      },
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
});

// @route   POST /api/auth/sync
// @desc    Manually sync user from Clerk (for development/testing)
// @access  Public (in dev mode)
router.post('/sync', async (req, res) => {
  try {
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({
        success: false,
        message: 'This endpoint is only available in development',
      });
    }

    const { clerkId, email, name, phone, memberId } = req.body;

    if (!clerkId || !email || !name || !memberId) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: clerkId, email, name, memberId',
      });
    }

    // Check if user exists
    let user = await User.findOne({ clerkId });

    if (user) {
      // Update existing user
      user.name = name;
      user.email = email;
      user.phone = phone || user.phone;
      user.memberId = memberId;
      await user.save();
      
      return res.json({
        success: true,
        message: 'User updated successfully',
        user: {
          id: user._id,
          clerkId: user.clerkId,
          name: user.name,
          email: user.email,
          memberId: user.memberId,
        },
      });
    }

    // Create new user
    const adminEmails = process.env.ADMIN_EMAILS?.split(',').map(e => e.trim()) || [];
    const role = adminEmails.includes(email.toLowerCase()) ? 'admin' : 'user';

    user = await User.create({
      clerkId,
      name,
      email,
      phone,
      memberId,
      role,
    });

    // Create Family Tree entry
    await FamilyTree.create({
      createdBy: user._id,
      personName: name,
      personPhone: phone || '',
    });

    res.status(201).json({
      success: true,
      message: 'User synced successfully',
      user: {
        id: user._id,
        clerkId: user.clerkId,
        name: user.name,
        email: user.email,
        memberId: user.memberId,
      },
    });
  } catch (error) {
    console.error('Sync error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to sync user',
    });
  }
});

module.exports = router;
