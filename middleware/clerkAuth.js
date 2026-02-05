// Clerk is no longer used in this project.
// JWT/MongoDB auth is implemented in middleware/auth.js.

const protect = async (req, res) => {
  return res.status(410).json({
    success: false,
    message: 'Clerk integration has been removed. Use JWT auth middleware instead.',
  });
};

const admin = async (req, res) => {
  return res.status(410).json({
    success: false,
    message: 'Clerk integration has been removed. Use JWT auth middleware instead.',
  });
};

module.exports = { protect, admin };
