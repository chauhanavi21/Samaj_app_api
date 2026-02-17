# User Verification & Admin Approval System

## Overview

This system implements a **member verification and admin approval workflow** for user registration. Users must provide a `memberId` and `phone number` that matches an **authorized members list** (imported from Excel). If the credentials don't match, the signup goes into **pending status** and requires admin approval.

---

## 🎯 Key Features

1. ✅ **Excel Import**: Import authorized members (memberId + phone) from Excel/CSV
2. 🔍 **Automatic Verification**: Auto-approve users with matching credentials
3. ⏳ **Pending Approval**: Users with mismatched/missing credentials go into pending status
4. 👨‍💼 **Admin Dashboard**: Admins can approve/reject pending users
5. 🔔 **Notification Hooks**: Placeholders for future email/SMS notifications (not implemented yet to avoid breaking Android)
6. 🛡️ **Login Protection**: Pending users cannot login until approved

---

## 📊 Workflow Diagram

```
User Signs Up
     ↓
Check memberId & phone in AuthorizedMember collection
     ↓
     ├─ ✅ Match Found → Auto-Approve → User can login
     │
     └─ ❌ No Match / Mismatch
           ↓
        Create user with "pending" status
           ↓
        Show message: "Admin will review in 48 hours"
           ↓
        User tries to login → Blocked with "pending approval" message
           ↓
        Admin reviews in dashboard
           ↓
           ├─ ✅ Approve → User can now login
           └─ ❌ Reject → User cannot login (with rejection reason)
```

---

## 📦 Installation & Setup

### 1. Install Dependencies

```bash
cd backend
npm install
```

This will install the new `xlsx` package for Excel import.

### 2. Import Authorized Members from Excel

**Excel File Format:**
Your Excel file should have these columns (case-insensitive):
- `memberId` (required) - e.g., "M001", "MEM123"
- `phoneNumber` (required) - e.g., "9876543210", "+91-98765-43210"
- `name` (optional) - Member's full name
- `email` (optional) - Member's email
- `notes` (optional) - Any additional notes

**Example Excel:**
```
memberId | phoneNumber   | name          | email
---------|---------------|---------------|------------------
M001     | 9876543210    | John Doe      | john@email.com
M002     | 9988776655    | Jane Smith    | jane@email.com
M003     | 9123456789    | Bob Johnson   | 
```

**Import Command:**
```bash
# From backend directory
node scripts/importAuthorizedMembers.js path/to/your/members.xlsx

# Or use npm script
npm run import-members path/to/your/members.xlsx
```

**Expected Output:**
```
📁 Reading Excel file: members.xlsx
📊 Found 100 rows in Excel file
🔌 Connecting to MongoDB...
✅ Connected to MongoDB
✅ Row 1: Imported member M001
✅ Row 2: Imported member M002
...

=== IMPORT SUMMARY ===
✅ Successfully imported: 95
ℹ️  Skipped (already exists): 3
❌ Errors: 2
📊 Total rows processed: 100
```

### 3. Update Environment Variables (Optional)

No new environment variables are required, but you can add notification settings for future:

```env
# .env file
# Future notification settings (not used yet)
# SMS_SERVICE_KEY=your_twilio_key
# PUSH_NOTIFICATION_KEY=your_fcm_key
```

---

## 🔧 API Endpoints

### For Users

#### 1. Signup (Modified)
```
POST /api/auth/signup
```

