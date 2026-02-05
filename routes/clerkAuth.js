const express = require('express');

// Clerk is no longer used in this project.
// This route is kept as a safe placeholder so any accidental deployment
// doesn’t crash due to missing Clerk/Svix dependencies.

const router = express.Router();

router.all('*', (req, res) => {
  return res.status(410).json({
    success: false,
    message: 'Clerk integration has been removed. Use /api/auth (JWT) endpoints instead.',
  });
});

/*
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
    const adminEmails = (process.env.ADMIN_EMAILS ?? '')
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
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
// @route   POST /api/auth/sync
// @desc    Sync user from Clerk to MongoDB (creates if doesn't exist)
// @access  Public (requires Clerk data in body)
router.post('/sync', async (req, res) => {
  try {
    const { clerkId, email, name, phone, memberId } = req.body;

    console.log('\n=== SYNC USER REQUEST ===');
    console.log('ClerkID:', clerkId);
    console.log('Email:', email);
    console.log('Name:', name);
    console.log('MemberID:', memberId);

    if (!clerkId || !email || !name) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: clerkId, email, name',
      });
    }

    // Check if user exists
    let user = await User.findOne({ clerkId });

    if (user) {
      // Update existing user
      console.log('✅ User found, updating...');
      user.name = name;
      user.email = email;
      if (phone) user.phone = phone;
      if (memberId) user.memberId = memberId;
      await user.save();
      
      console.log('✅ User updated successfully');
      console.log('=== SYNC COMPLETE ===\n');
      
      return res.json({
        success: true,
        message: 'User updated successfully',
        user: {
          id: user._id,
          clerkId: user.clerkId,
          name: user.name,
          email: user.email,
          phone: user.phone,
          memberId: user.memberId,
          role: user.role,
        },
      });
    }

    // Create new user
    console.log('⚡ User not found, creating new user...');
    const adminEmails = process.env.ADMIN_EMAILS?.split(',').map(e => e.trim()) || [];
    const role = adminEmails.includes(email.toLowerCase()) ? 'admin' : 'user';

    user = await User.create({
      clerkId,
      name,
      email,
      phone: phone || '',
      memberId: memberId || '',
      role,
    });

    console.log('✅ User created:', user._id);

    // Create Family Tree entry
    try {
      await FamilyTree.create({
        createdBy: user._id,
        personName: name,
        personPhone: phone || '',
      });
      console.log('✅ Family Tree entry created');
    } catch (familyErr) {
      console.log('⚠️ Family Tree creation failed:', familyErr.message);
    }

    console.log('=== SYNC COMPLETE ===\n');

    res.status(201).json({
      success: true,
      message: 'User synced successfully',
      user: {
        id: user._id,
        clerkId: user.clerkId,
        name: user.name,
        email: user.email,
        phone: user.phone,
        memberId: user.memberId,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('❌ Sync error:', error);
    console.log('=== SYNC FAILED ===\n');
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to sync user',
    });
  }
});
*/

module.exports = router;
