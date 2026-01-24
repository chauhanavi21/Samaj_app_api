# Thali Yuva Sangh Backend API

Backend API for authentication and user management using MongoDB and Express.

## Setup Instructions

### 1. Install Dependencies

```bash
cd backend
npm install
```

### 2. MongoDB Atlas Setup

1. Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Create a free account or sign in
3. Create a new cluster (free tier is fine)
4. Go to **Database Access** → Create a database user
   - Username: `your_username`
   - Password: `your_password` (save this!)
   - Database User Privileges: **Read and write to any database**
5. Go to **Network Access** → Add IP Address
   - Click "Add IP Address"
   - Click "Allow Access from Anywhere" (for development) or add your specific IP
6. Go to **Database** → Click "Connect" on your cluster
   - Choose "Connect your application"
   - Copy the connection string
   - It looks like: `mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority`

### 3. Configure Environment Variables

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` and fill in your values:
   ```env
   MONGODB_URI=mongodb+srv://your_username:your_password@cluster0.xxxxx.mongodb.net/thali_yuva_sangh?retryWrites=true&w=majority
   JWT_SECRET=your_super_secret_jwt_key_change_this_in_production
   PORT=3001
   ADMIN_EMAILS=admin1@thaliyuvasangh.org,admin2@thaliyuvasangh.org
   ```

   **Important:**
   - Replace `<username>` and `<password>` in MONGODB_URI with your database user credentials
   - Replace `cluster0.xxxxx` with your actual cluster name
   - Change `JWT_SECRET` to a random secure string
   - Set `ADMIN_EMAILS` to the emails that should have admin access

### 4. Run the Server

**Development mode (with auto-reload):**
```bash
npm run dev
```

**Production mode:**
```bash
npm start
```

The server will run on `http://localhost:3001`

### 5. Create Admin Users

After setting up the database:

1. Sign up the admin users through the app (using the emails in ADMIN_EMAILS)
2. Run the admin creation script:
   ```bash
   node scripts/createAdmins.js
   ```

Or manually update users in MongoDB Atlas to set `role: "admin"`

## API Endpoints

### Authentication

- `POST /api/auth/signup` - Register a new user
  ```json
  {
    "name": "John Doe",
    "email": "john@example.com",
    "password": "password123",
    "phone": "+91 98765 43210"
  }
  ```

- `POST /api/auth/login` - Login user
  ```json
  {
    "email": "john@example.com",
    "password": "password123"
  }
  ```

- `GET /api/auth/me` - Get current user (requires auth token)
  - Header: `Authorization: Bearer <token>`

- `POST /api/auth/logout` - Logout (requires auth token)
  - Header: `Authorization: Bearer <token>`

## User Roles

- **user**: Regular user (default)
- **admin**: Administrator (set via ADMIN_EMAILS in .env or manually)

## Security Notes

- Passwords are hashed using bcrypt
- JWT tokens expire in 30 days
- Always use HTTPS in production
- Never commit `.env` file to git
