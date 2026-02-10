const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { protect, authorize } = require('../middleware/auth');
const {
  COLLECTIONS,
  getAllDocuments,
  getDocumentById,
  createDocument,
  updateDocument,
  deleteDocument,
  queryDocuments,
  countDocuments,
  admin
} = require('../config/firestore');
const { sendAccountApprovedEmail, sendAccountRejectedEmail } = require('../utils/emailService');

const router = express.Router();

// Apply protection and admin authorization to all routes
router.use(protect, authorize('admin'));

// ============================================
// DASHBOARD STATS
// ============================================

// @route   GET /api/admin/dashboard
// @desc    Get admin dashboard statistics
// @access  Admin only
router.get('/dashboard', async (req, res) => {
  try {
    // Get total counts
    const totalUsers = await countDocuments(COLLECTIONS.USERS);
    const totalAdmins = await countDocuments(COLLECTIONS.USERS, [{ field: 'role', operator: '==', value: 'admin' }]);
    const totalRegularUsers = await countDocuments(COLLECTIONS.USERS, [{ field: 'role', operator: '==', value: 'user' }]);
    const totalFamilyTreeEntries = await countDocuments(COLLECTIONS.FAMILY_TREE);
    
    // Get pending approval users
    // Avoid composite index (accountStatus equality + createdAt orderBy) by sorting in memory.
    let pendingUsers = await queryDocuments(COLLECTIONS.USERS, [
      { field: 'accountStatus', operator: '==', value: 'pending' },
    ]);

    const toMillis = (ts) => {
      if (!ts) return 0;
      if (typeof ts === 'number') return ts;
      if (typeof ts === 'string') {
        const parsed = Date.parse(ts);
        return Number.isFinite(parsed) ? parsed : 0;
      }
      if (typeof ts.toMillis === 'function') return ts.toMillis();
      if (typeof ts.toDate === 'function') return ts.toDate().getTime();
      if (typeof ts._seconds === 'number') return ts._seconds * 1000;
      return 0;
    };

    pendingUsers.sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));

    // Get recent signups (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyDaysAgoTimestamp = admin.firestore.Timestamp.fromDate(thirtyDaysAgo);
    
    const recentSignups = await queryDocuments(
      COLLECTIONS.USERS,
      [{ field: 'createdAt', operator: '>=', value: thirtyDaysAgoTimestamp }],
      'createdAt',
      'desc',
      10
    );

    // Get signups per month for the last 6 months (simplified for Firestore)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const sixMonthsAgoTimestamp = admin.firestore.Timestamp.fromDate(sixMonthsAgo);
    
    const recentUsers = await queryDocuments(
      COLLECTIONS.USERS,
      [{ field: 'createdAt', operator: '>=', value: sixMonthsAgoTimestamp }]
    );
    
    // Group by month
    const signupTrend = recentUsers.reduce((acc, user) => {
      const date = user.createdAt.toDate();
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      const key = `${year}-${month}`;
      
      if (!acc[key]) {
        acc[key] = { _id: { year, month }, count: 0 };
      }
      acc[key].count++;
      return acc;
    }, {});
    
    const signupTrendArray = Object.values(signupTrend).sort((a, b) => {
      if (a._id.year !== b._id.year) return a._id.year - b._id.year;
      return a._id.month - b._id.month;
    });

    // Get most active users (by family tree entries)
    const allFamilyTrees = await getAllDocuments(COLLECTIONS.FAMILY_TREE);
    const userEntryCount = allFamilyTrees.reduce((acc, entry) => {
      const userId = entry.createdBy;
      acc[userId] = (acc[userId] || 0) + 1;
      return acc;
    }, {});
    
    const topUserIds = Object.entries(userEntryCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([userId]) => userId);
    
    const activeUsers = await Promise.all(
      topUserIds.map(async (userId) => {
        const user = await getDocumentById(COLLECTIONS.USERS, userId);
        return user ? {
          _id: userId,
          name: user.name,
          email: user.email,
          memberId: user.memberId,
          entryCount: userEntryCount[userId]
        } : null;
      })
    );
    
    const filteredActiveUsers = activeUsers.filter(u => u !== null);

    res.json({
      success: true,
      data: {
        totals: {
          users: totalUsers,
          admins: totalAdmins,
          regularUsers: totalRegularUsers,
          familyTreeEntries: totalFamilyTreeEntries,
          pendingApprovals: pendingUsers.length, // Add pending count
        },
        pendingUsers: pendingUsers.map(user => ({
          id: user.id,
          name: user.name,
          email: user.email,
          memberId: user.memberId,
          phone: user.phone,
          verificationStatus: user.verificationStatus,
          requiresAdminApproval: user.requiresAdminApproval,
          createdAt: user.createdAt,
        })),
        recentSignups: recentSignups.map(user => ({
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          memberId: user.memberId,
          createdAt: user.createdAt,
        })),
        signupTrend: signupTrendArray,
        activeUsers: filteredActiveUsers,
      },
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard statistics',
      error: error.message,
    });
  }
});

