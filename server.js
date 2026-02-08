const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const connectDB = require('./config/db');
const cronJob = require('./config/cron');
const bootstrapAdmin = require('./scripts/bootstrapAdmin');

// Load env vars
dotenv.config();

// Start cron job in production to prevent server spin-down
if (process.env.NODE_ENV === 'production') {
  cronJob.start();
  console.log('🔄 Cron job started - server will self-ping every 14 minutes');
}

// Connect to database
connectDB().then(async () => {
  // Bootstrap admin account if enabled
  if (process.env.ENABLE_ADMIN_BOOTSTRAP === 'true') {
    try {
      await bootstrapAdmin();
    } catch (error) {
      console.error('⚠️  Admin bootstrap failed:', error.message);
      // Don't stop server if bootstrap fails
    }
  }
});

const app = express();

// Middleware
app.use(cors({
  origin: '*', // Allow all origins in development
  credentials: true,
}));

// Body parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware (for debugging) - MUST be after body parser
app.use((req, res, next) => {
  if (req.path !== '/api/health') { // Don't log health checks
    console.log(`\n[${new Date().toLocaleTimeString()}] ${req.method} ${req.path}`);
    if (req.body && Object.keys(req.body).length > 0) {
      console.log('Body:', JSON.stringify(req.body, null, 2));
    } else if (req.body) {
      console.log('Body (empty or not parsed):', req.body);
    }
  }
  next();
});

// Routes
// JWT auth routes (MongoDB-based)
app.use('/api/auth', require('./routes/auth'));

// Public dynamic content routes
app.use('/api/content', require('./routes/content'));

// Family tree routes
app.use('/api/family-tree', require('./routes/familyTree'));

// Admin routes (protected)
app.use('/api/admin', require('./routes/admin'));

// Admin-managed dynamic content routes (protected)
app.use('/api/admin/content', require('./routes/adminContent'));

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use('/api/information', require('./routes/information'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'Server is running',
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: 'Something went wrong!',
    error: process.env.NODE_ENV === 'development' ? err.message : {},
  });
});

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});
