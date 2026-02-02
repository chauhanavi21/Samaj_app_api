// Test Email Configuration
// Run: node test-email.js

require('dotenv').config();
const { sendPasswordResetEmail } = require('./utils/emailService');

console.log('📧 Testing Email Configuration...\n');

console.log('Environment Variables:');
console.log('RESEND_API_KEY:', process.env.RESEND_API_KEY ? '✅ Set' : '❌ Not set');
console.log('GMAIL_USER:', process.env.GMAIL_USER ? '✅ Set' : '❌ Not set');
console.log('GMAIL_APP_PASSWORD:', process.env.GMAIL_APP_PASSWORD ? '✅ Set' : '❌ Not set');
console.log('BREVO_SMTP_KEY:', process.env.BREVO_SMTP_KEY ? '✅ Set' : '❌ Not set');
console.log('EMAIL_FROM:', process.env.EMAIL_FROM || '❌ Not set');
console.log('EMAIL_FROM_NAME:', process.env.EMAIL_FROM_NAME || '❌ Not set');
console.log('\n');

// Test email sending
const testEmail = process.env.GMAIL_USER || process.env.EMAIL_FROM || 'test@example.com';

console.log(`Attempting to send test email to: ${testEmail}\n`);

sendPasswordResetEmail(
  testEmail,
  'test-token-123456',
  'Test User'
)
  .then(() => {
    console.log('\n✅ SUCCESS! Email sent successfully!');
    console.log('Check your inbox (and spam folder)');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ FAILED! Email could not be sent');
    console.error('Error:', error.message);
    console.error('\nCommon fixes:');
    console.error('1. For Resend: Use EMAIL_FROM=onboarding@resend.dev');
    console.error('2. For Gmail: Generate App Password at https://myaccount.google.com/apppasswords');
    console.error('3. Verify credentials are correct in .env file');
    console.error('4. Check firewall/antivirus isn\'t blocking SMTP ports');
    process.exit(1);
  });