// ============================================
// IMAGE UPLOAD
// ============================================

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log('Created uploads directory:', uploadsDir);
}

// Configure multer for image upload
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    // Create unique filename: timestamp-randomstring-originalname
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    const nameWithoutExt = path.basename(file.originalname, ext);
    cb(null, nameWithoutExt + '-' + uniqueSuffix + ext);
  }
});

// File filter - only allow images
const fileFilter = (req, file, cb) => {
  const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPEG, PNG, GIF, and WebP images are allowed.'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
});

// @route   POST /api/admin/upload-image
// @desc    Upload an image
// @access  Admin only
router.post('/upload-image', upload.single('image'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded',
      });
    }

    // Return the URL path to access the image
    const imageUrl = `/uploads/${req.file.filename}`;

    res.json({
      success: true,
      message: 'Image uploaded successfully',
      data: {
        filename: req.file.filename,
        url: imageUrl,
        size: req.file.size,
        mimetype: req.file.mimetype,
      },
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload image',
      error: error.message,
    });
  }
});

// Handle multer errors
router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'File too large. Maximum size is 5MB.',
      });
    }
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
  next(error);
});

// ============================================
// USER MANAGEMENT
// ============================================

// @route   GET /api/admin/approvals
// @desc    Get pending approval users with pagination and search
// @access  Admin only
router.get('/approvals', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || '';

    let users = await queryDocuments(COLLECTIONS.USERS, [
      { field: 'accountStatus', operator: '==', value: 'pending' },
    ]);

    const toMillis = (ts) => {
      if (!ts) return 0;
      if (typeof ts === 'number') return ts;
      if (typeof ts === 'string') {
        const parsed = Date.parse(ts);
        return Number.isFinite(parsed) ? parsed : 0;
      }
      if (typeof ts.toMillis === 'function') return ts.toMillis();
      if (typeof ts.toDate === 'function') return ts.toDate().getTime();
      if (typeof ts._seconds === 'number') return ts._seconds * 1000;
      return 0;
    };

    users.sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));

    if (search) {
      const searchLower = String(search).toLowerCase();
      users = users.filter((user) =>
        user.name?.toLowerCase().includes(searchLower) ||
        user.email?.toLowerCase().includes(searchLower) ||
        String(user.memberId || '').toLowerCase().includes(searchLower) ||
        String(user.phone || '').toLowerCase().includes(searchLower)
      );
    }

    users = users.map(({ password, ...user }) => user);

    const total = users.length;
    const skip = (page - 1) * limit;
    const paginated = users.slice(skip, skip + limit);

    res.json({
      success: true,
      data: paginated,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Get approvals error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch pending approvals',
      error: error.message,
    });
  }
});

// @route   PUT /api/admin/users/:id/approve
// @desc    Approve a pending user
// @access  Admin only
router.put('/users/:id/approve', async (req, res) => {
  try {
    const user = await getDocumentById(COLLECTIONS.USERS, req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const updated = await updateDocument(COLLECTIONS.USERS, req.params.id, {
      accountStatus: 'approved',
      requiresAdminApproval: false,
      verificationStatus: 'verified',
      approvedAt: admin.firestore.Timestamp.now(),
      approvedBy: req.user.id,
    });

    try {
      await sendAccountApprovedEmail(updated.email, updated.name);
    } catch (e) {
      // Non-fatal
      console.error('Approval email failed:', e.message);
    }

    const { password, ...userWithoutPassword } = updated;
    res.json({
      success: true,
      message: 'User approved',
      data: userWithoutPassword,
    });
  } catch (error) {
    console.error('Approve user error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to approve user',
      error: error.message,
    });
  }
});

