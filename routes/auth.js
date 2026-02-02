const express = require('express');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const FamilyTree = require('../models/FamilyTree');
const { protect } = require('../middleware/auth');

const router = express.Router();

// Generate JWT Token
const generateToken = (id) => {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is not configured. Please set it in .env file');
  }
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: '30d',
  });
};

// @route   POST /api/auth/signup
// @desc    Register a new user
// @access  Public
router.post('/signup', async (req, res) => {
  try {
    const { name, email, password, phone, memberId } = req.body;

    console.log('\n=== SIGNUP ATTEMPT ===');
    console.log('Email:', email);
    console.log('Name:', name);
    console.log('Member ID:', memberId);

    // Validation
    if (!name || !email || !password || !memberId) {
      console.log('❌ Validation failed: Missing required fields');
      return res.status(400).json({
        success: false,
        message: 'Please provide name, email, password, and Member ID',
      });
    }

    // Check if memberId is already taken
    const existingMemberId = await User.findOne({ memberId });
    if (existingMemberId) {
      console.log('❌ Member ID already exists:', memberId);
      return res.status(400).json({
        success: false,
        message: 'Member ID already exists. Please use a different Member ID.',
      });
    }

    // Check if user already exists
    const userExists = await User.findOne({ email: email.toLowerCase() });
    if (userExists) {
      console.log('❌ User already exists:', {
        email: userExists.email,
        name: userExists.name,
        role: userExists.role,
        createdAt: userExists.createdAt,
      });
      return res.status(400).json({
        success: false,
        message: 'User already exists with this email',
        debug: {
          existingUser: {
            email: userExists.email,
            name: userExists.name,
            registeredAt: userExists.createdAt,
          },
        },
      });
    }

    console.log('✅ Email is available, proceeding with signup...');

    // Check if email should be admin (from env)
    const adminEmails = process.env.ADMIN_EMAILS?.split(',').map(e => e.trim()) || [];
    const role = adminEmails.includes(email.toLowerCase()) ? 'admin' : 'user';

    // Create user
    let user;
    try {
      user = await User.create({
        name,
        email: email.toLowerCase(),
        password,
        phone: phone || '',
        memberId: memberId.trim(),
        role,
      });
    } catch (createError) {
      // Check if user was actually created despite the error
      if (createError.name === 'MongoWriteConcernError') {
        console.log('⚠️ Write concern error, checking if user was created...');
        // Try to find the user - if it exists, the creation succeeded
        const existingUser = await User.findOne({ email: email.toLowerCase() });
        if (existingUser) {
          console.log('✅ User was created despite write concern error, using existing user');
          user = existingUser;
        } else {
          throw createError; // User wasn't created, throw the error
        }
      } else {
        throw createError; // Different error, throw it
      }
    }

    // Generate token
    const token = generateToken(user._id);

    console.log('✅ User created successfully:', {
      id: user._id,
      email: user.email,
      name: user.name,
      role: user.role,
      memberId: user.memberId,
    });

    // Automatically create a Family Tree entry for the new user
    try {
      await FamilyTree.create({
        createdBy: user._id,
        personName: user.name,
        personPhone: user.phone || '',
        // memberId is stored in User model, not FamilyTree
      });
      console.log('✅ Family Tree entry created automatically for:', user.name);
    } catch (familyTreeError) {
      // Log error but don't fail signup
      console.log('⚠️ Failed to create Family Tree entry:', familyTreeError.message);
    }

    console.log('=== SIGNUP SUCCESS ===\n');

    res.status(201).json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        memberId: user.memberId,
      },
    });
  } catch (error) {
    console.log('❌ SIGNUP ERROR ===');
    console.error('Error details:', {
      name: error.name,
      message: error.message,
      code: error.code,
      stack: error.stack,
    });
    
    // Handle MongoDB duplicate key error
    if (error.code === 11000) {
      console.log('❌ Duplicate email error');
      return res.status(400).json({
        success: false,
        message: 'User already exists with this email',
      });
    }
    
    // Handle validation errors
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message).join(', ');
      console.log('❌ Validation error:', messages);
      return res.status(400).json({
        success: false,
        message: messages || 'Validation error',
        details: error.errors,
      });
    }
    
    // Handle MongoDB connection errors
    if (error.name === 'MongoServerError' || error.message?.includes('MongoDB')) {
      console.log('❌ MongoDB connection error');
      return res.status(500).json({
        success: false,
        message: 'Database connection error. Please check MongoDB configuration.',
      });
    }
    
    console.log('❌ Unknown error during signup');
    res.status(500).json({
      success: false,
      message: error.message || 'Server error during signup',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
    console.log('=== SIGNUP ERROR END ===\n');
  }
});

// @route   POST /api/auth/login
// @desc    Login user
// @access  Public
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email and password',
      });
    }

    // Check for user and include password for comparison
    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
    }

    // Check password
    const isMatch = await user.comparePassword(password);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
    }

    // Generate token
    const token = generateToken(user._id);

    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        memberId: user.memberId,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error during login',
    });
  }
});