**Request:**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "password123",
  "phone": "9876543210",
  "memberId": "M001"
}
```

**Response (Auto-Approved):**
```json
{
  "success": true,
  "token": "jwt_token_here",
  "user": {
    "id": "user_id",
    "name": "John Doe",
    "email": "john@example.com",
    "role": "user",
    "phone": "9876543210",
    "memberId": "M001"
  }
}
```

**Response (Pending Approval):**
```json
{
  "success": true,
  "requiresApproval": true,
  "message": "Your signup request has been received. Our admin team will review your application within 48 hours. You will be notified once approved. Please try signing in again after approval.",
  "user": {
    "id": "user_id",
    "name": "John Doe",
    "email": "john@example.com",
    "memberId": "M001",
    "accountStatus": "pending"
  },
  "notification": {
    "message": "Admin notification will be implemented in production",
    "estimatedReviewTime": "48 hours"
  }
}
```

#### 2. Login (Modified)
```
POST /api/auth/login
```

**Response (Pending User):**
```json
{
  "success": false,
  "accountStatus": "pending",
  "message": "Your account is pending admin approval. You will be notified within 48 hours. Please try signing in again after approval.",
  "requiresApproval": true
}
```

**Response (Rejected User):**
```json
{
  "success": false,
  "accountStatus": "rejected",
  "message": "Your account registration was not approved. Please contact support for more information.",
  "rejectionReason": "Member ID could not be verified"
}
```

---

### For Admins

#### 1. Get Pending Users
```
GET /api/admin/pending-users?page=1&limit=20&search=
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "user_id",
      "name": "John Doe",
      "email": "john@example.com",
      "phone": "9876543210",
      "memberId": "M001",
      "accountStatus": "pending",
      "createdAt": "2026-02-06T10:30:00Z",
      "matchStatus": "phone_mismatch",
      "matchDetails": {
        "authorizedPhone": "9876543211",
        "userPhone": "9876543210",
        "authorizedName": "John Doe"
      }
    }
  ],
  "pagination": {
    "total": 5,
    "page": 1,
    "pages": 1,
    "limit": 20
  }
}
```

**Match Status Values:**
- `exact_match` - Member ID found and phone matches
- `phone_mismatch` - Member ID found but phone doesn't match
- `not_found` - Member ID not in authorized list

#### 2. Get Pending Users Count
```
GET /api/admin/pending-users/count
```

**Response:**
```json
{
  "success": true,
  "count": 5
}
```

#### 3. Approve User
```
POST /api/admin/pending-users/:userId/approve
```

**Response:**
```json
{
  "success": true,
  "message": "User approved successfully",
  "data": {
    "id": "user_id",
    "name": "John Doe",
    "email": "john@example.com",
    "accountStatus": "approved"
  },
  "notification": {
    "placeholder": "User notification will be implemented in production",
    "message": "Email/SMS notification would be sent here"
  }
}
```

#### 4. Reject User
```
POST /api/admin/pending-users/:userId/reject
```

**Request:**
```json
{
  "reason": "Member ID could not be verified with our records"
}
```

**Response:**
```json
{
  "success": true,
  "message": "User rejected successfully",
  "data": {
    "id": "user_id",
    "name": "John Doe",
    "email": "john@example.com",
    "accountStatus": "rejected",
    "rejectionReason": "Member ID could not be verified with our records"
  }
}
```

#### 5. View Authorized Members
```
GET /api/admin/authorized-members?page=1&limit=50&search=&status=all
```

**Status Options:**
- `all` - All members
- `used` - Members who have signed up
- `unused` - Members who haven't signed up yet

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "member_id",
      "memberId": "M001",
      "phoneNumber": "9876543210",
      "name": "John Doe",
      "email": "john@example.com",
      "isUsed": true,
      "usedBy": {
        "name": "John Doe",
        "email": "john@example.com"
      },
      "usedAt": "2026-02-06T10:30:00Z",
      "importedAt": "2026-02-01T09:00:00Z"
    }
  ],
  "pagination": {
    "total": 100,
    "page": 1,
    "pages": 2,
    "limit": 50
  },
  "stats": {
    "total": 100,
    "used": 45,
    "unused": 55
  }
}
```

---

## 🗄️ Database Models

### AuthorizedMember Model
```javascript
{
  memberId: String (required, unique),
  phoneNumber: String (required),
  name: String (optional),
  email: String (optional),
  isUsed: Boolean (default: false),
  usedBy: ObjectId (ref: User),
  usedAt: Date,
  importedAt: Date,
  importedBy: ObjectId (ref: User),
  notes: String
}
```

### User Model (Updated Fields)
```javascript
{
  // ... existing fields ...
  accountStatus: String (enum: ['pending', 'approved', 'rejected'], default: 'approved'),
  verificationStatus: String (enum: ['verified', 'unverified', 'pending_admin'], default: 'verified'),
  requiresAdminApproval: Boolean (default: false),
  reviewedBy: ObjectId (ref: User),
  reviewedAt: Date,
  rejectionReason: String,
  notificationPreferences: {
    email: Boolean (default: true),
    sms: Boolean (default: false)
  }
}
```

---

## 🔔 Notification System (Future Implementation)

The system has **placeholder functions** for notifications in `utils/notificationService.js`:

