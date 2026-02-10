const nodemailer = require('nodemailer');

/**
 * Email Service using Nodemailer
 * 
 * RECOMMENDED EMAIL PROVIDERS (Free Tiers):
 * 
 * 1. RESEND (Best for developers) - https://resend.com
 *    - 100 emails/day free
 *    - No credit card required
 *    - Simple API, great docs
 *    Install: npm install resend
 * 
 * 2. BREVO (formerly Sendinblue) - https://www.brevo.com
 *    - 300 emails/day free forever
 *    - SMTP + API
 *    - No credit card required
 * 
 * 3. MAILGUN - https://www.mailgun.com
 *    - 5,000 emails/month free (first 3 months)
 *    - Then 1,000/month free
 *    - Credit card required after trial
 * 
 * 4. SENDGRID - https://sendgrid.com
 *    - 100 emails/day free forever
 *    - Twilio-owned, very reliable
 * 
 * 5. GMAIL (Easiest to start)
 *    - Use your Gmail account
 *    - 500 emails/day limit
 *    - Requires "App Password" (not your regular password)
 */

// Create transporter based on environment variables
const createTransporter = () => {
  // Check if using Resend
  if (process.env.RESEND_API_KEY) {
    // Note: Resend has its own package, but can also work with SMTP
    return nodemailer.createTransport({
      host: 'smtp.resend.com',
      port: 465,
      secure: true,
      auth: {
        user: 'resend',
        pass: process.env.RESEND_API_KEY,
      },
    });
  }
  
  // Check if using Brevo (Sendinblue)
  if (process.env.BREVO_SMTP_KEY) {
    return nodemailer.createTransport({
      host: 'smtp-relay.brevo.com',
      port: 587,
      secure: false,
      auth: {
        user: process.env.BREVO_SMTP_USER || process.env.EMAIL_FROM,
        pass: process.env.BREVO_SMTP_KEY,
      },
    });
  }
  
  // Check if using SendGrid
  if (process.env.SENDGRID_API_KEY) {
    return nodemailer.createTransport({
      host: 'smtp.sendgrid.net',
      port: 587,
      secure: false,
      auth: {
        user: 'apikey',
        pass: process.env.SENDGRID_API_KEY,
      },
    });
  }
  
  // Check if using Mailgun
  if (process.env.MAILGUN_SMTP_LOGIN) {
    return nodemailer.createTransport({
      host: 'smtp.mailgun.org',
      port: 587,
      secure: false,
      auth: {
        user: process.env.MAILGUN_SMTP_LOGIN,
        pass: process.env.MAILGUN_SMTP_PASSWORD,
      },
    });
  }
  
  // Default to Gmail (for testing)
  if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
    return nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD, // App-specific password, not regular password
      },
    });
  }
  
  // Fallback: generic SMTP
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
};

/**
 * Send account approved email
 */
