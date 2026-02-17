const { auth, getDocumentById, findOneDocument, COLLECTIONS } = require('../config/firestore');

// Verify Firebase ID token (does not require Firestore user doc)
exports.verifyFirebaseToken = async (req, res, next) => {
  try {
    let token;

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
      const decoded = await auth.verifyIdToken(token);
      req.firebaseUser = decoded;
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

// Protect routes - verify Firebase ID token and load Firestore user
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
      // Verify Firebase ID token
      const decoded = await auth.verifyIdToken(token);
      req.firebaseUser = decoded;

      // Get user from Firestore.
      // Preferred: doc id == Firebase uid.
      // Back-compat: older users may have random doc ids and store the Firebase uid in `firebaseUid`.
      let user = await getDocumentById(COLLECTIONS.USERS, decoded.uid);
      if (!user) {
        user = await findOneDocument(COLLECTIONS.USERS, [
          { field: 'firebaseUid', operator: '==', value: decoded.uid },
        ]);
      }

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
