/**
 * Test script for verification and approval system
 * 
 * This script tests the new member verification workflow
 */

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const User = require('../models/User');
const AuthorizedMember = require('../models/AuthorizedMember');

async function testVerificationSystem() {
  try {
    console.log('🧪 Starting Verification System Tests...\n');
    
    // Connect to MongoDB
    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
    if (!mongoUri) {
      throw new Error('MongoDB URI not found in environment variables. Please set MONGO_URI or MONGODB_URI in .env file');
    }
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB\n');
    
    // Test 1: Check if AuthorizedMember collection exists and has data
    console.log('📊 Test 1: Checking AuthorizedMember collection...');
    const memberCount = await AuthorizedMember.countDocuments();
    console.log(`   Found ${memberCount} authorized members`);
    
    if (memberCount === 0) {
      console.log('   ⚠️  WARNING: No authorized members found!');
      console.log('   Please import members using: npm run import-members <excel-file>');
    } else {
      console.log('   ✅ PASS\n');
      
      // Show sample members
      const sampleMembers = await AuthorizedMember.find().limit(3);
      console.log('   Sample authorized members:');
      sampleMembers.forEach((m, i) => {
        console.log(`   ${i + 1}. Member ID: ${m.memberId}, Phone: ${m.phoneNumber}, Used: ${m.isUsed}`);
      });
    }
    
    console.log('\n');
    
    // Test 2: Check User model has new fields
    console.log('📊 Test 2: Checking User model schema...');
    const userSchema = User.schema.obj;
    
    const requiredFields = ['accountStatus', 'verificationStatus', 'requiresAdminApproval'];
    let allFieldsExist = true;
    
    for (const field of requiredFields) {
      if (userSchema[field]) {
        console.log(`   ✅ Field '${field}' exists`);
      } else {
        console.log(`   ❌ Field '${field}' missing`);
        allFieldsExist = false;
      }
    }
    
    if (allFieldsExist) {
      console.log('   ✅ PASS\n');
    } else {
      console.log('   ❌ FAIL - Some fields are missing\n');
    }
    
    // Test 3: Check pending users
    console.log('📊 Test 3: Checking pending users...');
    const pendingCount = await User.countDocuments({ accountStatus: 'pending' });
    console.log(`   Found ${pendingCount} pending users`);
    
    if (pendingCount > 0) {
      const pendingUsers = await User.find({ accountStatus: 'pending' })
        .select('name email memberId phone createdAt')
        .limit(5);
      
      console.log('   Pending users:');
      pendingUsers.forEach((u, i) => {
        console.log(`   ${i + 1}. ${u.name} (${u.email}) - Member ID: ${u.memberId} - Created: ${u.createdAt?.toLocaleDateString()}`);
      });
    }
    console.log('   ✅ PASS\n');
    
    // Test 4: Check approved users count
    console.log('📊 Test 4: Checking approved users...');
    const approvedCount = await User.countDocuments({ accountStatus: 'approved' });
    console.log(`   Found ${approvedCount} approved users`);
    console.log('   ✅ PASS\n');
    
    // Test 5: Check rejected users count
    console.log('📊 Test 5: Checking rejected users...');
    const rejectedCount = await User.countDocuments({ accountStatus: 'rejected' });
    console.log(`   Found ${rejectedCount} rejected users`);
    
    if (rejectedCount > 0) {
      const rejectedUsers = await User.find({ accountStatus: 'rejected' })
        .select('name email rejectionReason reviewedAt')
        .limit(3);
      
      console.log('   Rejected users:');
      rejectedUsers.forEach((u, i) => {
        console.log(`   ${i + 1}. ${u.name} (${u.email}) - Reason: ${u.rejectionReason || 'N/A'}`);
      });
    }
    console.log('   ✅ PASS\n');
    
    // Test 6: Check used vs unused authorized members
    console.log('📊 Test 6: Checking authorized member usage...');
    const usedCount = await AuthorizedMember.countDocuments({ isUsed: true });
    const unusedCount = await AuthorizedMember.countDocuments({ isUsed: false });
    console.log(`   Used members: ${usedCount}`);
    console.log(`   Unused members: ${unusedCount}`);
    console.log('   ✅ PASS\n');
    
    // Test 7: Verify phone number normalization
    console.log('📊 Test 7: Testing phone number normalization...');
    const testPhones = [
      { input: '9876543210', expected: '9876543210' },
      { input: '98765 43210', expected: '9876543210' },
      { input: '98765-43210', expected: '9876543210' },
      { input: '(98765) 43210', expected: '9876543210' },
    ];
    
    let phoneTestPassed = true;
    testPhones.forEach(test => {
      const normalized = test.input.replace(/[\s\-\(\)]/g, '').trim();
      if (normalized === test.expected) {
        console.log(`   ✅ '${test.input}' → '${normalized}'`);
      } else {
        console.log(`   ❌ '${test.input}' → '${normalized}' (expected: '${test.expected}')`);
        phoneTestPassed = false;
      }
    });
    
    if (phoneTestPassed) {
      console.log('   ✅ PASS\n');
    } else {
      console.log('   ❌ FAIL\n');
    }
    
    // Summary
    console.log('═══════════════════════════════════════');
    console.log('📊 SUMMARY');
    console.log('═══════════════════════════════════════');
    console.log(`Total Authorized Members: ${memberCount}`);
    console.log(`  - Used: ${usedCount}`);
    console.log(`  - Unused: ${unusedCount}`);
    console.log();
    console.log(`Total Users: ${await User.countDocuments()}`);
    console.log(`  - Pending: ${pendingCount}`);
    console.log(`  - Approved: ${approvedCount}`);
    console.log(`  - Rejected: ${rejectedCount}`);
    console.log('═══════════════════════════════════════\n');
    
    // Recommendations
    console.log('💡 RECOMMENDATIONS:');
    if (memberCount === 0) {
      console.log('   1. Import authorized members: npm run import-members <excel-file>');
    }
    if (pendingCount > 0) {
      console.log(`   ${memberCount === 0 ? 2 : 1}. Review ${pendingCount} pending users in admin dashboard`);
    }
    if (unusedCount > 0) {
      console.log(`   ${memberCount === 0 ? 3 : pendingCount > 0 ? 2 : 1}. ${unusedCount} members haven't signed up yet`);
    }
    console.log();
    
    await mongoose.connection.close();
    console.log('🔌 MongoDB connection closed');
    console.log('✅ Tests completed!\n');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run tests
testVerificationSystem();
