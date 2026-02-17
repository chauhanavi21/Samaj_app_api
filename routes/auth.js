const express = require('express');
const bcrypt = require('bcryptjs');
const { auth, db, COLLECTIONS, createDocument, getDocumentById, getDocumentsByField, queryDocuments, findOneDocument, updateDocument } = require('../config/firestore');
const { verifyFirebaseToken } = require('../middleware/auth');

const router = express.Router();

async function getUserByFirebaseUid(firebaseUid) {
  if (!firebaseUid) return null;
  // Preferred: user doc id == firebase uid
  const byId = await getDocumentById(COLLECTIONS.USERS, firebaseUid);
  if (byId) return byId;
  // Back-compat: older users may store uid in `firebaseUid`
  return await findOneDocument(COLLECTIONS.USERS, [
    { field: 'firebaseUid', operator: '==', value: firebaseUid },
  ]);
}

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
    const normalizeMemberId = (value) => {
      const raw = String(value ?? '').trim();
      if (!raw) return '';
      // If Excel/JSON provides numeric-like strings (e.g. "999999.0" or "9.99999E5"), coerce safely.
      if (/^[0-9]+\.[0]+$/.test(raw) || /e\+?/i.test(raw)) {
        const n = Number(raw);
        if (Number.isFinite(n)) return String(Math.trunc(n));
      }
      return raw;
    };

    const normalizePhoneLenient = (value) => {
      const raw = String(value ?? '').trim();
      if (!raw) return '';
      // Handle cases like "9428499522.0" or "9.428499522E9"
      if (/[eE]|\./.test(raw)) {
        const n = Number(raw);
        if (Number.isFinite(n)) {
          const asInt = String(Math.trunc(n));
          return asInt.length > 10 ? asInt.slice(-10) : asInt;
        }
      }
      const digits = raw.replace(/\D/g, '');
      if (!digits) return '';
      // Compare on last 10 digits to tolerate country codes like +91
      return digits.length > 10 ? digits.slice(-10) : digits;
    };

    const normalizePhoneProvided = (value) => {
      const raw = String(value ?? '').trim();
      if (!raw) return '';

      // Convert numeric-ish strings coming from clients
      let digits = raw;
      if (/[eE]|\./.test(digits)) {
        const n = Number(digits);
        if (Number.isFinite(n)) {
          digits = String(Math.trunc(n));
        }
      }

      digits = String(digits).replace(/\D/g, '');
      if (!digits) return '';

      // Accept common prefixes:
      // - India trunk prefix 0xxxxxxxxxx (11 digits)
      // - India country code 91xxxxxxxxxx (12 digits)
      if (digits.length === 11 && digits.startsWith('0')) return digits.slice(1);
      if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);

      // Exact 10 digits is the required canonical format
      if (digits.length === 10) return digits;

      // Anything else is ambiguous; do not silently truncate
      return null;
    };

    const normalizedMemberId = normalizeMemberId(memberId);

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

    const isReapplicable = (user) =>
      user && (user.accountStatus === 'pending' || user.accountStatus === 'rejected');

    // Existing user checks
    const existingByMemberId = await findOneDocument(COLLECTIONS.USERS, [
      { field: 'memberId', operator: '==', value: normalizedMemberId },
    ]);
    const existingByEmail = await findOneDocument(COLLECTIONS.USERS, [
      { field: 'email', operator: '==', value: normalizedEmail },
    ]);

    // Re-apply flow:
    // If an account exists with the same memberId/email but is pending/rejected,
    // allow signup again by updating that same user record.
    let reapplyUser = null;

    if (existingByMemberId) {
      if (existingByMemberId.email === normalizedEmail && isReapplicable(existingByMemberId)) {
        reapplyUser = existingByMemberId;
        console.log('♻️  Re-apply detected by memberId for user:', reapplyUser.id);
      } else {
        console.log('❌ Member ID already exists:', normalizedMemberId);
        return res.status(400).json({
          success: false,
          message: 'Member ID already exists. Please use a different Member ID.',
        });
      }
    }

    if (existingByEmail) {
      if (!reapplyUser) {
        if (existingByEmail.memberId === normalizedMemberId && isReapplicable(existingByEmail)) {
          reapplyUser = existingByEmail;
          console.log('♻️  Re-apply detected by email for user:', reapplyUser.id);
        } else {
          console.log('❌ User already exists:', {
            email: existingByEmail.email,
            name: existingByEmail.name,
            role: existingByEmail.role,
          });
          return res.status(400).json({
            success: false,
            message: 'User already exists with this email',
          });
        }
      } else if (existingByEmail.id !== reapplyUser.id) {
        return res.status(400).json({
          success: false,
          message: 'Email / Member ID conflict. Please contact admin.',
        });
      }
    }

    console.log('✅ Proceeding with verification...');

    // VERIFICATION: Check if member ID and phone number match authorized list
    let isVerified = false;
    let requiresAdminApproval = false;
    let accountStatus = 'approved';
    let verificationStatus = 'verified';
    let authorizedMember = null;

    const maybeNumber = (value) => {
      const str = String(value ?? '').trim();
      if (!str) return null;
      if (!/^\d+$/.test(str)) return null;
      const n = Number(str);
      return Number.isFinite(n) ? n : null;
    };

    const getAuthorizedByMemberId = async (memberIdValue) => {
      if (!memberIdValue) return null;

      // Common pattern: docId is the memberId (matches firestore.rules path)
      const byDocId = await getDocumentById(COLLECTIONS.AUTHORIZED_MEMBERS, memberIdValue);
      if (byDocId) return byDocId;

      // Field-based lookup (string then number)
      const byStringField = await findOneDocument(COLLECTIONS.AUTHORIZED_MEMBERS, [
        { field: 'memberId', operator: '==', value: memberIdValue },
      ]);
      if (byStringField) return byStringField;

      const asNumber = maybeNumber(memberIdValue);
      if (asNumber !== null) {
        const byNumberField = await findOneDocument(COLLECTIONS.AUTHORIZED_MEMBERS, [
          { field: 'memberId', operator: '==', value: asNumber },
        ]);
        if (byNumberField) return byNumberField;
      }

      // Optional normalized field if present
      const byNormalized = await findOneDocument(COLLECTIONS.AUTHORIZED_MEMBERS, [
        { field: 'memberIdNormalized', operator: '==', value: memberIdValue },
      ]);
      if (byNormalized) return byNormalized;

      return null;
    };

    const getAuthorizedByPhone = async (phoneValue) => {
      if (!phoneValue) return null;

      const byStringField = await findOneDocument(COLLECTIONS.AUTHORIZED_MEMBERS, [
        { field: 'phoneNumber', operator: '==', value: phoneValue },
      ]);
      if (byStringField) return byStringField;

      const asNumber = maybeNumber(phoneValue);
      if (asNumber !== null) {
        const byNumberField = await findOneDocument(COLLECTIONS.AUTHORIZED_MEMBERS, [
          { field: 'phoneNumber', operator: '==', value: asNumber },
        ]);
        if (byNumberField) return byNumberField;
      }

      const byNormalized = await findOneDocument(COLLECTIONS.AUTHORIZED_MEMBERS, [
        { field: 'phoneNormalized', operator: '==', value: phoneValue },
      ]);
      if (byNormalized) return byNormalized;

      return null;
    };

    try {
      const normalizedPhone = normalizePhoneProvided(phone);

      if (normalizedPhone === null) {
        console.log('❌ Validation failed: Invalid phone format', String(phone ?? ''));
        return res.status(400).json({
          success: false,
          message: 'Invalid phone number. Please enter a 10-digit phone number (or +91 / leading 0).',
        });
      }
      
      console.log('🔍 Checking authorized members list...');
      console.log('Looking for - Member ID:', normalizedMemberId, ', Phone:', normalizedPhone);
      
      // Strict rule: only auto-approve when BOTH memberId + phone match
      // (Phone is optional for signup, but missing phone => pending approval)
      if (!normalizedPhone) {
        requiresAdminApproval = true;
        accountStatus = 'pending';
        verificationStatus = 'pending_admin';
        console.log('⚠️  Phone not provided - requires admin approval');
      } else {
        // Look up authorized record by memberId (primary) with multiple strategies.
        authorizedMember = await getAuthorizedByMemberId(normalizedMemberId);

        // If not found by memberId, try by phone (fallback)
        if (!authorizedMember) {
          authorizedMember = await getAuthorizedByPhone(normalizedPhone);
        }

        if (authorizedMember?.isUsed === true) {
          const authorizedPhone = normalizePhoneLenient(authorizedMember.phoneNumber);
          const authorizedMemberId = normalizeMemberId(authorizedMember.memberId || authorizedMember.id);

          const memberIdMatches = !!authorizedMemberId && normalizedMemberId === authorizedMemberId;
          const phoneMatches = !!authorizedPhone && normalizedPhone === authorizedPhone;

          // If this authorized entry is already used and the user is trying to reuse the same
          // member/phone, block signup (do not create a pending duplicate account) *only if*
          // the referenced user still exists. If the user doc was deleted, treat this as a stale lock.
          if (memberIdMatches || phoneMatches) {
            let usedByUser = null;
            if (authorizedMember.usedBy) {
              usedByUser = await getDocumentById(COLLECTIONS.USERS, authorizedMember.usedBy);
            }

            if (usedByUser) {
              console.log('❌ Authorized member already used - blocking signup');
              return res.status(400).json({
                success: false,
                message: 'This Member ID / phone number is already registered. Please login or contact admin.',
              });
            }

            console.log('♻️  Authorized member marked used but user is missing - resetting stale lock');
            try {
              await updateDocument(COLLECTIONS.AUTHORIZED_MEMBERS, authorizedMember.id, {
                isUsed: false,
                usedBy: null,
                usedAt: null,
              });
              authorizedMember.isUsed = false;
              authorizedMember.usedBy = null;
              authorizedMember.usedAt = null;
            } catch (resetError) {
              console.error('⚠️  Failed to reset stale authorized lock:', resetError.message);
            }

            // Now evaluate the match normally (auto-approve only when BOTH match)
            if (memberIdMatches && phoneMatches) {
              isVerified = true;
              console.log('✅ Member verified - perfect match (memberId + phone)');
            } else {
              requiresAdminApproval = true;
              accountStatus = 'pending';
              verificationStatus = 'pending_admin';
              console.log('⚠️  Mismatch with authorized record - requires admin approval', {
                provided: { memberId: normalizedMemberId, phone: normalizedPhone },
                authorized: { memberId: authorizedMemberId, phone: authorizedPhone },
              });
            }

            // Stop here (we already set isVerified/pending)
          } else {
            // Otherwise fall back to pending approval
            requiresAdminApproval = true;
            accountStatus = 'pending';
            verificationStatus = 'pending_admin';
            console.log('⚠️  Authorized member already used - requires admin approval');
          }
        } else if (authorizedMember) {
          const authorizedPhone = normalizePhoneLenient(authorizedMember.phoneNumber);
          const authorizedMemberId = normalizeMemberId(authorizedMember.memberId || authorizedMember.id);

          const memberIdMatches = !!authorizedMemberId && normalizedMemberId === authorizedMemberId;
          const phoneMatches = !!authorizedPhone && normalizedPhone === authorizedPhone;

          if (memberIdMatches && phoneMatches) {
            isVerified = true;
            console.log('✅ Member verified - perfect match (memberId + phone)');
          } else {
            requiresAdminApproval = true;
            accountStatus = 'pending';
            verificationStatus = 'pending_admin';
            console.log('⚠️  Mismatch with authorized record - requires admin approval', {
              provided: { memberId: normalizedMemberId, phone: normalizedPhone },
              authorized: { memberId: authorizedMemberId, phone: authorizedPhone },
            });
          }
        } else {
          requiresAdminApproval = true;
          accountStatus = 'pending';
          verificationStatus = 'pending_admin';
          console.log('⚠️  Not found in authorized members - requires admin approval');
        }
      }
    } catch (verificationError) {
      console.error('⚠️  Verification check failed:', verificationError.message);
      requiresAdminApproval = true;
      accountStatus = 'pending';
      verificationStatus = 'pending_admin';
    }

    // Create/update Firebase Auth user (source of truth for password/login)
    let firebaseUid = reapplyUser?.firebaseUid || null;

    // If we have a stored uid, ensure it exists.
    if (firebaseUid) {
      try {
        await auth.getUser(firebaseUid);
      } catch (e) {
        firebaseUid = null;
      }
    }

    // Try to find existing Firebase user by email (covers legacy users created elsewhere).
    if (!firebaseUid) {
      try {
        const existingFirebaseUser = await auth.getUserByEmail(normalizedEmail);

        // Safety: if a Firebase Auth user already exists for this email but we don't have a
        // corresponding Firestore user record for the email/member flow, do not allow signup
        // to overwrite that account's password.
        if (!existingByEmail && !reapplyUser) {
          return res.status(400).json({
            success: false,
            message: 'An account already exists with this email. Please login or contact admin.',
          });
        }

        firebaseUid = existingFirebaseUser.uid;
      } catch (e) {
        // ignore not-found
      }
    }

    // Create Firebase user if needed, otherwise update password/display name.
    try {
      if (!firebaseUid) {
        const created = await auth.createUser({
          email: normalizedEmail,
          password,
          displayName: name,
        });
        firebaseUid = created.uid;
      } else {
        await auth.updateUser(firebaseUid, {
          email: normalizedEmail,
          password,
          displayName: name,
        });
      }
    } catch (firebaseError) {
      const msg = String(firebaseError?.message || 'Failed to create account');
      const code = String(firebaseError?.code || '');
      if (code.includes('email-already-exists')) {
        return res.status(400).json({
          success: false,
          message: 'User already exists with this email',
        });
      }
      console.error('❌ Firebase Auth user create/update failed:', msg);
      return res.status(500).json({
        success: false,
        message: 'Error creating account',
        error: process.env.NODE_ENV === 'development' ? msg : undefined,
      });
    }

    // Create or update user in Firestore
    const userData = {
      name,
      email: normalizedEmail,
      role: 'user',
      // Store canonical phone (10 digits) to keep matching consistent
      phone: (typeof phone !== 'undefined' && phone !== null && String(phone).trim() !== '')
        ? normalizePhoneProvided(phone)
        : '',
      memberId: normalizedMemberId,
      accountStatus,
      verificationStatus,
      requiresAdminApproval,
      firebaseUid,
      notificationPreferences: reapplyUser?.notificationPreferences || {
        email: true,
        sms: false,
      },
    };

    let savedUser;
    if (reapplyUser) {
      savedUser = await updateDocument(COLLECTIONS.USERS, reapplyUser.id, {
        ...userData,
        rejectionReason: '',
        rejectedAt: null,
        rejectedBy: null,
        approvedAt: null,
        approvedBy: null,
        reappliedAt: new Date(),
      });
      console.log('✅ User updated (re-apply) in Firestore:', savedUser.id);
    } else {
      // For new users, use Firebase uid as Firestore doc id.
      savedUser = await createDocument(COLLECTIONS.USERS, userData, firebaseUid);
      console.log('✅ User created in Firestore:', savedUser.id);
    }

    // Auto-create/update a family tree entry on account creation
    try {
      const existingEntries = await queryDocuments(
        COLLECTIONS.FAMILY_TREE,
        [{ field: 'createdBy', operator: '==', value: savedUser.id }],
        null,
        'asc',
        1
      );

      if (existingEntries.length > 0) {
        await updateDocument(COLLECTIONS.FAMILY_TREE, existingEntries[0].id, {
          memberId: normalizedMemberId,
          personName: name,
          personPhone: phone || '',
        });
        console.log('✅ Family tree entry updated for user:', savedUser.id);
      } else {
        await createDocument(COLLECTIONS.FAMILY_TREE, {
          createdBy: savedUser.id,
          memberId: normalizedMemberId,
          personName: name,
          personPhone: phone || '',
          personDateOfBirth: null,
          personOccupation: '',
          spouseName: '',
          spousePhone: '',
          fatherName: '',
          fatherPhone: '',
          motherName: '',
          motherPhone: '',
          children: [],
          address: '',
          notes: '',
        });
        console.log('✅ Family tree entry auto-created for user:', savedUser.id);
      }
    } catch (familyTreeError) {
      console.error('⚠️  Failed to auto-create family tree entry:', familyTreeError.message);
    }

    // Mark authorized member as used if verified
    if (isVerified && authorizedMember) {
      await updateDocument(COLLECTIONS.AUTHORIZED_MEMBERS, authorizedMember.id, {
        isUsed: true,
        usedBy: savedUser.id,
        usedAt: new Date(),
      });
      console.log('✅ Authorized member marked as used');
    }

    // Email flows are handled via Firebase Auth on the client:
    // - sendEmailVerification(auth.currentUser)
    // - sendPasswordResetEmail(auth, email)

    console.log('✅ Signup successful');

    res.status(201).json({
      success: true,
      message: requiresAdminApproval 
        ? 'Account created successfully. Your account is pending admin approval.'
        : 'Account created successfully!',
      token: null,
      user: {
        id: savedUser.id,
        name: savedUser.name,
        email: savedUser.email,
        role: savedUser.role,
        memberId: savedUser.memberId,
        accountStatus: savedUser.accountStatus,
        verificationStatus: savedUser.verificationStatus,
        requiresAdminApproval: savedUser.requiresAdminApproval,
        firebaseUid: savedUser.firebaseUid,
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

    // This endpoint is ONLY for migrating legacy accounts that stored a bcrypt password in Firestore.
    // Normal login happens client-side via Firebase Auth.
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email and password',
      });
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    const user = await findOneDocument(COLLECTIONS.USERS, [
      { field: 'email', operator: '==', value: normalizedEmail },
    ]);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
    }

    // Match previous behavior for pending/rejected.
    if (user.accountStatus === 'rejected') {
      return res.status(403).json({
        success: false,
        message: 'Your account has been rejected. Please contact admin.',
        accountStatus: 'rejected',
        rejectionReason: user.rejectionReason,
      });
    }

    if (user.accountStatus === 'pending') {
      return res.status(403).json({
        success: false,
        message: 'Your account is pending admin approval.',
        accountStatus: 'pending',
        requiresApproval: true,
      });
    }

    // Already migrated: do not accept password here.
    if (user.firebaseUid) {
      return res.status(410).json({
        success: false,
        message: 'This account is already using Firebase Auth. Please login from the app and use Forgot Password if needed.',
      });
    }

    if (!user.password) {
      return res.status(410).json({
        success: false,
        message: 'This account must login using Firebase Auth. Please use Forgot Password if needed.',
      });
    }

    const isPasswordValid = await comparePassword(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
    }

    // Link/create Firebase Auth account.
    let firebaseUid = null;
    try {
      const existingFirebaseUser = await auth.getUserByEmail(normalizedEmail);
      firebaseUid = existingFirebaseUser.uid;
      await auth.updateUser(firebaseUid, { password, displayName: user.name || '' });
    } catch (e) {
      const code = String(e?.code || '');
      if (code.includes('user-not-found')) {
        const created = await auth.createUser({
          email: normalizedEmail,
          password,
          displayName: user.name || '',
        });
        firebaseUid = created.uid;
      } else {
        throw e;
      }
    }

    await updateDocument(COLLECTIONS.USERS, user.id, { firebaseUid });

    res.json({
      success: true,
      migrated: true,
      message: 'Account migrated to Firebase Auth. Please login again.',
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
// @desc    Password reset is handled by Firebase Auth on the client
// @access  Public
router.post('/forgot-password', async (req, res) => {
  try {
    // Firebase email sending is done client-side:
    // sendPasswordResetEmail(auth, email)
    // We return a generic success response to avoid user enumeration.
    res.json({
      success: true,
      message: 'If an account with that email exists, a password reset email will be sent.',
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
// @desc    Disabled: Firebase Auth handles password reset via emailed link
// @access  Public
// NOTE: This endpoint is kept for backward compatibility
// Firebase Auth handles password reset on the client side
router.post('/reset-password', async (req, res) => {
  try {
    res.status(410).json({
      success: false,
      message: 'Password reset is handled by Firebase Auth. Please use the reset link sent by email.',
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
router.get('/me', verifyFirebaseToken, async (req, res) => {
  try {
    const firebaseUid = req.firebaseUser?.uid;
    const user = await getUserByFirebaseUid(firebaseUid);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    delete user.password;

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