// @route   PUT /api/admin/users/:id/reject
// @desc    Reject a pending user
// @access  Admin only
router.put('/users/:id/reject', async (req, res) => {
  try {
    const { reason } = req.body;
    const user = await getDocumentById(COLLECTIONS.USERS, req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const updated = await updateDocument(COLLECTIONS.USERS, req.params.id, {
      accountStatus: 'rejected',
      requiresAdminApproval: false,
      verificationStatus: 'unverified',
      rejectionReason: reason || '',
      rejectedAt: admin.firestore.Timestamp.now(),
      rejectedBy: req.user.id,
    });

    try {
      await sendAccountRejectedEmail(updated.email, updated.name, reason || '');
    } catch (e) {
      // Non-fatal
      console.error('Rejection email failed:', e.message);
    }

    const { password, ...userWithoutPassword } = updated;
    res.json({
      success: true,
      message: 'User rejected',
      data: userWithoutPassword,
    });
  } catch (error) {
    console.error('Reject user error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reject user',
      error: error.message,
    });
  }
});

// @route   GET /api/admin/users
// @desc    Get all users with pagination and search
// @access  Admin only
router.get('/users', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || '';
    const role = req.query.role; // Optional filter by role

    // Build query conditions
    let conditions = [];
    
    if (role && ['user', 'admin'].includes(role)) {
      conditions.push({ field: 'role', operator: '==', value: role });
    }

    // Get all users matching conditions (we'll filter search in memory)
    // Avoid Firestore composite-index requirement (role equality + createdAt orderBy)
    // by fetching without orderBy and sorting in memory.
    let users = await queryDocuments(COLLECTIONS.USERS, conditions);

    const toMillis = (ts) => {
      if (!ts) return 0;
      if (typeof ts === 'number') return ts;
      if (typeof ts === 'string') {
        const parsed = Date.parse(ts);
        return Number.isFinite(parsed) ? parsed : 0;
      }
      if (typeof ts.toMillis === 'function') return ts.toMillis();
      if (typeof ts.toDate === 'function') return ts.toDate().getTime();
      if (typeof ts._seconds === 'number') return ts._seconds * 1000;
      return 0;
    };

    users.sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
    
    // Apply search filter
    if (search) {
      const searchLower = search.toLowerCase();
      users = users.filter(user =>
        user.name?.toLowerCase().includes(searchLower) ||
        user.email?.toLowerCase().includes(searchLower) ||
        user.memberId?.toLowerCase().includes(searchLower) ||
        user.phone?.toLowerCase().includes(searchLower)
      );
    }
    
    // Remove password field
    users = users.map(({ password, ...user }) => user);

    const total = users.length;
    const skip = (page - 1) * limit;
    const paginatedUsers = users.slice(skip, skip + limit);

    res.json({
      success: true,
      data: paginatedUsers,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch users',
      error: error.message,
    });
  }
});

// @route   GET /api/admin/users/:id
// @desc    Get user details with their family tree entries (read-only)
// @access  Admin only
router.get('/users/:id', async (req, res) => {
  try {
    const user = await getDocumentById(COLLECTIONS.USERS, req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }
    
    // Remove password
    const { password, ...userWithoutPassword } = user;

    // Get user's family tree entries (read-only for admin)
    // Avoid Firestore composite-index requirement (createdBy equality + createdAt orderBy)
    const familyTreeEntries = await queryDocuments(
      COLLECTIONS.FAMILY_TREE,
      [{ field: 'createdBy', operator: '==', value: user.id }]
    );

    const toMillis = (ts) => {
      if (!ts) return 0;
      if (typeof ts === 'number') return ts;
      if (typeof ts === 'string') {
        const parsed = Date.parse(ts);
        return Number.isFinite(parsed) ? parsed : 0;
      }
      if (typeof ts.toMillis === 'function') return ts.toMillis();
      if (typeof ts.toDate === 'function') return ts.toDate().getTime();
      if (typeof ts._seconds === 'number') return ts._seconds * 1000;
      return 0;
    };

    familyTreeEntries.sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));

    res.json({
      success: true,
      data: {
        user: userWithoutPassword,
        familyTreeEntries,
        familyTreeCount: familyTreeEntries.length,
      },
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user details',
      error: error.message,
    });
  }
});

