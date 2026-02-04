const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const User = require('../models/User');
const FamilyTree = require('../models/FamilyTree');
const PageContent = require('../models/PageContent');
const { protect, authorize } = require('../middleware/auth');

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
    const totalUsers = await User.countDocuments();
    const totalAdmins = await User.countDocuments({ role: 'admin' });
    const totalRegularUsers = await User.countDocuments({ role: 'user' });
    const totalFamilyTreeEntries = await FamilyTree.countDocuments();

    // Get recent signups (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const recentSignups = await User.find({
      createdAt: { $gte: thirtyDaysAgo }
    })
      .select('name email role memberId createdAt')
      .sort({ createdAt: -1 })
      .limit(10);

    // Get signups per month for the last 6 months
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    
    const signupTrend = await User.aggregate([
      {
        $match: { createdAt: { $gte: sixMonthsAgo } }
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { '_id.year': 1, '_id.month': 1 }
      }
    ]);

    // Get most active users (by family tree entries)
    const activeUsers = await FamilyTree.aggregate([
      {
        $group: {
          _id: '$createdBy',
          entryCount: { $sum: 1 }
        }
      },
      {
        $sort: { entryCount: -1 }
      },
      {
        $limit: 5
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user'
        }
      },
      {
        $unwind: '$user'
      },
      {
        $project: {
          name: '$user.name',
          email: '$user.email',
          memberId: '$user.memberId',
          entryCount: 1
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        totals: {
          users: totalUsers,
          admins: totalAdmins,
          regularUsers: totalRegularUsers,
          familyTreeEntries: totalFamilyTreeEntries,
        },
        recentSignups: recentSignups.map(user => ({
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          memberId: user.memberId,
          createdAt: user.createdAt,
        })),
        signupTrend,
        activeUsers,
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
// PAGE CONTENT MANAGEMENT (CMS)
// ============================================

// @route   GET /api/admin/pages
// @desc    Get all pages
// @access  Admin only
router.get('/pages', async (req, res) => {
  try {
    const pages = await PageContent.find()
      .populate('lastModifiedBy', 'name email')
      .sort({ displayName: 1 });

    res.json({
      success: true,
      count: pages.length,
      data: pages,
    });
  } catch (error) {
    console.error('Get pages error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch pages',
      error: error.message,
    });
  }
});

// @route   GET /api/admin/pages/:pageName
// @desc    Get a specific page by pageName
// @access  Admin only
router.get('/pages/:pageName', async (req, res) => {
  try {
    const page = await PageContent.findOne({ pageName: req.params.pageName.toLowerCase() })
      .populate('lastModifiedBy', 'name email');

    if (!page) {
      return res.status(404).json({
        success: false,
        message: 'Page not found',
      });
    }

    res.json({
      success: true,
      data: page,
    });
  } catch (error) {
    console.error('Get page error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch page',
      error: error.message,
    });
  }
});

// @route   POST /api/admin/pages
// @desc    Create a new page
// @access  Admin only
router.post('/pages', async (req, res) => {
  try {
    const { pageName, displayName, sections, isPublished } = req.body;

    // Validation
    if (!pageName || !displayName) {
      return res.status(400).json({
        success: false,
        message: 'Page name and display name are required',
      });
    }

    // Check if page already exists
    const existingPage = await PageContent.findOne({ pageName: pageName.toLowerCase() });
    if (existingPage) {
      return res.status(400).json({
        success: false,
        message: 'A page with this name already exists',
      });
    }

    const page = await PageContent.create({
      pageName: pageName.toLowerCase(),
      displayName,
      sections: sections || [],
      isPublished: isPublished !== undefined ? isPublished : true,
      lastModifiedBy: req.user._id,
    });

    const populatedPage = await PageContent.findById(page._id)
      .populate('lastModifiedBy', 'name email');

    res.status(201).json({
      success: true,
      message: 'Page created successfully',
      data: populatedPage,
    });
  } catch (error) {
    console.error('Create page error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create page',
      error: error.message,
    });
  }
});

// @route   PUT /api/admin/pages/:pageName
// @desc    Update a page
// @access  Admin only
router.put('/pages/:pageName', async (req, res) => {
  try {
    const { displayName, sections, isPublished } = req.body;

    const page = await PageContent.findOne({ pageName: req.params.pageName.toLowerCase() });

    if (!page) {
      return res.status(404).json({
        success: false,
        message: 'Page not found',
      });
    }

    // Update fields
    if (displayName !== undefined) page.displayName = displayName;
    if (sections !== undefined) page.sections = sections;
    if (isPublished !== undefined) page.isPublished = isPublished;
    page.lastModifiedBy = req.user._id;

    await page.save();

    const populatedPage = await PageContent.findById(page._id)
      .populate('lastModifiedBy', 'name email');

    res.json({
      success: true,
      message: 'Page updated successfully',
      data: populatedPage,
    });
  } catch (error) {
    console.error('Update page error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update page',
      error: error.message,
    });
  }
});

