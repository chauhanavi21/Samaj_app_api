# Admin Side Documentation

## Overview

Complete admin panel for the Samaj App with content management, user management, analytics, and secure file uploads.

## Features

### 1. Dashboard & Analytics
- Real-time statistics (total users, admins, family tree entries)
- Recent signups tracking
- User signup trends (6-month chart data)
- Most active users by family tree entries
- Comprehensive overview statistics

### 2. Content Management System (CMS)
- Manage all app pages (except Family Tree which is user-only)
- Create, read, update, and delete page content
- Multi-section support per page (title, text, images)
- Publish/unpublish pages
- Track last modified by and timestamps

### 3. User Management
- List all users with pagination and search
- Advanced search by name, email, memberId, or phone
- Filter users by role (admin/user)
- View detailed user profiles with family tree entries (read-only)
- Update user details (name, email, phone, memberId)
- Promote/demote user roles
- Delete users with optional family tree cleanup
- Prevent self-deletion and self-demotion

### 4. Image Upload
- Secure image upload with validation
- MIME type checking (JPEG, PNG, GIF, WebP only)
- File size limits (5MB default, configurable)
- Unique filename generation
- Static file serving

### 5. Security Features
- Protected routes with JWT authentication
- Admin-only authorization middleware
- Input validation and sanitization
- Prevent admin self-deletion
- Member ID uniqueness validation
- Email uniqueness validation
- Safe admin bootstrap process

## API Endpoints

### Dashboard & Analytics

#### GET /api/admin/dashboard
Get comprehensive dashboard statistics.

**Response:**
```json
{
  "success": true,
  "data": {
    "totals": {
      "users": 150,
      "admins": 3,
      "regularUsers": 147,
      "familyTreeEntries": 450
    },
    "recentSignups": [...],
    "signupTrend": [...],
    "activeUsers": [...]
  }
}
```

#### GET /api/admin/stats/overview
Get quick statistics overview.

**Response:**
```json
{
  "success": true,
  "data": {
    "users": {
      "total": 150,
      "today": 5,
      "thisWeek": 23,
      "thisMonth": 67
    },
    "pages": {
      "total": 12,
      "published": 10,
      "draft": 2
    }
  }
}
```

### Content Management

#### GET /api/admin/pages
Get all pages.

**Response:**
```json
{
  "success": true,
  "count": 12,
  "data": [...]
}
```

#### GET /api/admin/pages/:pageName
Get a specific page.

**Example:** `/api/admin/pages/about-us`

#### POST /api/admin/pages
Create a new page.

**Request Body:**
```json
{
  "pageName": "about-us",
  "displayName": "About Us",
  "sections": [
    {
      "title": "Our Story",
      "text": "We are...",
      "imageUrl": "/uploads/story-123.jpg",
      "order": 0
    }
  ],
  "isPublished": true
}
```

#### PUT /api/admin/pages/:pageName
Update a page.

**Request Body:**
```json
{
  "displayName": "About Us - Updated",
  "sections": [...],
  "isPublished": true
}
```

#### DELETE /api/admin/pages/:pageName
Delete a page.

### User Management

#### GET /api/admin/users
List users with pagination and search.

**Query Parameters:**
- `page` (default: 1)
- `limit` (default: 10)
- `search` (search in name, email, memberId, phone)
- `role` (filter: 'user' or 'admin')

**Example:** `/api/admin/users?page=1&limit=20&search=john&role=user`

**Response:**
```json
{
  "success": true,
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "pages": 3
  }
}
```