// @route   PUT /api/admin/users/:id
// @desc    Update user details
// @access  Admin only
router.put('/users/:id', async (req, res) => {
  try {
    const { name, email, phone, memberId, role } = req.body;

    const user = await getDocumentById(COLLECTIONS.USERS, req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Check if memberId is being changed and if it's already taken
    if (memberId && memberId !== user.memberId) {
      const existingMemberId = await queryDocuments(
        COLLECTIONS.USERS,
        [{ field: 'memberId', operator: '==', value: memberId }],
        null,
        'asc',
        1
      );
      
      if (existingMemberId.length > 0 && existingMemberId[0].id !== user.id) {
        return res.status(400).json({
          success: false,
          message: 'Member ID already exists',
        });
      }
    }

    // Check if email is being changed and if it's already taken
    if (email && email.toLowerCase() !== user.email.toLowerCase()) {
      const existingEmail = await queryDocuments(
        COLLECTIONS.USERS,
        [{ field: 'email', operator: '==', value: email.toLowerCase() }],
        null,
        'asc',
        1
      );
      
      if (existingEmail.length > 0 && existingEmail[0].id !== user.id) {
        return res.status(400).json({
          success: false,
          message: 'Email already exists',
        });
      }
    }

    // Build update data
    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (email !== undefined) updateData.email = email.toLowerCase();
    if (phone !== undefined) updateData.phone = phone;
    if (memberId !== undefined) updateData.memberId = memberId;
    
    // Role update validation
    if (role !== undefined) {
      if (!['user', 'admin'].includes(role)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid role. Must be "user" or "admin"',
        });
      }
      updateData.role = role;
    }

    const updatedUser = await updateDocument(COLLECTIONS.USERS, user.id, updateData);
    const { password, ...userWithoutPassword } = updatedUser;

    res.json({
      success: true,
      message: 'User updated successfully',
      data: userWithoutPassword,
    });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update user',
      error: error.message,
    });
  }
});

// @route   PUT /api/admin/users/:id/password
// @desc    Change user password (requires current password)
// @access  Admin only
router.put('/users/:id/password', async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Current password and new password are required',
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 6 characters',
      });
    }

    // Note: Password validation and hashing should be handled by auth service
    // This is a placeholder - implement proper password handling with bcrypt
    return res.status(501).json({
      success: false,
      message: 'Password update not implemented for Firestore yet. Use Firebase Auth.',
    });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to change password',
      error: error.message,
    });
  }
});

// @route   PUT /api/admin/users/:id/role
// @desc    Update user role (promote/demote)
// @access  Admin only
router.put('/users/:id/role', async (req, res) => {
  try {
    const { role } = req.body;

    if (!role || !['user', 'admin'].includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Valid role is required (user or admin)',
      });
    }

    const user = await getDocumentById(COLLECTIONS.USERS, req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Prevent admin from demoting themselves
    if (user.id === req.user.id && role === 'user') {
      return res.status(400).json({
        success: false,
        message: 'You cannot demote yourself',
      });
    }

    const updatedUser = await updateDocument(COLLECTIONS.USERS, user.id, { role });
    const { password, ...userWithoutPassword } = updatedUser;

    res.json({
      success: true,
      message: `User ${role === 'admin' ? 'promoted to' : 'demoted to'} ${role}`,
      data: userWithoutPassword,
    });
  } catch (error) {
    console.error('Update role error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update user role',
      error: error.message,
    });
  }
});

