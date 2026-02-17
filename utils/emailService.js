/**
 * Firebase-only email policy
 *
 * This project no longer sends emails from the backend.
 * Use Firebase Auth client APIs instead:
 *  - Email verification: sendEmailVerification(auth.currentUser)
 *  - Password reset: sendPasswordResetEmail(auth, email)
 *
 * These stubs remain only to avoid breaking existing imports.
 */

const skipped = (name) => ({
  success: false,
  skipped: true,
  message: `Email operation '${name}' is disabled. Use Firebase Auth client APIs instead.`,
});

const sendPasswordResetEmail = async () => skipped('sendPasswordResetEmail');
const sendWelcomeEmail = async () => skipped('sendWelcomeEmail');
const sendAccountApprovedEmail = async () => skipped('sendAccountApprovedEmail');
const sendAccountRejectedEmail = async () => skipped('sendAccountRejectedEmail');

module.exports = {
  sendPasswordResetEmail,
  sendWelcomeEmail,
  sendAccountApprovedEmail,
  sendAccountRejectedEmail,
};
