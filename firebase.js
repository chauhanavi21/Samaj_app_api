const path = require('path');
const admin = require('firebase-admin');

/*
 * Firebase Admin initialization
 *
 * PRODUCTION (Render): Uses environment variables (secure!)
 * DEVELOPMENT: Uses serviceAccountKey.json (local only, NOT in git)
 *
 * Environment variables:
 * - FIREBASE_PROJECT_ID
 * - FIREBASE_CLIENT_EMAIL
 * - FIREBASE_PRIVATE_KEY
 */

let credential;

// Check if environment variables are set (production)
if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
  console.log('🔧 Using Firebase credentials from environment variables');
  
  credential = admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'), // Fix escaped newlines
  });
} else {
  // Fall back to serviceAccountKey.json for local development
  console.log('🔧 Using Firebase credentials from serviceAccountKey.json');
  
  const serviceAccountPath = path.join(__dirname, 'serviceAccountKey.json');
  try {
    const serviceAccount = require(serviceAccountPath);
    credential = admin.credential.cert(serviceAccount);
  } catch (error) {
    console.error(
      '\n❌ Firebase credentials not found!\n' +
      'For PRODUCTION: Set environment variables (FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY)\n' +
      'For DEVELOPMENT: Place serviceAccountKey.json in the backend folder\n'
    );
    throw error;
  }
}

// Initialize the Firebase Admin SDK only once.
if (!admin.apps.length) {
  admin.initializeApp({ credential });
}

// Export Firestore and Auth instances for use elsewhere in the backend.
const db = admin.firestore();
const auth = admin.auth();

module.exports = { admin, db, auth };
