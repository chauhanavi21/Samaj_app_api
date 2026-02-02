const { clerkClient } = require('@clerk/clerk-sdk-node');
const User = require('../models/User');

// Middleware to verify Clerk token and get user
const protect = async (req, res, next) => {
  try {
    // Get token from header
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized - No token provided',
      });
    }

    // Verify token with Clerk
    const sessionClaims = await clerkClient.verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY,
    });

    if (!sessionClaims || !sessionClaims.sub) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized - Invalid token',
      });
    }

    // Get Clerk user ID
    const clerkId = sessionClaims.sub;

    // Find user in MongoDB by Clerk ID
    const user = await User.findOne({ clerkId });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found in database',
      });
    }

    // Attach user to request
    req.user = user;
    req.clerkId = clerkId;

    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(401).json({
      success: false,
      message: 'Not authorized - Token verification failed',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// Middleware to check if user is admin
const admin = async (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({
      success: false,
      message: 'Not authorized - Admin access required',
    });
  }
};

module.exports = { protect, admin };