const sendAccountApprovedEmail = async (email, userName) => {
  try {
    const transporter = createTransporter();
    const mailOptions = {
      from: `"${process.env.EMAIL_FROM_NAME || 'Thali Yuva Sangh'}" <${process.env.EMAIL_FROM || 'noreply@thaliyuvasangh.org'}>`,
      to: email,
      subject: 'Your account has been approved - Thali Yuva Sangh',
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.6;color:#333">
          <h2 style="color:#1A3A69">Account Approved</h2>
          <p>Hello ${userName || ''},</p>
          <p>Your account has been approved by our admin team. You can now sign in to the app.</p>
          <p style="margin-top:24px;font-size:12px;color:#666">Thali Yuva Sangh</p>
        </div>
      `,
      text: `Hello ${userName || ''},\n\nYour account has been approved by our admin team. You can now sign in to the app.\n\nThali Yuva Sangh`,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Account approved email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('❌ Error sending approval email:', error);
    throw error;
  }
};

/**
 * Send account rejected email
 */
const sendAccountRejectedEmail = async (email, userName, reason) => {
  try {
    const transporter = createTransporter();
    const mailOptions = {
      from: `"${process.env.EMAIL_FROM_NAME || 'Thali Yuva Sangh'}" <${process.env.EMAIL_FROM || 'noreply@thaliyuvasangh.org'}>`,
      to: email,
      subject: 'Your account request was not approved - Thali Yuva Sangh',
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.6;color:#333">
          <h2 style="color:#1A3A69">Account Update</h2>
          <p>Hello ${userName || ''},</p>
          <p>Your account request was not approved.</p>
          ${reason ? `<p><strong>Reason:</strong> ${String(reason)}</p>` : ''}
          <p style="margin-top:24px;font-size:12px;color:#666">Thali Yuva Sangh</p>
        </div>
      `,
      text: `Hello ${userName || ''},\n\nYour account request was not approved.${reason ? `\nReason: ${String(reason)}` : ''}\n\nThali Yuva Sangh`,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Account rejected email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('❌ Error sending rejection email:', error);
    throw error;
  }
};

/**
 * Send password reset email
 * @param {string} email - Recipient email
 * @param {string} resetToken - Password reset token
 * @param {string} userName - User's name
 */
const sendPasswordResetEmail = async (email, resetToken, userName) => {
  try {
    const transporter = createTransporter();
    
    // Verify transporter configuration
    try {
      await transporter.verify();
      console.log('✅ Email server is ready to send messages');
    } catch (verifyError) {
      console.error('❌ Email server verification failed:', verifyError.message);
      console.error('Check your email provider credentials in .env file');
      throw verifyError;
    }
    
    // In production, this would be your actual domain
    // For now, you can use ngrok/cloudflare tunnel URL or localhost
    const resetUrl = `${process.env.FRONTEND_URL || 'exp://192.168.1.100:8081'}/--/reset-password?resetToken=${resetToken}`;
    
    const mailOptions = {
      from: `"${process.env.EMAIL_FROM_NAME || 'Thali Yuva Sangh'}" <${process.env.EMAIL_FROM || 'noreply@thaliyuvasangh.org'}>`,
      to: email,
      subject: 'Password Reset Request - Thali Yuva Sangh',
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: #1A3A69; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
              .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 5px 5px; }
              .button { display: inline-block; padding: 12px 30px; background: #FF8C00; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
              .token-box { background: white; padding: 15px; border-left: 4px solid #FF8C00; margin: 20px 0; font-family: monospace; word-break: break-all; }
              .footer { text-align: center; margin-top: 30px; font-size: 12px; color: #666; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>Thali Yuva Sangh</h1>
              </div>
              <div class="content">
                <h2>Password Reset Request</h2>
                <p>Hello ${userName},</p>
                <p>We received a request to reset your password. If you didn't make this request, you can safely ignore this email.</p>
                
                <p>To reset your password, you have two options:</p>
                
                <h3>Option 1: Click the button below</h3>
                <a href="${resetUrl}" class="button">Reset Password</a>
                
                <h3>Option 2: Use this reset token</h3>
                <p>Open the Thali Yuva Sangh app, go to "Forgot Password", and enter this token:</p>
                <div class="token-box">
                  <strong>Reset Token:</strong><br>
                  ${resetToken}
                </div>
                
                <p><strong>⚠️ Security Notice:</strong></p>
                <ul>
                  <li>This token expires in <strong>10 minutes</strong></li>
                  <li>Only use this token if you requested a password reset</li>
                  <li>Never share this token with anyone</li>
                </ul>
                
                <div class="footer">
                  <p>This is an automated email from Thali Yuva Sangh</p>
                  <p>If you have any questions, please contact us at ${process.env.EMAIL_FROM || 'contact@thaliyuvasangh.org'}</p>
                </div>
              </div>
            </div>
          </body>
        </html>
      `,
      text: `
Hello ${userName},

We received a request to reset your password for your Thali Yuva Sangh account.

Reset Token: ${resetToken}

This token expires in 10 minutes.

To reset your password:
1. Open the Thali Yuva Sangh app
2. Go to "Forgot Password"
3. Enter the reset token above

If you didn't request this password reset, you can safely ignore this email.

Security Notice:
- Only use this token if you requested a password reset
- Never share this token with anyone
- The token will expire in 10 minutes

---
Thali Yuva Sangh
${process.env.EMAIL_FROM || 'contact@thaliyuvasangh.org'}
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Password reset email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('❌ Error sending email:', error);
    throw error;
  }
};

/**
 * Send welcome email to new users
 */
const sendWelcomeEmail = async (email, userName, memberId) => {
  try {
    const transporter = createTransporter();
    
    const mailOptions = {
      from: `"${process.env.EMAIL_FROM_NAME || 'Thali Yuva Sangh'}" <${process.env.EMAIL_FROM || 'noreply@thaliyuvasangh.org'}>`,
      to: email,
      subject: 'Welcome to Thali Yuva Sangh! 🎉',
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: #1A3A69; color: white; padding: 30px; text-align: center; }
              .content { background: #f9f9f9; padding: 30px; }
              .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>Welcome to Thali Yuva Sangh!</h1>
              </div>
              <div class="content">
                <p>Hello ${userName},</p>
                <p>Thank you for joining Thali Yuva Sangh! We're excited to have you as part of our community.</p>
                <p><strong>Your Member ID:</strong> ${memberId}</p>
                <p>You can now:</p>
                <ul>
                  <li>View and manage your family tree</li>
                  <li>Stay updated with community events</li>
                  <li>Connect with other members</li>
                  <li>Access exclusive member benefits</li>
                </ul>
                <p>If you have any questions, feel free to reach out to us.</p>
                <div class="footer">
                  <p>Thali Yuva Sangh - Building Stronger Communities</p>
                </div>
              </div>
            </div>
          </body>
        </html>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Welcome email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('❌ Error sending welcome email:', error);
    // Don't throw error for welcome email - it's not critical
    return { success: false, error: error.message };
  }
};

module.exports = {
  sendPasswordResetEmail,
  sendWelcomeEmail,
  sendAccountApprovedEmail,
  sendAccountRejectedEmail,
};