// @route   DELETE /api/admin/users/:id
// @desc    Delete/deactivate a user
// @access  Admin only
router.delete('/users/:id', async (req, res) => {
  try {
    const { deleteFamilyTree } = req.query; // Optional: delete family tree entries too

    const user = await getDocumentById(COLLECTIONS.USERS, req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Prevent admin from deleting themselves
    if (user.id === req.user.id) {
      return res.status(400).json({
        success: false,
        message: 'You cannot delete your own account',
      });
    }

    // Delete family tree entries if requested
    let deletedCount = 0;
    if (deleteFamilyTree === 'true') {
      const familyTreeEntries = await queryDocuments(
        COLLECTIONS.FAMILY_TREE,
        [{ field: 'createdBy', operator: '==', value: user.id }]
      );
      
      for (const entry of familyTreeEntries) {
        await deleteDocument(COLLECTIONS.FAMILY_TREE, entry.id);
        deletedCount++;
      }
      console.log(`Deleted ${deletedCount} family tree entries for user ${user.email}`);
    }

    await deleteDocument(COLLECTIONS.USERS, user.id);

    res.json({
      success: true,
      message: 'User deleted successfully',
      deletedFamilyTreeEntries: deleteFamilyTree === 'true',
    });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete user',
      error: error.message,
    });
  }
});

// @route   GET /api/admin/users/:id/family-tree
// @desc    Get user's family tree entries (read-only for admin)
// @access  Admin only
router.get('/users/:id/family-tree', async (req, res) => {
  try {
    const user = await getDocumentById(COLLECTIONS.USERS, req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Avoid Firestore composite-index requirement (createdBy equality + createdAt orderBy)
    const familyTreeEntries = await queryDocuments(
      COLLECTIONS.FAMILY_TREE,
      [{ field: 'createdBy', operator: '==', value: user.id }]
    );

    const toMillis = (ts) => {
      if (!ts) return 0;
      if (typeof ts === 'number') return ts;
      if (typeof ts === 'string') {
        const parsed = Date.parse(ts);
        return Number.isFinite(parsed) ? parsed : 0;
      }
      if (typeof ts.toMillis === 'function') return ts.toMillis();
      if (typeof ts.toDate === 'function') return ts.toDate().getTime();
      if (typeof ts._seconds === 'number') return ts._seconds * 1000;
      return 0;
    };

    familyTreeEntries.sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));

    res.json({
      success: true,
      data: {
        user: { id: user.id, name: user.name, email: user.email, memberId: user.memberId },
        entries: familyTreeEntries,
        count: familyTreeEntries.length,
      },
      message: 'Family tree entries are read-only for admins',
    });
  } catch (error) {
    console.error('Get family tree error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch family tree entries',
      error: error.message,
    });
  }
});

// ============================================
// ADMIN STATISTICS & REPORTS
// ============================================

// @route   GET /api/admin/stats/overview
// @desc    Get comprehensive statistics overview
// @access  Admin only
router.get('/stats/overview', async (req, res) => {
  try {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - 7);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const todayTimestamp = admin.firestore.Timestamp.fromDate(startOfToday);
    const weekTimestamp = admin.firestore.Timestamp.fromDate(startOfWeek);
    const monthTimestamp = admin.firestore.Timestamp.fromDate(startOfMonth);

    const [
      totalUsers,
      todayUsers,
      weekUsers,
      monthUsers,
      committeeCount,
      sponsorCount,
      offerCount,
      eventCount,
      placeCount,
    ] = await Promise.all([
      countDocuments(COLLECTIONS.USERS),
      countDocuments(COLLECTIONS.USERS, [{ field: 'createdAt', operator: '>=', value: todayTimestamp }]),
      countDocuments(COLLECTIONS.USERS, [{ field: 'createdAt', operator: '>=', value: weekTimestamp }]),
      countDocuments(COLLECTIONS.USERS, [{ field: 'createdAt', operator: '>=', value: monthTimestamp }]),
      countDocuments(COLLECTIONS.COMMITTEE_MEMBERS),
      countDocuments(COLLECTIONS.SPONSORS),
      countDocuments(COLLECTIONS.SPECIAL_OFFERS),
      countDocuments(COLLECTIONS.UPCOMING_EVENTS),
      countDocuments(COLLECTIONS.SPIRITUAL_PLACES),
    ]);

    res.json({
      success: true,
      data: {
        users: {
          total: totalUsers,
          today: todayUsers,
          thisWeek: weekUsers,
          thisMonth: monthUsers,
        },
        content: {
          committee: committeeCount,
          sponsors: sponsorCount,
          offers: offerCount,
          events: eventCount,
          places: placeCount,
        },
      },
    });
  } catch (error) {
    console.error('Stats overview error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch statistics',
      error: error.message,
    });
  }
});

