# Admin Quick Start Guide

## 🚀 Quick Setup (5 minutes)

### 1. Install Dependencies
```bash
cd backend
npm install
```

### 2. Admin Account is Ready!
Your `.env` file is already configured with:
- Email: `chauhanavi843@gmail.com`
- Password: `Admin@123!ChangeMe` (⚠️ CHANGE THIS AFTER FIRST LOGIN!)

### 3. Start the Server
```bash
npm run dev
```

The admin account will be automatically created on server start.

### 4. Login & Get Token

**Request:**
```bash
POST http://localhost:3001/api/auth/login
Content-Type: application/json

{
  "email": "chauhanavi843@gmail.com",
  "password": "Admin@123!ChangeMe"
}
```

**Response:**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "...",
    "name": "Administrator",
    "email": "chauhanavi843@gmail.com",
    "role": "admin",
    "memberId": "ADMIN-001"
  }
}
```

### 5. Test Admin Access

Use the token from step 4 in the Authorization header:

```bash
GET http://localhost:3001/api/admin/dashboard
Authorization: Bearer YOUR_TOKEN_HERE
```

## 📋 Available Admin Endpoints

### Dashboard & Stats
- `GET /api/admin/dashboard` - Full dashboard with stats and trends
- `GET /api/admin/stats/overview` - Quick stats overview

### User Management
- `GET /api/admin/users` - List all users (with pagination & search)
- `GET /api/admin/users/:id` - Get user details with family tree
- `PUT /api/admin/users/:id` - Update user details
- `PUT /api/admin/users/:id/role` - Change user role
- `DELETE /api/admin/users/:id` - Delete user

### Page Content Management (CMS)
- `GET /api/admin/pages` - List all pages
- `GET /api/admin/pages/:pageName` - Get specific page
- `POST /api/admin/pages` - Create new page
- `PUT /api/admin/pages/:pageName` - Update page
- `DELETE /api/admin/pages/:pageName` - Delete page

### Image Upload
- `POST /api/admin/upload-image` - Upload image (multipart/form-data)

## 🧪 Test Your Setup

Run the automated test suite:

```bash
npm run test-admin
```

Or manually:

```bash
node scripts/testAdminAPI.js
```

## 🔒 Security Checklist

✅ **Before Going to Production:**

1. **Change the Admin Password**
   - Login to the app
   - Change password immediately
   - Update or remove `ADMIN_BOOTSTRAP_PASSWORD` from `.env`

2. **Update Environment Variables**
   ```bash
   # Generate a strong JWT secret
   JWT_SECRET=use_a_long_random_secure_string_here
   
   # Disable auto-bootstrap after initial setup
   ENABLE_ADMIN_BOOTSTRAP=false
   ```

3. **Secure Your Database**
   - Use strong MongoDB credentials
   - Enable network access restrictions
   - Enable authentication

4. **Configure CORS**
   ```javascript
   // In production, restrict CORS to your frontend domain
   CORS_ORIGIN=https://your-frontend-domain.com
   ```

## 📖 Example Requests

### 1. Get Dashboard Stats

```bash
curl http://localhost:3001/api/admin/dashboard \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 2. Search Users

```bash
curl "http://localhost:3001/api/admin/users?search=john&page=1&limit=10" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 3. Create a Page

```bash
curl -X POST http://localhost:3001/api/admin/pages \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "pageName": "about-us",
    "displayName": "About Us",
    "sections": [
      {
        "title": "Our Mission",
        "text": "We are dedicated to...",
        "order": 0
      }
    ],
    "isPublished": true
  }'
```

### 4. Upload an Image

```bash
curl -X POST http://localhost:3001/api/admin/upload-image \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "image=@/path/to/image.jpg"
```

### 5. Update User Role

```bash
curl -X PUT http://localhost:3001/api/admin/users/USER_ID/role \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"role": "admin"}'
```

## 🛠️ Troubleshooting

### Admin Account Not Created

**Check logs:** Look for "Admin account created successfully" or error messages.

**Manual creation:**
```bash
npm run bootstrap-admin
```

### "Not authorized" Error

**Solution:** Make sure:
1. You're logged in with an admin account
2. Token is included in Authorization header: `Bearer YOUR_TOKEN`
3. Token hasn't expired (30-day expiry)

### "Role 'user' is not authorized"

**Solution:** Promote user to admin:
```bash
# Login as existing admin, then:
PUT /api/admin/users/:id/role
{
  "role": "admin"
}
```

### Upload Fails

**Check:**
1. File is an image (JPEG, PNG, GIF, WebP)
2. File size is under 5MB
3. `uploads/` directory exists and is writable

## 📚 Full Documentation

See [ADMIN_DOCUMENTATION.md](./ADMIN_DOCUMENTATION.md) for:
- Detailed API reference
- All endpoints with examples
- Security best practices
- Database models
- Advanced features

## 🆘 Need Help?

1. Check server logs for errors
2. Run validation: `node scripts/validateAdminSetup.js`
3. Run tests: `node scripts/testAdminAPI.js`
4. Review [ADMIN_DOCUMENTATION.md](./ADMIN_DOCUMENTATION.md)

## 📝 Quick Commands Cheat Sheet

```bash
# Install dependencies
npm install

# Start server (auto-creates admin)
npm run dev

# Create admin manually
npm run bootstrap-admin

# Validate setup
node scripts/validateAdminSetup.js

# Test API
node scripts/testAdminAPI.js
```

---

**Default Admin Credentials:**
- Email: `chauhanavi843@gmail.com`
- Password: `Admin@123!ChangeMe`

⚠️ **IMPORTANT:** Change the password after first login!
