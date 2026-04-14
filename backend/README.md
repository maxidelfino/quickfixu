# QuickFixU Backend API

Backend REST API for QuickFixU - A marketplace platform connecting clients with service professionals (electricians, plumbers, gas technicians) in Argentina.

## 🏗️ Tech Stack

- **Runtime:** Node.js 18+ with TypeScript
- **Framework:** Express.js
- **Database:** PostgreSQL 15+ with PostGIS extension
- **ORM:** Prisma 5
- **Authentication:** JWT (RS256 asymmetric encryption) + Refresh Token Rotation
- **Caching:** Redis
- **File Storage:** Cloudinary
- **Validation:** Zod
- **Testing:** Jest + Supertest

## 📁 Project Structure

```
backend/
├── src/
│   ├── config/           # Database, JWT, Redis, Cloudinary configs
│   ├── middleware/       # Auth, validation, error handling, rate limiting
│   ├── services/         # Business logic layer
│   ├── controllers/      # HTTP request handlers
│   ├── routes/           # Express route definitions
│   ├── types/            # TypeScript type definitions
│   ├── utils/            # Utility functions
│   ├── app.ts            # Express app setup
│   └── server.ts         # HTTP server entry point
├── prisma/
│   ├── schema.prisma     # Database schema
│   ├── migrations/       # Database migrations
│   └── seed.ts           # Seed data (3 categories)
├── tests/                # Unit and integration tests
├── keys/                 # JWT RSA keys (gitignored)
└── scripts/              # Utility scripts (key generation)
```

## 🚀 Getting Started

### Prerequisites

- **Node.js 18+** and **npm 9+**
- **PostgreSQL 15+** with **PostGIS extension**
- **Redis** (local or cloud instance)
- **Cloudinary account** (for image storage)
- **Google OAuth credentials** (optional, for Google sign-in)
- **Facebook OAuth credentials** (optional, for Facebook sign-in)
- **OpenSSL** (for generating JWT keys)

### 1. Install Dependencies

```bash
cd backend
npm install
```

### 2. Generate JWT Keys

Generate RSA 2048-bit key pair for JWT signing:

```bash
npm run generate-keys
```

This creates:
- `keys/private.pem` (never commit!)
- `keys/public.pem` (safe to share)

### 3. Configure Environment Variables

Copy `.env.example` to `.env` and fill in your credentials:

```bash
cp .env.example .env
```

**Required variables:**
- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_URL` - Redis connection string
- `CLOUDINARY_*` - Cloudinary credentials
- `ALLOW_MOCK_CLOUDINARY=true` - Optional explicit fallback for `development`/`test` only when Cloudinary is unavailable
- `GOOGLE_CLIENT_IDS` - Comma-separated Google OAuth audience allowlist (web/android/ios)
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` - Optional legacy single Google client ID and Google OAuth secret
- `FACEBOOK_APP_ID` / `FACEBOOK_APP_SECRET` - Facebook OAuth
- `NOMINATIM_USER_AGENT` - User agent for Nominatim geocoding

### 4. Setup Database

Run Prisma migrations to create tables:

```bash
npm run migrate
```

This will:
1. Create all tables from `schema.prisma`
2. Prompt you to run the manual PostGIS migration (see below)

#### Manual PostGIS Migration

After running `npm run migrate`, execute this SQL manually in your PostgreSQL database:

```sql
-- Add PostGIS geography column (not supported by Prisma schema directly)
ALTER TABLE users ADD COLUMN location GEOGRAPHY(POINT, 4326);

-- Populate location from lat/lng
UPDATE users SET location = ST_SetSRID(ST_MakePoint(longitude::float, latitude::float), 4326)::geography;

-- Create spatial index (GIST for geography type)
CREATE INDEX idx_users_location ON users USING GIST(location);
```

### 5. Seed Database

Populate the database with 3 initial categories:

```bash
npm run seed
```

This creates:
- ⚡ Electricista
- 🔧 Plomero
- 🔥 Gasista

Demo users with known credentials are NOT created by default. To generate them only in local `development` or `test`, run the seed with `SEED_DEMO_USERS=true`.

### OAuth Notes

- Backend Google token verification accepts only audiences listed in `GOOGLE_CLIENT_IDS` (and `GOOGLE_CLIENT_ID` if you still use it).
- Mobile native builds must use matching platform IDs in `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID` and `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`.
- If OAuth env vars are missing on mobile, the OAuth CTA buttons stay hidden instead of looking usable.

### 6. Start Development Server