// ============================================
// PENDING USER APPROVALS - NEW VERIFICATION SYSTEM
// ============================================

// @route   GET /api/admin/pending-users
// @desc    Get all users pending approval
// @access  Admin only
router.get('/pending-users', async (req, res) => {
  try {
    const { page = 1, limit = 20, search = '' } = req.query;
    
    // Get pending users
    let pendingUsers = await queryDocuments(
      COLLECTIONS.USERS,
      [{ field: 'accountStatus', operator: '==', value: 'pending' }],
      'createdAt',
      'desc'
    );
    
    // Remove passwords
    pendingUsers = pendingUsers.map(({ password, ...user }) => user);
    
    // Add search if provided
    if (search) {
      const searchLower = search.toLowerCase();
      pendingUsers = pendingUsers.filter(user =>
        user.name?.toLowerCase().includes(searchLower) ||
        user.email?.toLowerCase().includes(searchLower) ||
        user.memberId?.toLowerCase().includes(searchLower) ||
        user.phone?.toLowerCase().includes(searchLower)
      );
    }
    
    const total = pendingUsers.length;
    const skip = (page - 1) * limit;
    const paginatedUsers = pendingUsers.slice(skip, parseInt(skip) + parseInt(limit));
    
    // For each pending user, check if their member ID exists in authorized list
    const usersWithDetails = await Promise.all(
      paginatedUsers.map(async (user) => {
        const authorizedMember = await queryDocuments(
          COLLECTIONS.AUTHORIZED_MEMBERS,
          [{ field: 'memberId', operator: '==', value: user.memberId }],
          null,
          'asc',
          1
        );
        
        let matchStatus = 'not_found';
        let matchDetails = {};
        
        if (authorizedMember.length > 0) {
          const authMember = authorizedMember[0];
          const userPhone = user.phone?.replace(/[\s\-\(\)]/g, '').trim() || '';
          const authPhone = authMember.phoneNumber?.replace(/[\s\-\(\)]/g, '').trim() || '';
          
          if (userPhone === authPhone) {
            matchStatus = 'exact_match';
          } else {
            matchStatus = 'phone_mismatch';
          }
          
          matchDetails = {
            authorizedPhone: authMember.phoneNumber,
            userPhone: user.phone,
            authorizedName: authMember.name,
          };
        }
        
        return {
          ...user,
          matchStatus,
          matchDetails,
        };
      })
    );
    
    res.json({
      success: true,
      data: usersWithDetails,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit),
        limit: parseInt(limit),
      },
    });
  } catch (error) {
    console.error('Get pending users error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch pending users',
      error: error.message,
    });
  }
});

// @route   GET /api/admin/pending-users/count
// @desc    Get count of pending users (for notifications)
// @access  Admin only
router.get('/pending-users/count', async (req, res) => {
  try {
    const count = await countDocuments(
      COLLECTIONS.USERS,
      [{ field: 'accountStatus', operator: '==', value: 'pending' }]
    );
    
    res.json({
      success: true,
      count,
    });
  } catch (error) {
    console.error('Get pending users count error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch pending users count',
      error: error.message,
    });
  }
});

// @route   POST /api/admin/pending-users/:id/approve
// @desc    Approve a pending user
// @access  Admin only
router.post('/pending-users/:id/approve', async (req, res) => {
  try {
    const user = await getDocumentById(COLLECTIONS.USERS, req.params.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }
    
    if (user.accountStatus !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'User is not in pending status',
      });
    }
    
    // Update user status
    const updateData = {
      accountStatus: 'approved',
      verificationStatus: 'verified',
      requiresAdminApproval: false,
      reviewedBy: req.user.id,
      reviewedAt: admin.firestore.Timestamp.now(),
    };
    
    const updatedUser = await updateDocument(COLLECTIONS.USERS, user.id, updateData);
    
    console.log(`✅ Admin ${req.user.email} approved user ${user.email}`);
    
    // TODO: Send notification to user (email/SMS)
    // This is a placeholder for future notification implementation
    // In production, you would call: await sendApprovalNotification(user);
    
    res.json({
      success: true,
      message: 'User approved successfully',
      data: {
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
        accountStatus: updatedUser.accountStatus,
      },
      notification: {
        placeholder: 'User notification will be implemented in production',
        message: 'Email/SMS notification would be sent here',
      },
    });
  } catch (error) {
    console.error('Approve user error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to approve user',
      error: error.message,
    });
  }
});

