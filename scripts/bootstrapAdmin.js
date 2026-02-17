/**
 * Bootstrap Admin Script for Firestore
 * Creates the first admin user if none exists
 * 
 * Usage:
 *   node scripts/bootstrapAdmin.js
 * 
 * Or enable auto-bootstrap by setting in .env:
 *   ENABLE_ADMIN_BOOTSTRAP=true
 *   ADMIN_EMAIL=admin@example.com
 *   ADMIN_PASSWORD=yourpassword
 *   ADMIN_NAME=Admin Name
 *   ADMIN_MEMBER_ID=ADMIN001
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const { auth, COLLECTIONS, createDocument, queryDocuments, updateDocument } = require('../config/firestore');

async function bootstrapAdmin() {
  try {
    console.log('\n🔧 Starting admin bootstrap process...');

    // Check if admin already exists
    const existingAdmins = await queryDocuments(COLLECTIONS.USERS, [
      { field: 'role', operator: '==', value: 'admin' }
    ]);

    // Get admin credentials from environment
    const adminEmail = process.env.ADMIN_EMAIL;
    const adminPassword = process.env.ADMIN_PASSWORD;
    const adminName = process.env.ADMIN_NAME || 'Admin';
    const adminMemberId = process.env.ADMIN_MEMBER_ID || 'ADMIN001';

    if (!adminEmail || !adminPassword) {
      console.log('⚠️  Admin credentials not found in environment variables.');
      console.log('   Set ADMIN_EMAIL and ADMIN_PASSWORD in .env to enable bootstrap.');
      return;
    }

    const normalizedEmail = String(adminEmail).trim().toLowerCase();

    // Validate email format
    const emailRegex = /^\S+@\S+\.\S+$/;
    if (!emailRegex.test(normalizedEmail)) {
      console.log('❌ Invalid admin email format');
      return;
    }

    // Validate password length
    if (adminPassword.length < 6) {
      console.log('❌ Admin password must be at least 6 characters');
      return;
    }

    if (existingAdmins.length > 0) {
      console.log('ℹ️  Admin user already exists in Firestore. Ensuring Firebase Auth linkage...');
      console.log(`   Found ${existingAdmins.length} admin(s)`);

      // Link the first admin found.
      const existing = existingAdmins[0];
      let uid = existing.firebaseUid || null;

      if (uid) {
        try {
          await auth.getUser(uid);
        } catch (e) {
          uid = null;
        }
      }

      if (!uid) {
        try {
          const fb = await auth.getUserByEmail(normalizedEmail);
          uid = fb.uid;
        } catch (e) {
          // ignore
        }
      }

      if (!uid) {
        const created = await auth.createUser({
          email: normalizedEmail,
          password: adminPassword,
          displayName: adminName,
        });
        uid = created.uid;
      } else {
        await auth.updateUser(uid, { password: adminPassword, displayName: adminName, email: normalizedEmail });
      }

      if (!existing.firebaseUid || existing.firebaseUid !== uid) {
        await updateDocument(COLLECTIONS.USERS, existing.id, { firebaseUid: uid });
      }

      console.log('✅ Admin Firebase Auth linkage ensured.');
      console.log(`   Firebase UID: ${uid}`);
      console.log(`   Firestore Admin Doc ID: ${existing.id}`);
      return;
    }

    console.log('📝 Creating admin user...');
    console.log(`   Email: ${normalizedEmail}`);
    console.log(`   Name: ${adminName}`);
    console.log(`   Member ID: ${adminMemberId}`);

    const created = await auth.createUser({
      email: normalizedEmail,
      password: adminPassword,
      displayName: adminName,
    });

    const uid = created.uid;

    // Create admin user
    const adminData = {
      name: adminName,
      email: normalizedEmail,
      role: 'admin',
      memberId: adminMemberId,
      phone: '',
      accountStatus: 'approved',
      verificationStatus: 'verified',
      requiresAdminApproval: false,
      firebaseUid: uid,
      notificationPreferences: {
        email: true,
        sms: false,
      },
    };

    const newAdmin = await createDocument(COLLECTIONS.USERS, adminData, uid);

    console.log('✅ Admin user created successfully!');
    console.log(`   User ID: ${newAdmin.id}`);
    console.log('\n🎉 You can now login with:');
    console.log(`   Email: ${normalizedEmail}`);
    console.log(`   Password: ${adminPassword}`);
    console.log('\n⚠️  IMPORTANT: Change this password after first login!\n');

  } catch (error) {
    console.error('❌ Error creating admin:', error.message);
    throw error;
  }
}

// Run if executed directly
if (require.main === module) {
  bootstrapAdmin()
    .then(() => {
      console.log('\n✅ Bootstrap complete');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Bootstrap failed:', error);
      process.exit(1);
    });
}

module.exports = bootstrapAdmin;