- `sendApprovalNotification(user)` - Send approval notification
- `sendRejectionNotification(user, reason)` - Send rejection notification
- `sendPendingReviewNotification(user)` - Send pending review notification
- `notifyAdminsNewPendingUser(user, reason)` - Notify admins of new pending user

**To implement notifications later:**
1. Email is handled by Firebase Auth templates (no backend SMTP/Nodemailer)
2. Add SMS service (Twilio, AWS SNS, etc.)
3. Add push notifications (Firebase Cloud Messaging)
4. Uncomment the code in `notificationService.js`
5. Test thoroughly on Android before deploying

---

## 🛡️ Edge Cases Handled

1. ✅ **Duplicate Member IDs**: Prevented during signup
2. ✅ **Case Sensitivity**: Member ID and phone comparisons are case-insensitive
3. ✅ **Phone Formatting**: Handles different phone formats (with/without spaces, dashes, parentheses)
4. ✅ **Partial Matches**: Only exact matches are auto-approved
5. ✅ **Existing Users**: Can't import member ID if already used
6. ✅ **Admin Safety**: Admins are always auto-approved regardless of verification
7. ✅ **Backwards Compatibility**: Existing users without approval fields default to "approved"
8. ✅ **Empty Phone Number**: If user doesn't provide phone, goes to pending
9. ✅ **Excel Errors**: Script handles missing columns, duplicate rows, invalid data
10. ✅ **Race Conditions**: Proper MongoDB unique indexes prevent conflicts

---

## 🧪 Testing

### Test Scenario 1: Auto-Approved User
1. Import Excel with member: `M001`, phone: `9876543210`
2. Sign up with matching credentials
3. ✅ Should auto-approve and return JWT token
4. ✅ Should be able to login immediately

### Test Scenario 2: Pending User (Phone Mismatch)
1. Import Excel with member: `M002`, phone: `9988776655`
2. Sign up with `M002` but different phone: `9988776600`
3. ✅ Should create pending user
4. ✅ Should show "48 hours" message
5. ✅ Login should be blocked with pending message
6. Admin approves
7. ✅ User should now be able to login

### Test Scenario 3: Pending User (Member Not Found)
1. Don't import member `M999`
2. Sign up with `M999`
3. ✅ Should create pending user
4. Admin reviews and sees "not_found" status
5. Admin can approve or reject

### Test Scenario 4: Rejected User
1. Admin rejects pending user
2. ✅ User tries to login → sees rejection message
3. ✅ Cannot login

---

## 🚀 Deployment Checklist

- [ ] Install dependencies: `npm install`
- [ ] Import authorized members Excel file
- [ ] Test signup with matching credentials (should auto-approve)
- [ ] Test signup with non-matching credentials (should go pending)
- [ ] Test login with pending account (should be blocked)
- [ ] Test admin approval flow
- [ ] Test admin rejection flow
- [ ] Verify existing users still work (backwards compatibility)
- [ ] Set up notification system when ready (don't do now)

---

## 📝 Notes

- **Backwards Compatible**: Existing users will have `accountStatus: 'approved'` by default
- **Admin Auto-Approval**: Admins (from `ADMIN_EMAILS` env) bypass verification
- **Notification Safety**: Notification code is placeholders only - won't break Android
- **Excel Re-import**: Can re-run import script - will skip existing members
- **Member ID Format**: Any string format works (M001, MEM-123, etc.)
- **Phone Format**: Script normalizes phone numbers (removes spaces, dashes)

---

## 🆘 Troubleshooting

### Import fails with "Module not found: xlsx"
```bash
cd backend
npm install xlsx
```

### Users still auto-approving when they shouldn't
- Check if their member ID exists in AuthorizedMember collection
- Check if phone numbers match exactly (normalized)
- Check MongoDB indexes: `db.authorizedmembers.getIndexes()`

### Admin can't see pending users
- Verify admin role: Check user document has `role: 'admin'`
- Check authorization middleware: Should have admin token

### Login returns 403 for approved user
- Check user's `accountStatus` - should be 'approved'
- May need to manually update: `db.users.updateMany({}, {$set: {accountStatus: 'approved'}})`

---

## 📞 Support

For questions or issues:
1. Check this documentation first
2. Verify all steps in deployment checklist
3. Check server logs for detailed error messages
4. Test with Postman/Thunder Client before testing on mobile