// @route   POST /api/admin/pending-users/:id/reject
// @desc    Reject a pending user
// @access  Admin only
router.post('/pending-users/:id/reject', async (req, res) => {
  try {
    const { reason } = req.body;
    
    const user = await getDocumentById(COLLECTIONS.USERS, req.params.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }
    
    if (user.accountStatus !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'User is not in pending status',
      });
    }
    
    // Update user status
    const updateData = {
      accountStatus: 'rejected',
      verificationStatus: 'unverified',
      requiresAdminApproval: false,
      reviewedBy: req.user.id,
      reviewedAt: admin.firestore.Timestamp.now(),
      rejectionReason: reason || 'No reason provided',
    };
    
    const updatedUser = await updateDocument(COLLECTIONS.USERS, user.id, updateData);
    
    console.log(`❌ Admin ${req.user.email} rejected user ${user.email}`);
    
    // TODO: Send notification to user (email/SMS)
    // This is a placeholder for future notification implementation
    // In production, you would call: await sendRejectionNotification(user, reason);
    
    res.json({
      success: true,
      message: 'User rejected successfully',
      data: {
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
        accountStatus: updatedUser.accountStatus,
        rejectionReason: updatedUser.rejectionReason,
      },
      notification: {
        placeholder: 'User notification will be implemented in production',
        message: 'Email/SMS notification would be sent here',
      },
    });
  } catch (error) {
    console.error('Reject user error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reject user',
      error: error.message,
    });
  }
});

// @route   GET /api/admin/authorized-members
// @desc    Get all authorized members from Excel import
// @access  Admin only
router.get('/authorized-members', async (req, res) => {
  try {
    const { page = 1, limit = 50, search = '', status = 'all' } = req.query;
    
    // Build conditions
    let conditions = [];
    
    // Filter by usage status
    if (status === 'used') {
      conditions.push({ field: 'isUsed', operator: '==', value: true });
    } else if (status === 'unused') {
      conditions.push({ field: 'isUsed', operator: '==', value: false });
    }
    
    // Get members
    let members = await queryDocuments(
      COLLECTIONS.AUTHORIZED_MEMBERS,
      conditions,
      'importedAt',
      'desc'
    );
    
    // Apply search filter in memory
    if (search) {
      const searchLower = search.toLowerCase();
      members = members.filter(member =>
        member.memberId?.toLowerCase().includes(searchLower) ||
        member.phoneNumber?.toLowerCase().includes(searchLower) ||
        member.name?.toLowerCase().includes(searchLower) ||
        member.email?.toLowerCase().includes(searchLower)
      );
    }
    
    // Get user details for usedBy field
    const membersWithUsers = await Promise.all(
      members.map(async (member) => {
        if (member.usedBy) {
          const user = await getDocumentById(COLLECTIONS.USERS, member.usedBy);
          return {
            ...member,
            usedByUser: user ? { id: user.id, name: user.name, email: user.email } : null,
          };
        }
        return member;
      })
    );
    
    const total = membersWithUsers.length;
    const skip = (page - 1) * limit;
    const paginatedMembers = membersWithUsers.slice(skip, parseInt(skip) + parseInt(limit));
    
    const usedCount = await countDocuments(COLLECTIONS.AUTHORIZED_MEMBERS, [
      { field: 'isUsed', operator: '==', value: true }
    ]);
    const unusedCount = await countDocuments(COLLECTIONS.AUTHORIZED_MEMBERS, [
      { field: 'isUsed', operator: '==', value: false }
    ]);
    
    res.json({
      success: true,
      data: paginatedMembers,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit),
        limit: parseInt(limit),
      },
      stats: {
        total,
        used: usedCount,
        unused: unusedCount,
      },
    });
  } catch (error) {
    console.error('Get authorized members error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch authorized members',
      error: error.message,
    });
  }
});

module.exports = router;
