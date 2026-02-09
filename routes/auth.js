const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { auth, db, COLLECTIONS, createDocument, getDocumentById, getDocumentsByField, queryDocuments, findOneDocument, updateDocument } = require('../config/firestore');
const { protect } = require('../middleware/auth');
const { sendPasswordResetEmail, sendWelcomeEmail } = require('../utils/emailService');

const router = express.Router();

// Generate JWT Token
const generateToken = (userId) => {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is not configured. Please set it in .env file');
  }
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: '30d',
  });
};

// Hash password
async function hashPassword(password) {
  const salt = await bcrypt.genSalt(10);
  return await bcrypt.hash(password, salt);
}

// Compare password
async function comparePassword(enteredPassword, hashedPassword) {
  return await bcrypt.compare(enteredPassword, hashedPassword);
}

// @route   POST /api/auth/signup
// @desc    Register a new user
// @access  Public
router.post('/signup', async (req, res) => {
  try {
    const { name, email, password, phone, memberId } = req.body;

    const normalizedEmail = String(email ?? '').trim().toLowerCase();
    const normalizedMemberId = String(memberId ?? '').trim();

    console.log('\n=== SIGNUP ATTEMPT ===');
    console.log('Email:', normalizedEmail);
    console.log('Name:', name);
    console.log('Member ID:', normalizedMemberId);

    // Validation
    if (!name || !normalizedEmail || !password || !normalizedMemberId) {
      console.log('❌ Validation failed: Missing required fields');
      return res.status(400).json({
        success: false,
        message: 'Please provide name, email, password, and Member ID',
      });
    }

    // Check if memberId is already taken
    const existingMemberId = await findOneDocument(COLLECTIONS.USERS, [
      { field: 'memberId', operator: '==', value: normalizedMemberId }
    ]);
    
    if (existingMemberId) {
      console.log('❌ Member ID already exists:', normalizedMemberId);
      return res.status(400).json({
        success: false,
        message: 'Member ID already exists. Please use a different Member ID.',
      });
    }

    // Check if user already exists by email
    const userExists = await findOneDocument(COLLECTIONS.USERS, [
      { field: 'email', operator: '==', value: normalizedEmail }
    ]);

    if (userExists) {
      console.log('❌ User already exists:', {
        email: userExists.email,
        name: userExists.name,
        role: userExists.role,
      });
      return res.status(400).json({
        success: false,
        message: 'User already exists with this email',
      });
    }

    console.log('✅ Email is available, proceeding with verification...');

    // VERIFICATION: Check if member ID and phone number match authorized list
    let isVerified = false;
    let requiresAdminApproval = false;
    let accountStatus = 'approved';
    let verificationStatus = 'verified';
    let authorizedMember = null;

    try {
      const normalizedPhone = String(phone ?? '').replace(/[\s\-\(\)]/g, '').trim();
      
      console.log('🔍 Checking authorized members list...');
      console.log('Looking for - Member ID:', normalizedMemberId, ', Phone:', normalizedPhone);
      
      // Try to find by memberId first
      if (normalizedMemberId) {
        authorizedMember = await findOneDocument(COLLECTIONS.AUTHORIZED_MEMBERS, [
          { field: 'memberId', operator: '==', value: normalizedMemberId }
        ]);
      }
      
      // If not found by memberId, try by phone
      if (!authorizedMember && normalizedPhone) {
        authorizedMember = await findOneDocument(COLLECTIONS.AUTHORIZED_MEMBERS, [
          { field: 'phoneNumber', operator: '==', value: normalizedPhone }
        ]);
      }

      if (authorizedMember) {
        const authorizedPhone = (authorizedMember.phoneNumber || '').replace(/[\s\-\(\)]/g, '').trim();
        const authorizedMemberId = authorizedMember.memberId || '';
        
        let matchCount = 0;
        let matchDetails = [];
        
        if (authorizedMemberId && normalizedMemberId === authorizedMemberId) {
          matchCount++;
          matchDetails.push('memberId matches');
        }
        
        if (authorizedPhone && normalizedPhone === authorizedPhone) {
          matchCount++;
          matchDetails.push('phone matches');
        }
        
        if (matchCount === 2) {
          isVerified = true;
          console.log('✅ Member verified - perfect match (memberId + phone)');
        } else if (matchCount === 1) {
          // ANY partial match requires admin approval
          requiresAdminApproval = true;
          accountStatus = 'pending';
          verificationStatus = 'pending_admin';
          console.log('⚠️  Partial match - requires admin approval');
        }
      } else {
        requiresAdminApproval = true;
        accountStatus = 'pending';
        verificationStatus = 'pending_admin';
        console.log('⚠️  Not found in authorized members - requires admin approval');
      }
    } catch (verificationError) {
      console.error('⚠️  Verification check failed:', verificationError.message);
      requiresAdminApproval = true;
      accountStatus = 'pending';
      verificationStatus = 'pending_admin';
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Create user in Firestore
    const userData = {
      name,
      email: normalizedEmail,
      password: hashedPassword,
      role: 'user',
      phone: phone || '',
      memberId: normalizedMemberId,
      accountStatus,
      verificationStatus,
      requiresAdminApproval,
      notificationPreferences: {
        email: true,
        sms: false,
      },
    };

    const newUser = await createDocument(COLLECTIONS.USERS, userData);

    console.log('✅ User created in Firestore:', newUser.id);

    // Mark authorized member as used if verified
    if (isVerified && authorizedMember) {
      await updateDocument(COLLECTIONS.AUTHORIZED_MEMBERS, authorizedMember.id, {
        isUsed: true,
        usedBy: newUser.id,
        usedAt: new Date(),
      });
      console.log('✅ Authorized member marked as used');
    }

    // Send welcome email
    try {
      await sendWelcomeEmail(normalizedEmail, name);
      console.log('✅ Welcome email sent');
    } catch (emailError) {
      console.error('⚠️  Failed to send welcome email:', emailError.message);
    }

    // Generate token
    const token = generateToken(newUser.id);

    console.log('✅ Signup successful');

    res.status(201).json({
      success: true,
      message: requiresAdminApproval 
        ? 'Account created successfully. Your account is pending admin approval.'
        : 'Account created successfully!',
      token,
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        memberId: newUser.memberId,
        accountStatus: newUser.accountStatus,
        verificationStatus: newUser.verificationStatus,
        requiresAdminApproval: newUser.requiresAdminApproval,
      },
    });

  } catch (error) {
    console.error('❌ Signup error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating account',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

// @route   POST /api/auth/login
// @desc    Login user
// @access  Public
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    console.log('\n=== LOGIN ATTEMPT ===');
    console.log('Email:', email);

    if (!email || !password) {
      console.log('❌ Validation failed: Missing credentials');
      return res.status(400).json({
        success: false,
        message: 'Please provide email and password',
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Find user by email
    const user = await findOneDocument(COLLECTIONS.USERS, [
      { field: 'email', operator: '==', value: normalizedEmail }
    ]);

    if (!user) {
      console.log('❌ User not found');
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
    }

    // Check password
    const isPasswordValid = await comparePassword(password, user.password);

    if (!isPasswordValid) {
      console.log('❌ Invalid password');
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
    }

    // Check if account is approved
    if (user.accountStatus === 'rejected') {
      console.log('❌ Account rejected');
      return res.status(403).json({
        success: false,
        message: 'Your account has been rejected. Please contact admin.',
        rejectionReason: user.rejectionReason,
      });
    }

    if (user.accountStatus === 'pending') {
      console.log('⚠️  Account pending approval');
      return res.status(403).json({
        success: false,
        message: 'Your account is pending admin approval.',
      });
    }

    console.log('✅ Login successful');

    const token = generateToken(user.id);

    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        memberId: user.memberId,
        phone: user.phone,
        accountStatus: user.accountStatus,
        verificationStatus: user.verificationStatus,
      },
    });

  } catch (error) {
    console.error('❌ Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Error logging in',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

// @route   POST /api/auth/forgot-password
// @desc    Initiate password reset using Firebase Auth
// @access  Public
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email',
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Check if user exists in Firestore
    const user = await findOneDocument(COLLECTIONS.USERS, [
      { field: 'email', operator: '==', value: normalizedEmail }
    ]);

    if (!user) {
      // Don't reveal that user doesn't exist (security best practice)
      return res.json({
        success: true,
        message: 'If an account with that email exists, a password reset link has been sent.',
      });
    }

    // Create/Update user in Firebase Authentication if not exists
    try {
      await auth.getUserByEmail(normalizedEmail);
    } catch (error) {
      // User doesn't exist in Firebase Auth, create them
      if (error.code === 'auth/user-not-found') {
        await auth.createUser({
          uid: user.id,
          email: normalizedEmail,
          password: user.password, // temporary, will be changed by reset
        });
      }
    }

    // Generate password reset link using Firebase Auth
    const resetLink = await auth.generatePasswordResetLink(normalizedEmail, {
      url: `${process.env.FRONTEND_URL || 'http://localhost:8081'}/login`,
    });

    console.log('✅ Password reset link generated for:', normalizedEmail);
    console.log('🔗 Reset link:', resetLink);

    // In production, Firebase sends the email automatically
    // For development, you can return the link
    res.json({
      success: true,
      message: 'Password reset link has been generated. Check the console for the link.',
      ...(process.env.NODE_ENV === 'development' ? { resetLink } : {}),
    });

  } catch (error) {
    console.error('❌ Forgot password error:', error);
    res.status(500).json({
      success: false,
      message: 'Error processing request',
    });
  }
});

// @route   POST /api/auth/reset-password  
// @desc    Reset password (handled by Firebase Auth on client side)
// @access  Public
// NOTE: This endpoint is kept for backward compatibility
// Firebase Auth handles password reset on the client side
router.post('/reset-password', async (req, res) => {
  try {
    const { email, newPassword } = req.body;

    if (!email || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email and new password',
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters',
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Find user in Firestore
    const user = await findOneDocument(COLLECTIONS.USERS, [
      { field: 'email', operator: '==', value: normalizedEmail }
    ]);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Hash new password
    const hashedPassword = await hashPassword(newPassword);

    // Update password in Firestore
    await updateDocument(COLLECTIONS.USERS, user.id, {
      password: hashedPassword,
    });

    // Update password in Firebase Auth
    try {
      await auth.updateUser(user.id, {
        password: newPassword,
      });
    } catch (authError) {
      console.log('Firebase Auth update skipped:', authError.message);
    }

    console.log('✅ Password reset successful for user:', user.email);

    res.json({
      success: true,
      message: 'Password reset successful. You can now login with your new password.',
    });

  } catch (error) {
    console.error('❌ Reset password error:', error);
    res.status(500).json({
      success: false,
      message: 'Error resetting password',
    });
  }
});

// @route   GET /api/auth/me
// @desc    Get current user
// @access  Private
router.get('/me', protect, async (req, res) => {
  try {
    const user = await getDocumentById(COLLECTIONS.USERS, req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    res.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        memberId: user.memberId,
        phone: user.phone,
        accountStatus: user.accountStatus,
        verificationStatus: user.verificationStatus,
      },
    });
  } catch (error) {
    console.error('❌ Get me error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching user',
    });
  }
});

module.exports = router;
