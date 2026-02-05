/**
 * Script to create admin users
 * Run this after setting up the database: node scripts/createAdmins.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB Connected');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
};

const createAdmins = async () => {
  await connectDB();

  const adminEmails = (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  
  if (adminEmails.length === 0) {
    console.log('No admin emails found in .env file');
    process.exit(0);
  }

  console.log('Creating admin users...');

  for (const email of adminEmails) {
    try {
      const existingUser = await User.findOne({ email: email.toLowerCase() });
      
      if (existingUser) {
        // Update existing user to admin
        existingUser.role = 'admin';
        await existingUser.save();
        console.log(`✓ Updated ${email} to admin`);
      } else {
        // Create new admin user (you'll need to set password manually)
        console.log(`⚠ User ${email} does not exist. Please create account first, then run this script again.`);
      }
    } catch (error) {
      console.error(`Error processing ${email}:`, error.message);
    }
  }

  console.log('Done!');
  process.exit(0);
};

createAdmins();
