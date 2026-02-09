const path = require('path');
const admin = require('firebase-admin');

/*
 * Firebase Admin initialization
 *
 * This file initializes the Firebase Admin SDK using a service account key.
 * Place your service account JSON file (downloaded from the Firebase console)
 * at the root of your project and name it `serviceAccountKey.json`. Do NOT
 * commit this file to source control. The JSON should contain the keys
 * `project_id`, `client_email`, and `private_key`, among others. See the
 * Firebase documentation for details.
 */

// Resolve the path to the service account key relative to this file.
const serviceAccountPath = path.join(__dirname, 'serviceAccountKey.json');
let serviceAccount;
try {
  serviceAccount = require(serviceAccountPath);
} catch (error) {
  console.error(
    '\n❌ Unable to load serviceAccountKey.json. Please download your service account key from the Firebase console and place it in the root of your project.\n'
  );
  throw error;
}

// Initialize the Firebase Admin SDK only once.
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

// Export Firestore and Auth instances for use elsewhere in the backend.
const db = admin.firestore();
const auth = admin.auth();

module.exports = { admin, db, auth };