// @route   GET /api/auth/me
// @desc    Get current logged in user
// @access  Private
router.get('/me', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    res.json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        memberId: user.memberId,
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

// @route   PUT /api/auth/profile
// @desc    Update user profile
// @access  Private
router.put('/profile', protect, async (req, res) => {
  try {
    const { memberId } = req.body;
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // If memberId is provided and different from current, check uniqueness
    if (memberId && memberId !== user.memberId) {
      const existingMemberId = await User.findOne({ 
        memberId, 
        _id: { $ne: user._id } // Exclude current user
      });
      
      if (existingMemberId) {
        return res.status(400).json({
          success: false,
          message: 'Member ID already exists. Please use a different Member ID.',
        });
      }
      
      user.memberId = memberId.trim();
    }

    await user.save();

    res.json({
      success: true,
      message: 'Profile updated successfully',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        memberId: user.memberId,
      },
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error',
    });
  }
});

// @route   POST /api/auth/logout
// @desc    Logout user (client-side token removal, this is just for consistency)
// @access  Private
router.post('/logout', protect, async (req, res) => {
  try {
    // In JWT, logout is handled client-side by removing the token
    // This endpoint is for consistency and can be used for logging
    res.json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
});

// @route   POST /api/auth/forgot-password
// @desc    Request password reset (generates reset token)
// @access  Public
router.post('/forgot-password', async (req, res) => {
  try {
    const { email, memberId } = req.body;

    console.log('\n=== FORGOT PASSWORD REQUEST ===');
    console.log('Email:', email);
    console.log('Member ID:', memberId);

    // Validation
    if (!email || !memberId) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email and Member ID',
      });
    }

    // Find user by email and memberId
    const user = await User.findOne({ 
      email: email.toLowerCase(),
      memberId: memberId.trim()
    });

    if (!user) {
      console.log('❌ User not found with provided email and Member ID');
      return res.status(404).json({
        success: false,
        message: 'No account found with this email and Member ID combination',
      });
    }

    // Generate reset token
    const resetToken = user.getResetPasswordToken();
    await user.save({ validateBeforeSave: false });

    console.log('✅ Reset token generated for:', user.email);
    console.log('Reset Token:', resetToken);
    console.log('Token expires in 10 minutes');
    console.log('================================\n');

    res.status(200).json({
      success: true,
      message: 'Password reset token generated successfully',
      resetToken: resetToken, // In production, this would be sent via email
      // For development/testing without email service
      memberId: user.memberId,
      email: user.email,
      expiresIn: '10 minutes',
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while processing password reset request',
    });
  }
});

// @route   POST /api/auth/reset-password/:resetToken
// @desc    Reset password using token
// @access  Public
router.post('/reset-password/:resetToken', async (req, res) => {
  try {
    const { password, confirmPassword } = req.body;
    const resetToken = req.params.resetToken;

    console.log('\n=== RESET PASSWORD REQUEST ===');

    // Validation
    if (!password || !confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Please provide password and confirm password',
      });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Passwords do not match',
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters',
      });
    }

    // Hash the provided token to compare with database
    const hashedToken = crypto
      .createHash('sha256')
      .update(resetToken)
      .digest('hex');

    // Find user with valid reset token
    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpire: { $gt: Date.now() },
    }).select('+password');

    if (!user) {
      console.log('❌ Invalid or expired reset token');
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired reset token',
      });
    }

    // Set new password (will be hashed by pre-save hook)
    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save();

    console.log('✅ Password reset successfully for:', user.email);
    console.log('================================\n');

    // Generate new token for auto-login
    const token = generateToken(user._id);

    res.status(200).json({
      success: true,
      message: 'Password reset successfully',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        memberId: user.memberId,
      },
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while resetting password',
    });
  }
});

// @route   GET /api/auth/debug/users
// @desc    Get all users (DEBUG ONLY - for development)
// @access  Public (only in development)
router.get('/debug/users', async (req, res) => {
  try {
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({
        success: false,
        message: 'This endpoint is only available in development',
      });
    }

    const users = await User.find({}).select('-password').sort({ createdAt: -1 });
    
    console.log('\n=== ALL USERS IN DATABASE ===');
    console.log(`Total users: ${users.length}`);
    users.forEach((user, index) => {
      console.log(`${index + 1}. ${user.name} (${user.email}) - Role: ${user.role} - Created: ${user.createdAt}`);
    });
    console.log('=============================\n');

    res.json({
      success: true,
      count: users.length,
      users: users.map(user => ({
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        createdAt: user.createdAt,
      })),
    });
  } catch (error) {
    console.error('Debug users error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
});

// @route   GET /api/auth/debug/check-email/:email
// @desc    Check if email is registered (DEBUG ONLY)
// @access  Public (only in development)
router.get('/debug/check-email/:email', async (req, res) => {
  try {
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({
        success: false,
        message: 'This endpoint is only available in development',
      });
    }

    const email = req.params.email.toLowerCase();
    const user = await User.findOne({ email }).select('-password');

    console.log(`\n=== CHECKING EMAIL: ${email} ===`);
    
    if (user) {
      console.log('✅ User found:', {
        name: user.name,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
      });
      console.log('=============================\n');
      
      res.json({
        success: true,
        exists: true,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          phone: user.phone,
          createdAt: user.createdAt,
        },
      });
    } else {
      console.log('❌ User not found');
      console.log('=============================\n');
      
      res.json({
        success: true,
        exists: false,
        message: 'Email is not registered',
      });
    }
  } catch (error) {
    console.error('Check email error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
});

module.exports = router;