#### GET /api/admin/users/:id
Get user details with family tree entries (read-only).

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {...},
    "familyTreeEntries": [...],
    "familyTreeCount": 5
  }
}
```

#### GET /api/admin/users/:id/family-tree
Get user's family tree entries (admin read-only view).

#### PUT /api/admin/users/:id
Update user details.

**Request Body:**
```json
{
  "name": "Updated Name",
  "email": "newemail@example.com",
  "phone": "1234567890",
  "memberId": "MEMBER-123",
  "role": "admin"
}
```

**Validations:**
- Email uniqueness check
- MemberId uniqueness check
- Role validation

#### PUT /api/admin/users/:id/role
Update user role (promote/demote).

**Request Body:**
```json
{
  "role": "admin"
}
```

**Prevents:**
- Self-demotion by admin

#### DELETE /api/admin/users/:id
Delete a user.

**Query Parameters:**
- `deleteFamilyTree=true` (optional: also delete user's family tree entries)

**Example:** `/api/admin/users/123?deleteFamilyTree=true`

**Prevents:**
- Self-deletion by admin

### Image Upload

#### POST /api/admin/upload-image
Upload an image.

**Request:** `multipart/form-data` with field name `image`

**Validations:**
- MIME types: image/jpeg, image/jpg, image/png, image/gif, image/webp
- Max size: 5MB (configurable)

**Response:**
```json
{
  "success": true,
  "message": "Image uploaded successfully",
  "data": {
    "filename": "photo-1643723456789-123456789.jpg",
    "url": "/uploads/photo-1643723456789-123456789.jpg",
    "size": 1234567,
    "mimetype": "image/jpeg"
  }
}
```

## Admin Bootstrap

### Automatic Setup (Recommended)

Set environment variables in `.env`:

```env
ENABLE_ADMIN_BOOTSTRAP=true
ADMIN_BOOTSTRAP_EMAIL=chauhanavi843@gmail.com
ADMIN_BOOTSTRAP_PASSWORD=SecurePassword123!
ADMIN_BOOTSTRAP_NAME=Administrator
ADMIN_BOOTSTRAP_MEMBER_ID=ADMIN-001
```

The admin account will be automatically created/updated when the server starts.

### Manual Setup

Run the bootstrap script:

```bash
cd backend
node scripts/bootstrapAdmin.js
```

### Security Best Practices

1. **After First Login:**
   - Change the admin password immediately
   - Update or remove `ADMIN_BOOTSTRAP_PASSWORD` from `.env`
   - Consider setting `ENABLE_ADMIN_BOOTSTRAP=false`

2. **Production:**
   - Use strong, unique passwords (minimum 12 characters)
   - Store credentials in secure environment variables
   - Never commit `.env` files to version control
   - Rotate passwords regularly

3. **Access Control:**
   - Add trusted email addresses to `ADMIN_EMAILS`
   - Users with these emails get admin role on signup
   - Existing users can be promoted via API

## Authentication

All admin endpoints require:

1. **JWT Token** in Authorization header:
   ```
   Authorization: Bearer <your_jwt_token>
   ```

2. **Admin Role** - User must have `role: 'admin'`

## Error Handling

All endpoints return consistent error responses:

```json
{
  "success": false,
  "message": "Error description",
  "error": "Detailed error (dev mode only)"
}
```

Common status codes:
- `200` - Success
- `201` - Created
- `400` - Bad Request (validation errors)
- `401` - Unauthorized (invalid/missing token)
- `403` - Forbidden (not admin)
- `404` - Not Found
- `500` - Server Error

## Installation

1. **Install Dependencies:**
   ```bash
   cd backend
   npm install
   ```

2. **Configure Environment:**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Create Admin Account:**
   - Set `ENABLE_ADMIN_BOOTSTRAP=true` in `.env`
   - Configure `ADMIN_BOOTSTRAP_EMAIL` and `ADMIN_BOOTSTRAP_PASSWORD`
   - Start the server (admin created automatically)

   OR

   ```bash
   node scripts/bootstrapAdmin.js
   ```

4. **Start Server:**
   ```bash
   npm run dev
   ```

## Testing Admin Endpoints

### Using cURL

```bash
# Get JWT token first
TOKEN=$(curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"chauhanavi843@gmail.com","password":"YourPassword"}' \
  | jq -r '.token')

# Get dashboard stats
curl http://localhost:3001/api/admin/dashboard \
  -H "Authorization: Bearer $TOKEN"