// @route   DELETE /api/admin/pages/:pageName
// @desc    Delete a page
// @access  Admin only
router.delete('/pages/:pageName', async (req, res) => {
  try {
    const page = await PageContent.findOneAndDelete({ pageName: req.params.pageName.toLowerCase() });

    if (!page) {
      return res.status(404).json({
        success: false,
        message: 'Page not found',
      });
    }

    res.json({
      success: true,
      message: 'Page deleted successfully',
    });
  } catch (error) {
    console.error('Delete page error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete page',
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

// @route   GET /api/admin/users
// @desc    Get all users with pagination and search
// @access  Admin only
router.get('/users', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || '';
    const role = req.query.role; // Optional filter by role

    // Build search query
    let query = {};
    
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { memberId: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
      ];
    }

    if (role && ['user', 'admin'].includes(role)) {
      query.role = role;
    }

    const skip = (page - 1) * limit;

    const users = await User.find(query)
      .select('-password')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await User.countDocuments(query);

    res.json({
      success: true,
      data: users,
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
    const user = await User.findById(req.params.id).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Get user's family tree entries (read-only for admin)
    const familyTreeEntries = await FamilyTree.find({ createdBy: user._id })
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: {
        user,
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

    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Check if memberId is being changed and if it's already taken
    if (memberId && memberId !== user.memberId) {
      const existingMemberId = await User.findOne({ 
        memberId, 
        _id: { $ne: user._id } 
      });
      
      if (existingMemberId) {
        return res.status(400).json({
          success: false,
          message: 'Member ID already exists',
        });
      }
    }

    // Check if email is being changed and if it's already taken
    if (email && email !== user.email) {
      const existingEmail = await User.findOne({ 
        email: email.toLowerCase(), 
        _id: { $ne: user._id } 
      });
      
      if (existingEmail) {
        return res.status(400).json({
          success: false,
          message: 'Email already exists',
        });
      }
    }

    // Update allowed fields
    if (name !== undefined) user.name = name;
    if (email !== undefined) user.email = email.toLowerCase();
    if (phone !== undefined) user.phone = phone;
    if (memberId !== undefined) user.memberId = memberId;
    
    // Role update validation
    if (role !== undefined) {
      if (!['user', 'admin'].includes(role)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid role. Must be "user" or "admin"',
        });
      }
      user.role = role;
    }

    await user.save();

    const updatedUser = await User.findById(user._id).select('-password');

    res.json({
      success: true,
      message: 'User updated successfully',
      data: updatedUser,
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

    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Verify current password
    const isMatch = await user.matchPassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: 'Current password is incorrect',
      });
    }

    // Update password (will be hashed by pre-save hook)
    user.password = newPassword;
    await user.save();

    res.json({
      success: true,
      message: 'Password updated successfully',
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

    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Prevent admin from demoting themselves
    if (user._id.toString() === req.user._id.toString() && role === 'user') {
      return res.status(400).json({
        success: false,
        message: 'You cannot demote yourself',
      });
    }

    user.role = role;
    await user.save();

    const updatedUser = await User.findById(user._id).select('-password');

    res.json({
      success: true,
      message: `User ${role === 'admin' ? 'promoted to' : 'demoted to'} ${role}`,
      data: updatedUser,
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

    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Prevent admin from deleting themselves
    if (user._id.toString() === req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        message: 'You cannot delete your own account',
      });
    }

    // Delete family tree entries if requested
    if (deleteFamilyTree === 'true') {
      const deleteResult = await FamilyTree.deleteMany({ createdBy: user._id });
      console.log(`Deleted ${deleteResult.deletedCount} family tree entries for user ${user.email}`);
    }

    await User.findByIdAndDelete(user._id);

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
    const user = await User.findById(req.params.id).select('name email memberId');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    const familyTreeEntries = await FamilyTree.find({ createdBy: user._id })
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: {
        user,
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

    const [
      totalUsers,
      todayUsers,
      weekUsers,
      monthUsers,
      totalPages,
      publishedPages,
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ createdAt: { $gte: startOfToday } }),
      User.countDocuments({ createdAt: { $gte: startOfWeek } }),
      User.countDocuments({ createdAt: { $gte: startOfMonth } }),
      PageContent.countDocuments(),
      PageContent.countDocuments({ isPublished: true }),
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
        pages: {
          total: totalPages,
          published: publishedPages,
          draft: totalPages - publishedPages,
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

module.exports = router;
