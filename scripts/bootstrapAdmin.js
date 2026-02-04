const User = require('../models/User');
const mongoose = require('mongoose');

/**
 * Bootstrap Admin Account
 * Safely creates or updates the admin account specified in environment variables
 * 
 * Usage:
 * 1. Set ADMIN_BOOTSTRAP_EMAIL and ADMIN_BOOTSTRAP_PASSWORD in .env
 * 2. Set ENABLE_ADMIN_BOOTSTRAP=true to enable automatic bootstrap on server start
 * 3. Or run this script manually: node scripts/bootstrapAdmin.js
 */

async function bootstrapAdmin() {
  try {
    const adminEmail = process.env.ADMIN_BOOTSTRAP_EMAIL;
    const adminPassword = process.env.ADMIN_BOOTSTRAP_PASSWORD;
    const adminMemberId = process.env.ADMIN_BOOTSTRAP_MEMBER_ID || 'ADMIN-001';

    // Validation
    if (!adminEmail) {
      console.log('⚠️  ADMIN_BOOTSTRAP_EMAIL not set. Skipping admin bootstrap.');
      return false;
    }

    if (!adminPassword) {
      console.log('⚠️  ADMIN_BOOTSTRAP_PASSWORD not set. Skipping admin bootstrap.');
      return false;
    }

    if (adminPassword.length < 8) {
      console.log('⚠️  ADMIN_BOOTSTRAP_PASSWORD must be at least 8 characters. Skipping admin bootstrap.');
      return false;
    }

    console.log('\n🔐 Starting admin bootstrap process...');
    console.log(`📧 Admin Email: ${adminEmail}`);

    // Check if admin already exists
    let admin = await User.findOne({ email: adminEmail.toLowerCase() });

    if (admin) {
      // Update existing user to ensure they're an admin
      if (admin.role !== 'admin') {
        console.log(`👤 User exists with role '${admin.role}', promoting to admin...`);
        admin.role = 'admin';
        await admin.save();
        console.log('✅ User promoted to admin successfully');
      } else {
        console.log('✅ Admin account already exists');
      }
      
      console.log('ℹ️  Admin Details:');
      console.log(`   Name: ${admin.name}`);
      console.log(`   Email: ${admin.email}`);
      console.log(`   Member ID: ${admin.memberId}`);
      console.log(`   Role: ${admin.role}`);
      console.log(`   Created: ${admin.createdAt}`);
      
      return true;
    }

    // Check if member ID is taken
    const existingMemberId = await User.findOne({ memberId: adminMemberId });
    let finalMemberId = adminMemberId;
    
    if (existingMemberId) {
      // Generate a unique member ID
      finalMemberId = `ADMIN-${Date.now()}`;
      console.log(`⚠️  Member ID ${adminMemberId} is taken, using ${finalMemberId}`);
    }

    // Create new admin
    admin = await User.create({
      name: process.env.ADMIN_BOOTSTRAP_NAME || 'Administrator',
      email: adminEmail.toLowerCase(),
      password: adminPassword,
      phone: process.env.ADMIN_BOOTSTRAP_PHONE || '',
      memberId: finalMemberId,
      role: 'admin',
    });

    console.log('✅ Admin account created successfully!');
    console.log('\n📋 Admin Details:');
    console.log(`   Name: ${admin.name}`);
    console.log(`   Email: ${admin.email}`);
    console.log(`   Member ID: ${admin.memberId}`);
    console.log(`   Role: ${admin.role}`);
    console.log('\n⚠️  SECURITY NOTICE:');
    console.log('   Please change the admin password after first login!');
    console.log('   Remove or change ADMIN_BOOTSTRAP_PASSWORD in .env for security.');
    console.log('   Consider setting ENABLE_ADMIN_BOOTSTRAP=false after initial setup.\n');

    return true;
  } catch (error) {
    console.error('❌ Admin bootstrap failed:', error.message);
    throw error;
  }
}

// If run directly (not imported)
if (require.main === module) {
  const dotenv = require('dotenv');
  dotenv.config();

  // Connect to database
  const connectDB = require('../config/db');
  
  connectDB()
    .then(() => {
      console.log('Database connected');
      return bootstrapAdmin();
    })
    .then((success) => {
      if (success) {
        console.log('\n✅ Bootstrap completed successfully');
      } else {
        console.log('\n⚠️  Bootstrap skipped - check configuration');
      }
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Bootstrap failed:', error);
      process.exit(1);
    });
}

module.exports = bootstrapAdmin;