# List users
curl http://localhost:3001/api/admin/users?page=1&limit=10 \
  -H "Authorization: Bearer $TOKEN"

# Upload image
curl -X POST http://localhost:3001/api/admin/upload-image \
  -H "Authorization: Bearer $TOKEN" \
  -F "image=@/path/to/image.jpg"

# Create page
curl -X POST http://localhost:3001/api/admin/pages \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "pageName": "events",
    "displayName": "Events",
    "sections": [
      {
        "title": "Upcoming Events",
        "text": "Join us for...",
        "order": 0
      }
    ],
    "isPublished": true
  }'
```

### Using Postman

1. **Login** to get token:
   - POST `http://localhost:3001/api/auth/login`
   - Body: `{"email":"chauhanavi843@gmail.com","password":"YourPassword"}`
   - Save the token from response

2. **Set Authorization:**
   - Type: Bearer Token
   - Token: (paste your JWT token)

3. **Test Endpoints:**
   - Dashboard: GET `/api/admin/dashboard`
   - Users: GET `/api/admin/users`
   - Upload: POST `/api/admin/upload-image` (form-data, field: image)

## Database Models

### PageContent Model

```javascript
{
  pageName: String,        // Unique, lowercase (e.g., "about-us")
  displayName: String,     // Display name (e.g., "About Us")
  sections: [{
    title: String,
    text: String,
    imageUrl: String,
    order: Number          // For ordering sections
  }],
  isPublished: Boolean,
  lastModifiedBy: ObjectId,  // Reference to User
  createdAt: Date,
  updatedAt: Date
}
```

### Existing Models (Unchanged)

**User Model:**
```javascript
{
  name: String,
  email: String,
  password: String,
  role: String,            // 'user' or 'admin'
  phone: String,
  memberId: String,        // Unique
  createdAt: Date,
  updatedAt: Date
}
```

**FamilyTree Model:**
```javascript
{
  createdBy: ObjectId,     // Reference to User
  personName: String,
  personPhone: String,
  // ... other fields
  createdAt: Date,
  updatedAt: Date
}
```

## Backward Compatibility

All existing functionality is preserved:

✅ User authentication and signup
✅ Family tree creation and management (user-only)
✅ Email notifications
✅ Existing API endpoints
✅ Database models

## Important Notes

1. **Family Tree Protection:**
   - Admin can VIEW user family trees
   - Admin CANNOT edit family tree entries
   - Only users can manage their own family trees
   - Deleting a user can optionally delete their family trees

2. **Role Management:**
   - Emails in `ADMIN_EMAILS` get admin role on signup
   - Existing users can be promoted/demoted via API
   - Admins cannot demote or delete themselves

3. **File Uploads:**
   - Images stored in `backend/uploads/`
   - Served via `/uploads/` route
   - Validate MIME types and sizes
   - Consider using cloud storage (S3, Cloudinary) for production

4. **Production Considerations:**
   - Enable HTTPS
   - Set strong JWT_SECRET
   - Configure proper CORS origins
   - Use environment-specific configurations
   - Set up database backups
   - Monitor file upload storage
   - Implement rate limiting
   - Add logging and monitoring

## Future Enhancements (Optional)

- [ ] Bulk user operations
- [ ] Export data to CSV/Excel
- [ ] Email notifications to users
- [ ] Activity logs and audit trail
- [ ] Advanced analytics and reporting
- [ ] Cloud storage integration (AWS S3, Cloudinary)
- [ ] Image optimization and thumbnails
- [ ] Two-factor authentication for admins
- [ ] Role-based permissions (super-admin, moderator, etc.)
- [ ] Content versioning and rollback
- [ ] Scheduled content publishing
- [ ] Multi-language support

## Support

For issues or questions:
1. Check server logs for detailed error messages
2. Verify environment variables are set correctly
3. Ensure database connection is working
4. Test with provided cURL examples
5. Review API documentation above

## License

This admin module is part of the Samaj App project.
