const jwt = require('jsonwebtoken');
const { getDocumentById, COLLECTIONS } = require('../config/firestore');

// Protect routes - verify JWT token
exports.protect = async (req, res, next) => {
  try {
    let token;

    // Check for token in headers
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized to access this route',
      });
    }

    try {
      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Get user from Firestore
      const user = await getDocumentById(COLLECTIONS.USERS, decoded.id);

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'User not found',
        });
      }

      // Remove password from user object
      delete user.password;

      // Block access for non-approved accounts
      if (user.accountStatus === 'rejected') {
        return res.status(403).json({
          success: false,
          message: 'Your account has been rejected. Please contact admin.',
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

      req.user = user;

      next();
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized to access this route',
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
};

// Grant access to specific roles
exports.authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `User role '${req.user.role}' is not authorized to access this route`,
      });
    }
    next();
  };
};