```bash
npm run dev
```

Server starts on `http://localhost:3000`

Health check: `GET http://localhost:3000/api/health`

## 📋 Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server with hot reload |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run production build from `dist/` |
| `npm run migrate` | Run Prisma migrations |
| `npm run migrate:deploy` | Deploy migrations (production) |
| `npm run seed` | Seed database with initial data |
| `npm run generate-keys` | Generate JWT RSA key pair |
| `npm run prisma:generate` | Generate Prisma Client |
| `npm run prisma:studio` | Open Prisma Studio (GUI for DB) |
| `npm test` | Run tests with Jest |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:coverage` | Run tests with coverage report |

## 🔐 Authentication Flow

QuickFixU uses **RS256 JWT** (asymmetric encryption) with **refresh token rotation**:

1. **Access Token** (JWT, 15min expiry)
   - Signed with RSA private key
   - Verified with RSA public key
   - Contains: `{ userId: number }`
   - Sent in `Authorization: Bearer <token>` header

2. **Refresh Token** (UUID, 7-day expiry)
   - Stored as SHA-256 hash in database
   - One-time use (rotated on every refresh)
   - Token reuse detection → revoke all user sessions

## 📌 Current Backend Status

The backend is beyond the initial foundation stage. This repository already includes:

- Email/password authentication with JWT access tokens and refresh token rotation
- Google and Facebook OAuth endpoints
- User profile read/update flows
- Professional profile, category, certification, and search endpoints
- Jest and Supertest coverage for core API flows

## 🧪 Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Generate coverage report
npm run test:coverage
```

## 📡 API Endpoints

### Health Check
- `GET /api/health` - Server health status

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login with email/password
- `POST /api/auth/google` - OAuth Google sign-in
- `POST /api/auth/facebook` - OAuth Facebook sign-in
- `POST /api/auth/refresh` - Refresh access token
- `POST /api/auth/logout` - Revoke refresh token

### User Profiles
- `GET /api/users/me` - Get authenticated user profile
- `PATCH /api/users/me` - Update profile
- `POST /api/users/me/photo` - Upload profile photo
- `DELETE /api/users/me` - Delete account

### Professionals
- `GET /api/professionals/search` - Search by location
- `GET /api/professionals/:id` - Get professional profile
- `PATCH /api/professionals/me` - Update professional details
- `POST /api/professionals/me/certifications` - Upload certification

### Categories
- `GET /api/categories` - Get all categories
- `GET /api/categories/:slug` - Get category by slug
- `GET /api/categories/:slug/professionals` - Get professionals in category

## ⚠️ Important Notes

### Security
- **NEVER commit `keys/` directory** (already in .gitignore)
- **NEVER commit `.env` file** (contains sensitive credentials)
- Store JWT private key securely in production (env vars or secrets manager)
- Rotate JWT keys if compromised (invalidates all existing tokens)
- Cloudinary uploads fail closed unless `ALLOW_MOCK_CLOUDINARY=true` is explicitly enabled in `development` or `test`

### PostGIS
- The `users.location` column is created manually (not in Prisma schema)
- Spatial queries use `ST_DWithin` for radius searches
- Indexes: GIST index on `users.location` for fast geospatial queries

### Database
- Cascading deletes: Deleting a user deletes professional + certifications + refresh tokens
- Soft delete: Set `isActive = false` to preserve data
- Hard delete: Use Prisma's `delete()` method

### Geocoding
- Primary: Nominatim (OpenStreetMap) - free, rate-limited
- Fallback: Google Geocoding API - paid, reliable
- Cache: 90-day TTL in Redis

## 🛠️ Troubleshooting

### JWT Key Generation Fails
- **Windows:** Install OpenSSL from https://slproweb.com/products/Win32OpenSSL.html
- **macOS:** OpenSSL is pre-installed
- **Linux:** `sudo apt install openssl`

### Prisma Migration Fails
- Ensure PostgreSQL is running
- Check `DATABASE_URL` in `.env`
- Ensure PostGIS extension is installed: `CREATE EXTENSION postgis;`

### Redis Connection Error
- Ensure Redis is running: `redis-cli ping` → `PONG`
- Check `REDIS_URL` in `.env`

### Port Already in Use
- Change `PORT` in `.env`
- Or kill existing process: `lsof -ti:3000 | xargs kill` (macOS/Linux)

## 📞 Support

For issues or questions, contact the development team or create an issue in the project repository.

---

**QuickFixU** - Connecting clients with trusted professionals in Argentina 🇦🇷
