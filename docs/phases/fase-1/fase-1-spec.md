# Specification: Fase 1 - Core Authentication & Profiles

## 1. Introduction

This specification defines the functional and non-functional requirements for **Fase 1: Core Authentication & Profiles** of QuickFixU. It is derived from the approved proposal (topic: `sdd/fase-1-auth-profiles/proposal`) and serves as the binding contract between backend and frontend teams.

**Change name:** `fase-1-auth-profiles`  
**Persistence mode:** Engram  
**Base proposal:** 12 features across 5 sprints (6 weeks)

**Features in scope:**
1. User Registration (Client)
2. User Registration (Professional)
3. Login Email/Password
4. OAuth Google Sign-In
5. OAuth Facebook Sign-In
6. Refresh Token Rotation
7. Logout
8. Get User Profile
9. Update User Profile
10. Upload Profile Photo
11. Professional Categories Selection
12. Upload Certification Documents

---

## 2. Functional Requirements

### FR-001: User Registration (Client)

**Description:**  
A client user MUST be able to create an account using email, password, full name, phone number, DNI, and address. The system MUST geocode the address to latitude/longitude coordinates and store them in PostGIS format.

**Requirements:**
- System MUST validate email format per RFC 5322
- System MUST hash password with bcrypt cost 12
- System MUST validate DNI format (7-8 digits, Argentina)
- System MUST validate phone format (+54 9 11 XXXX-XXXX or +54 9 XXX XXX-XXXX)
- System MUST geocode address using Nominatim API (primary) or Google Geocoding API (fallback)
- System MUST prevent duplicate email registration
- System MUST return JWT access token (exp 15min) + refresh token (exp 7 days) on success
- System MUST derive `role = 'client'` automatically

**Scenarios:**

```gherkin
Scenario: Successful client registration
  Given the email "juan@example.com" does NOT exist in database
  And the password is "SecurePass123!" (meets policy: min 8 chars, 1 uppercase, 1 number, 1 special)
  And the phone is "+54 9 11 5555-1234"
  And the DNI is "12345678"
  And the address is "Av. Corrientes 1234, CABA"
  When the client sends POST /api/auth/register with valid data
  Then the system creates a new user record in `users` table
  And geocodes address to lat/lng using Nominatim (with 90-day cache)
  And stores location as PostGIS GEOGRAPHY(Point, 4326)
  And returns 201 Created with:
    - user object (id, full_name, email, phone, dni, address, latitude, longitude, created_at)
    - tokens object (access_token, refresh_token)
  And access_token is signed JWT with exp=15min, payload={userId, role: 'client'}
  And refresh_token is UUID stored hashed in `refresh_tokens` table with exp=7 days

Scenario: Duplicate email registration
  Given the email "juan@example.com" ALREADY exists in database
  When the client sends POST /api/auth/register with that email
  Then the system returns 409 Conflict
  And the response body contains:
    { "error": "Email already registered" }

Scenario: Invalid password registration
  Given the password is "123" (fails policy: too short, no uppercase, no special char)
  When the client sends POST /api/auth/register
  Then the system returns 400 Bad Request
  And the response body contains:
    {
      "error": "Validation failed",
      "details": [
        { "field": "password", "message": "Password must be at least 8 characters" },
        { "field": "password", "message": "Password must contain at least 1 uppercase letter" },
        { "field": "password", "message": "Password must contain at least 1 special character" }
      ]
    }

Scenario: Geocoding failure fallback
  Given Nominatim API is down (returns 503)
  And Google Geocoding API is available
  When the client sends POST /api/auth/register with address "Av. Libertador 1000, CABA"
  Then the system attempts Nominatim first (fails)
  And falls back to Google Geocoding API (succeeds)
  And stores geocoded location in `users.location`
  And returns 201 Created

Scenario: Both geocoding services fail
  Given Nominatim API is down
  And Google Geocoding API is down
  When the client sends POST /api/auth/register
  Then the system returns 503 Service Unavailable
  And the response body contains:
    { "error": "Geocoding service temporarily unavailable. Please try again later." }
```

---

### FR-002: User Registration (Professional)

**Description:**  
A professional user MUST be able to create an account with additional fields: years of experience, description, and selected categories. The system MUST create a linked `professionals` record after creating the base `users` record.

**Requirements:**
- System MUST inherit all validations from FR-001 (client registration)
- System MUST derive `role = 'professional'` from presence of `categories` array in request
- System MUST validate `years_experience` is integer ≥ 0
- System MUST validate `description` is 10-500 characters
- System MUST validate `categories` array contains 1-3 valid category IDs
- System MUST create record in `professionals` table linked to `users.id`
- System MUST create entries in `professional_categories` join table
- System MUST set initial `rating = 0` and `rating_count = 0`

**Scenarios:**

```gherkin
Scenario: Successful professional registration
  Given the email "carlos@example.com" does NOT exist
  And the request includes:
    - categories: [1, 3] (Electricista, Gasista)
    - years_experience: 5
    - description: "Electricista matriculado con 5 años experiencia en CABA"
  When the professional sends POST /api/auth/register with valid data
  Then the system creates:
    - 1 record in `users` table with role='professional'
    - 1 record in `professionals` table with user_id=<new_user_id>
    - 2 records in `professional_categories` (links to categories 1 and 3)
  And returns 201 Created with user + professional data + tokens

Scenario: Professional with invalid category count
  Given the categories array is empty []
  When the professional sends POST /api/auth/register
  Then the system returns 400 Bad Request
  And the response body contains:
    { "field": "categories", "message": "Must select 1-3 categories" }

Scenario: Professional with non-existent category
  Given the categories array is [999] (category 999 does NOT exist)
  When the professional sends POST /api/auth/register
  Then the system returns 400 Bad Request
  And the response body contains:
    { "field": "categories", "message": "Invalid category ID: 999" }

Scenario: Professional with description too short
  Given the description is "Plomero" (7 chars, below 10 minimum)
  When the professional sends POST /api/auth/register
  Then the system returns 400 Bad Request
  And the response body contains:
    { "field": "description", "message": "Description must be 10-500 characters" }
```

---

### FR-003: Login Email/Password

**Description:**  
Any registered user (client or professional) MUST be able to authenticate using email and password. The system MUST return JWT access token and refresh token on successful authentication.

**Requirements:**
- System MUST validate email exists in database
- System MUST compare password using bcrypt.compare (timing-safe)
- System MUST NOT reveal whether email exists (timing attack protection)
- System MUST generate new refresh token on each login (invalidate previous)
- System MUST return identical error messages for invalid email and invalid password
- System MUST implement rate limiting: max 5 failed attempts per IP per 15 minutes
- System MUST log failed login attempts for security auditing

**Scenarios:**

```gherkin
Scenario: Successful login
  Given the user "juan@example.com" exists with hashed password matching "SecurePass123!"
  When the user sends POST /api/auth/login with:
    { "email": "juan@example.com", "password": "SecurePass123!" }
  Then the system verifies password with bcrypt.compare (succeeds)
  And generates new JWT access token (exp 15min, payload: {userId, role})
  And generates new refresh token (UUID, exp 7 days)
  And invalidates any existing refresh tokens for this user
  And stores new refresh token hashed in `refresh_tokens` table
  And returns 200 OK with:
    {
      "user": { id, full_name, email, role, ... },
      "tokens": { access_token, refresh_token }
    }

Scenario: Invalid email login
  Given the email "noexiste@example.com" does NOT exist in database
  When the user sends POST /api/auth/login with that email
  Then the system waits 200ms (simulate bcrypt timing)
  And returns 401 Unauthorized with:
    { "error": "Invalid credentials" }

Scenario: Invalid password login
  Given the user "juan@example.com" exists
  And the password "WrongPass" does NOT match stored hash
  When the user sends POST /api/auth/login with wrong password
  Then the system returns 401 Unauthorized with:
    { "error": "Invalid credentials" }

Scenario: Rate limit exceeded
  Given the IP "192.168.1.100" has made 5 failed login attempts in last 10 minutes
  When the same IP sends POST /api/auth/login (6th attempt)
  Then the system returns 429 Too Many Requests
  And the response contains Retry-After header: 900 (seconds)
  And the response body contains:
    { "error": "Too many login attempts. Try again in 15 minutes." }
```

---

### FR-004: OAuth Google Sign-In

**Description:**  
Users MUST be able to authenticate using Google OAuth 2.0 via native mobile SDKs. The system MUST validate the Google ID token, create user if new, and return JWT tokens.

**Requirements:**
- System MUST use `@react-native-google-signin/google-signin` SDK (NO WebView)
- System MUST validate Google ID token signature using Google public keys
- System MUST verify token audience matches app client ID
- System MUST extract email, name, profile photo from token claims
- System MUST create new user if email does NOT exist (auto-registration)
- System MUST reject if email exists with different auth provider (no auto-linking in Fase 1)
- System MUST set `auth_provider = 'google'` in users table
- System MUST NOT store Google password (passwordless account)

**Scenarios:**

```gherkin
Scenario: Successful Google sign-in (new user)
  Given the email "maria@gmail.com" does NOT exist in database
  When the user completes Google OAuth in mobile app
  And mobile sends POST /api/auth/google with:
    { "idToken": "<valid_google_id_token>" }
  Then the backend verifies token with Google public keys (succeeds)
  And extracts claims: { email: "maria@gmail.com", name: "Maria Lopez", picture: "https://..." }
  And creates new user in `users` table with:
    - email: "maria@gmail.com"
    - full_name: "Maria Lopez"
    - profile_photo_url: "https://..."
    - auth_provider: "google"
    - password_hash: NULL
    - role: "client"
  And generates JWT access + refresh tokens
  And returns 201 Created with user + tokens

Scenario: Successful Google sign-in (existing user)
  Given the user "maria@gmail.com" exists with auth_provider='google'
  When the user sends POST /api/auth/google with valid idToken
  Then the backend verifies token
  And retrieves existing user from database
  And generates new JWT access + refresh tokens
  And returns 200 OK with user + tokens

Scenario: OAuth email collision (email/password account exists)
  Given the user "juan@example.com" exists with auth_provider='email'
  When the user tries POST /api/auth/google with idToken for "juan@example.com"
  Then the backend returns 409 Conflict
  And the response body contains:
    { "error": "Email already registered with email/password. Account linking not supported in MVP." }

Scenario: Invalid Google token
  Given the idToken signature is invalid or expired
  When the user sends POST /api/auth/google with invalid token
  Then the backend verification fails
  And returns 401 Unauthorized with:
    { "error": "Invalid Google authentication token" }
```

---

### FR-005: OAuth Facebook Sign-In

**Description:**  
Users MUST be able to authenticate using Facebook Login via native mobile SDKs. The system MUST validate the Facebook access token, create user if new, and return JWT tokens.

**Requirements:**
- System MUST use `react-native-fbsdk-next` SDK (NO WebView)
- System MUST validate Facebook access token using Facebook Graph API `/debug_token`
- System MUST verify token app ID matches QuickFixU app ID
- System MUST fetch user profile from Facebook Graph API: `/me?fields=id,name,email,picture`
- System MUST handle missing email (Facebook allows users to hide email)
- System MUST create new user if email does NOT exist
- System MUST reject if email exists with different auth provider
- System MUST set `auth_provider = 'facebook'` in users table

**Scenarios:**

```gherkin
Scenario: Successful Facebook sign-in (new user)
  Given the email "pedro@example.com" does NOT exist in database
  When the user completes Facebook Login in mobile app
  And mobile sends POST /api/auth/facebook with:
    { "accessToken": "<valid_facebook_access_token>" }
  Then the backend validates token with Facebook Graph API /debug_token (succeeds)
  And fetches user profile from /me endpoint
  And extracts: { email: "pedro@example.com", name: "Pedro Gomez", picture: {...} }
  And creates new user with auth_provider='facebook'
  And returns 201 Created with user + tokens

Scenario: Facebook user without email
  Given the Facebook user has hidden email in privacy settings
  When the backend fetches /me profile (email field is null)
  Then the system returns 400 Bad Request with:
    { "error": "Email permission required. Please allow email access in Facebook settings." }

Scenario: Invalid Facebook token
  Given the accessToken is expired or revoked
  When the backend validates with /debug_token (returns is_valid=false)
  Then the system returns 401 Unauthorized with:
    { "error": "Invalid Facebook authentication token" }

Scenario: Facebook email collision
  Given the user "juan@example.com" exists with auth_provider='email'
  When the user tries POST /api/auth/facebook with that email
  Then the system returns 409 Conflict (same as FR-004)
```

---

### FR-006: Refresh Token Rotation

**Description:**  
The system MUST automatically rotate refresh tokens when clients request new access tokens. This prevents refresh token reuse attacks.

**Requirements:**
- System MUST validate refresh token exists in `refresh_tokens` table (hashed match)
- System MUST verify refresh token has NOT expired
- System MUST verify refresh token has NOT been revoked
- System MUST generate new refresh token (invalidate old one)
- System MUST detect refresh token reuse (old token used after rotation)
- System MUST revoke entire token family if reuse detected (security breach indicator)
- System MUST return new access token + new refresh token

**Scenarios:**

```gherkin
Scenario: Successful token refresh
  Given the user has a valid refresh token "abc-123" (expires in 5 days)
  When the client sends POST /api/auth/refresh with:
    { "refresh_token": "abc-123" }
  Then the system verifies token hash in `refresh_tokens` table (found, not expired, not revoked)
  And marks token "abc-123" as revoked=true
  And generates new refresh token "def-456" (exp 7 days from now)
  And stores "def-456" hashed in database
  And generates new access token (exp 15min)
  And returns 200 OK with:
    { "access_token": "<new_jwt>", "refresh_token": "def-456" }

Scenario: Expired refresh token
  Given the refresh token "abc-123" expired 2 days ago
  When the client sends POST /api/auth/refresh with that token
  Then the system returns 401 Unauthorized with:
    { "error": "Refresh token expired. Please login again." }

Scenario: Refresh token reuse attack detected
  Given the user refreshed token "abc-123" → rotated to "def-456"
  And attacker tries to reuse old token "abc-123"
  When the system detects "abc-123" is marked revoked=true
  Then the system identifies this as potential token theft
  And revokes ALL refresh tokens for that user (token family)
  And returns 401 Unauthorized with:
    { "error": "Token reuse detected. All sessions invalidated for security." }
  And logs security event for admin review

Scenario: Non-existent refresh token
  Given the token "zzz-999" does NOT exist in database
  When the client sends POST /api/auth/refresh with that token
  Then the system returns 401 Unauthorized with:
    { "error": "Invalid refresh token" }
```

---

### FR-007: Logout

**Description:**  
Authenticated users MUST be able to logout, which invalidates their current refresh token to prevent reuse.

**Requirements:**
- System MUST mark refresh token as revoked=true in database
- System MUST NOT invalidate access tokens (they expire naturally in 15min)
- System MUST accept logout even if refresh token is already revoked (idempotent)
- System MUST return success even if token doesn't exist (security: don't leak info)

**Scenarios:**

```gherkin
Scenario: Successful logout
  Given the user is authenticated with refresh token "abc-123"
  When the user sends POST /api/auth/logout with:
    { "refresh_token": "abc-123" }
  Then the system marks "abc-123" as revoked=true in `refresh_tokens` table
  And returns 200 OK with:
    { "message": "Logged out successfully" }

Scenario: Logout with already revoked token
  Given the refresh token "abc-123" is already revoked=true
  When the user sends POST /api/auth/logout with that token
  Then the system returns 200 OK (idempotent operation)

Scenario: Logout with non-existent token
  Given the token "zzz-999" does NOT exist
  When the user sends POST /api/auth/logout with that token
  Then the system returns 200 OK (don't reveal token existence)
```

---

### FR-008: Get User Profile

**Description:**  
Authenticated users MUST be able to retrieve their own profile data, including role-specific fields (professional data if role='professional').

**Requirements:**
- System MUST require valid JWT in Authorization header
- System MUST return user data for authenticated userId from JWT payload
- System MUST include `professional` object if user is professional
- System MUST include `profile_photo_url` from Cloudinary
- System MUST include geocoded `latitude` and `longitude`
- System MUST NOT expose password_hash or refresh tokens

**Scenarios:**

```gherkin
Scenario: Get client profile
  Given the user "juan@example.com" is authenticated as client
  When the client sends GET /api/users/me with valid JWT
  Then the system extracts userId from JWT payload
  And retrieves user from `users` table
  And returns 200 OK with:
    {
      "id": 1,
      "full_name": "Juan Perez",
      "email": "juan@example.com",
      "phone": "+54 9 11 5555-1234",
      "dni": "12345678",
      "address": "Av. Corrientes 1234, CABA",
      "latitude": -34.603722,
      "longitude": -58.381592,
      "profile_photo_url": "https://res.cloudinary.com/...",
      "role": "client",
      "rating": 4.5,
      "rating_count": 12,
      "created_at": "2026-03-15T10:30:00Z"
    }

Scenario: Get professional profile
  Given the user "carlos@example.com" is authenticated as professional
  When the professional sends GET /api/users/me with valid JWT
  Then the system retrieves user + joins `professionals` table
  And returns 200 OK with:
    {
      "id": 2,
      "full_name": "Carlos Lopez",
      "email": "carlos@example.com",
      "role": "professional",
      "professional": {
        "years_experience": 5,
        "description": "Electricista matriculado...",
        "categories": [
          { "id": 1, "name": "Electricista", "icon": "⚡" },
          { "id": 3, "name": "Gasista", "icon": "🔥" }
        ],
        "certifications": [
          { "id": 1, "file_url": "https://...", "status": "approved" }
        ]
      },
      ...
    }

Scenario: Unauthorized request
  Given the JWT is missing or invalid
  When the client sends GET /api/users/me
  Then the system returns 401 Unauthorized with:
    { "error": "Authentication required" }
```

---

### FR-009: Update User Profile

**Description:**  
Authenticated users MUST be able to update their profile fields (name, phone, address). Address changes MUST trigger re-geocoding.

**Requirements:**
- System MUST allow updating: full_name, phone, address
- System MUST validate phone format if provided
- System MUST re-geocode address if changed (Nominatim → Google fallback)
- System MUST update `location` PostGIS field if address changed
- System MUST NOT allow changing: email, role, dni (immutable in Fase 1)
- System MUST return updated user object

**Scenarios:**

```gherkin
Scenario: Update name and phone
  Given the user "juan@example.com" is authenticated
  When the user sends PATCH /api/users/me with:
    { "full_name": "Juan Pablo Perez", "phone": "+54 9 11 6666-5555" }
  Then the system validates phone format (succeeds)
  And updates `users` table: full_name, phone
  And returns 200 OK with updated user object

Scenario: Update address with geocoding
  Given the user "juan@example.com" has address "Av. Corrientes 1234, CABA"
  When the user sends PATCH /api/users/me with:
    { "address": "Av. Santa Fe 5000, CABA" }
  Then the system geocodes new address with Nominatim
  And updates `users.address` = "Av. Santa Fe 5000, CABA"
  And updates `users.location` = ST_GeogFromText('POINT(-58.123 -34.456)')
  And updates `users.latitude` = -34.456, `users.longitude` = -58.123
  And returns 200 OK with updated user

Scenario: Update with invalid phone
  Given the user sends PATCH /api/users/me with:
    { "phone": "123" }
  Then the system validates phone format (fails)
  And returns 400 Bad Request with:
    { "field": "phone", "message": "Invalid phone format" }

Scenario: Attempt to change immutable field
  Given the user sends PATCH /api/users/me with:
    { "email": "newemail@example.com" }
  Then the system ignores email field (immutable)
  And returns 400 Bad Request with:
    { "error": "Cannot change email. Contact support for email updates." }
```

---

### FR-010: Upload Profile Photo

**Description:**  
Authenticated users MUST be able to upload a profile photo. The system MUST store it in Cloudinary and update the user's `profile_photo_url`.

**Requirements:**
- System MUST accept multipart/form-data with file field "photo"
- System MUST validate file is image (JPEG, PNG, WEBP only)
- System MUST validate file size ≤ 5MB
- System MUST resize image to 800x800px (quality 80%) before upload
- System MUST upload to Cloudinary with folder structure: `quickfixu/profiles/{userId}`
- System MUST update `users.profile_photo_url` with Cloudinary URL
- System MUST delete previous photo from Cloudinary if exists

**Scenarios:**

```gherkin
Scenario: Successful photo upload
  Given the user "juan@example.com" is authenticated
  When the user sends POST /api/users/me/photo with:
    - Content-Type: multipart/form-data
    - photo: <valid JPEG file, 2MB>
  Then the system validates file type (JPEG, valid)
  And resizes image to 800x800 with quality 80%
  And uploads to Cloudinary folder "quickfixu/profiles/1"
  And receives URL: "https://res.cloudinary.com/quickfixu/image/upload/v123/profiles/1/photo.jpg"
  And updates `users.profile_photo_url` in database
  And returns 200 OK with:
    { "profile_photo_url": "https://..." }

Scenario: Upload with file too large
  Given the user uploads a 6MB photo
  When the system validates file size
  Then the system returns 400 Bad Request with:
    { "error": "File size exceeds 5MB limit" }

Scenario: Upload with invalid file type
  Given the user uploads a PDF file
  When the system validates file type
  Then the system returns 400 Bad Request with:
    { "error": "Only JPEG, PNG, WEBP images allowed" }

Scenario: Replace existing photo
  Given the user already has profile_photo_url = "https://cloudinary.com/.../old.jpg"
  When the user uploads new photo
  Then the system deletes "old.jpg" from Cloudinary
  And uploads new photo
  And updates profile_photo_url
  And returns 200 OK
```

---

### FR-011: Professional Categories Selection

**Description:**  
Professional users MUST be able to view available categories and update their selected categories (1-3 maximum).

**Requirements:**
- System MUST provide GET /api/categories endpoint (public, no auth)
- System MUST allow professionals to POST /api/professionals/me/categories with array of category IDs
- System MUST validate 1-3 categories selected
- System MUST validate all category IDs exist
- System MUST replace existing categories (not append)
- System MUST update `professional_categories` join table

**Scenarios:**

```gherkin
Scenario: Get all categories
  Given the database has 3 seeded categories:
    - { id: 1, name: "Electricista", icon: "⚡" }
    - { id: 2, name: "Plomero", icon: "🔧" }
    - { id: 3, name: "Gasista", icon: "🔥" }
  When any user sends GET /api/categories
  Then the system returns 200 OK with array of all categories

Scenario: Professional selects categories
  Given the user "carlos@example.com" is authenticated as professional
  And currently has categories [1] (Electricista only)
  When the professional sends POST /api/professionals/me/categories with:
    { "category_ids": [1, 2, 3] }
  Then the system validates all IDs exist (success)
  And validates count 1-3 (3, valid)
  And deletes existing entries from `professional_categories`
  And inserts 3 new entries: (professional_id=2, category_id=1), (2,2), (2,3)
  And returns 200 OK with:
    { "categories": [
      { "id": 1, "name": "Electricista", "icon": "⚡" },
      { "id": 2, "name": "Plomero", "icon": "🔧" },
      { "id": 3, "name": "Gasista", "icon": "🔥" }
    ]}

Scenario: Select more than 3 categories
  Given the professional sends POST /api/professionals/me/categories with:
    { "category_ids": [1, 2, 3, 4] }
  Then the system returns 400 Bad Request with:
    { "error": "Maximum 3 categories allowed" }

Scenario: Client attempts to select categories
  Given the user "juan@example.com" is authenticated as client (NOT professional)
  When the client sends POST /api/professionals/me/categories
  Then the system returns 403 Forbidden with:
    { "error": "Only professionals can select categories" }
```

---

### FR-012: Upload Certification Documents

**Description:**  
Professional users MUST be able to upload certification documents (PDF, JPEG, PNG) for admin verification. Certifications start with status='pending'.

**Requirements:**
- System MUST accept multipart/form-data with file field "certification"
- System MUST validate file type: PDF, JPEG, PNG only
- System MUST validate file size ≤ 10MB
- System MUST upload to Cloudinary folder: `quickfixu/certifications/{professionalId}`
- System MUST create record in `certifications` table with status='pending'
- System MUST allow multiple certifications per professional
- System SHOULD support future admin approval workflow (out of scope Fase 1)

**Scenarios:**

```gherkin
Scenario: Successful certification upload
  Given the user "carlos@example.com" is authenticated as professional (id=2)
  When the professional sends POST /api/professionals/me/certifications with:
    - Content-Type: multipart/form-data
    - certification: <valid PDF file, 3MB>
  Then the system validates file type (PDF, valid)
  And uploads to Cloudinary folder "quickfixu/certifications/2"
  And creates record in `certifications` table:
    - professional_id: 2
    - file_url: "https://res.cloudinary.com/.../cert.pdf"
    - status: "pending"
    - uploaded_at: <now>
  And returns 201 Created with:
    {
      "id": 1,
      "file_url": "https://...",
      "status": "pending",
      "uploaded_at": "2026-03-22T14:00:00Z"
    }

Scenario: Upload with invalid file type
  Given the professional uploads a .docx file
  Then the system returns 400 Bad Request with:
    { "error": "Only PDF, JPEG, PNG files allowed" }

Scenario: Upload exceeding size limit
  Given the professional uploads a 12MB PDF
  Then the system returns 400 Bad Request with:
    { "error": "File size exceeds 10MB limit" }

Scenario: Client attempts to upload certification
  Given the user "juan@example.com" is authenticated as client
  When the client sends POST /api/professionals/me/certifications
  Then the system returns 403 Forbidden with:
    { "error": "Only professionals can upload certifications" }

Scenario: Get professional's certifications
  Given the professional "carlos@example.com" has 2 certifications uploaded
  When the professional sends GET /api/professionals/me/certifications
  Then the system returns 200 OK with:
    [
      { "id": 1, "file_url": "https://...", "status": "approved", "uploaded_at": "..." },
      { "id": 2, "file_url": "https://...", "status": "pending", "uploaded_at": "..." }
    ]
```

---

## 3. Non-Functional Requirements

### NFR-001: Performance

| Endpoint | p50 Latency | p95 Latency | p99 Latency |
|----------|-------------|-------------|-------------|
| POST /api/auth/login | <200ms | <500ms | <1s |
| POST /api/auth/register | <1s | <2s | <3s |
| POST /api/auth/refresh | <100ms | <300ms | <500ms |
| PATCH /api/users/me | <300ms | <700ms | <1s |
| POST /api/users/me/photo | <2s | <4s | <6s |
| GET /api/users/me | <100ms | <200ms | <500ms |

- Geocoding (Nominatim cache hit) MUST respond <50ms
- Geocoding (Google API fallback) MUST respond <500ms
- PostGIS radius queries (30km, 10K users) MUST execute <200ms
- Bcrypt password hashing MUST complete <400ms (cost 12)

### NFR-002: Security

- Passwords MUST be hashed with bcrypt cost 12 (NEVER stored plaintext)
- JWT access tokens MUST expire after 15 minutes
- Refresh tokens MUST expire after 7 days
- Refresh tokens MUST be stored hashed (SHA-256) in database
- Refresh tokens MUST rotate on every use (FR-006)
- HTTPS MUST be enforced in production (reject HTTP)
- CORS MUST whitelist only mobile app origins
- Rate limiting MUST apply: 10 requests/min per IP on /api/auth/* endpoints
- JWT MUST use RS256 algorithm (RSA 2048-bit keys, NOT HS256)
- Secrets (JWT keys, Cloudinary API key, Google/Facebook client secrets) MUST be stored in environment variables (NEVER committed to git)

### NFR-003: Availability

- System uptime SHOULD maintain 99.5% (target SLA)
- Health check endpoint GET /api/health MUST return 200 if database is reachable
- Database backups MUST run daily (automated via Railway/Render)
- Geocoding service downtime MUST NOT block user registration (503 error acceptable, retry later)

### NFR-004: Scalability

- System SHOULD handle 100 concurrent users (MVP target)
- Database SHOULD support 10,000 users initially
- PostGIS queries SHOULD scale to 50,000 professionals with <100ms latency
- Cloudinary free tier (25GB) SHOULD support ~12,500 profile photos (2MB average)

### NFR-005: Observability

- All API errors MUST log to console with:
  - Timestamp
  - Endpoint
  - User ID (if authenticated)
  - Error message + stack trace
- Failed login attempts MUST log IP address for security audit
- Geocoding fallbacks MUST log to detect Nominatim reliability
- JWT refresh token reuse attacks MUST log + alert admin

---

## 4. API Contract

### POST /api/auth/register

**Description:** Register new user (client or professional)

**Request:**
```typescript
// Headers
Content-Type: application/json

// Body (Client)
{
  full_name: string;       // required, 2-100 chars
  email: string;           // required, valid email per RFC 5322
  password: string;        // required, min 8 chars, 1 uppercase, 1 number, 1 special char
  phone: string;           // required, format +54 9 11 XXXX-XXXX or +54 9 XXX XXX-XXXX
  dni: string;             // required, 7-8 digits
  address: string;         // required, min 10 chars
}

// Body (Professional) - all client fields PLUS:
{
  ...clientFields,
  years_experience: number;  // required, >= 0
  description: string;       // required, 10-500 chars
  categories: number[];      // required, array of 1-3 category IDs
}
```

**Response 201 Created:**
```typescript
{
  user: {
    id: number;
    full_name: string;
    email: string;
    phone: string;
    dni: string;
    address: string;
    latitude: number;
    longitude: number;
    profile_photo_url: string | null;
    role: "client" | "professional";
    rating: number;          // 0 initially
    rating_count: number;    // 0 initially
    created_at: string;      // ISO 8601 timestamp
    professional?: {         // only if role='professional'
      years_experience: number;
      description: string;
      categories: Array<{ id: number; name: string; icon: string }>;
    };
  },
  tokens: {
    access_token: string;    // JWT, exp 15min
    refresh_token: string;   // UUID, exp 7 days
  }
}
```

**Response 400 Bad Request:**
```typescript
{
  error: "Validation failed",
  details: Array<{ field: string; message: string }>;
}
```

**Response 409 Conflict:**
```typescript
{
  error: "Email already registered"
}
```

**Response 503 Service Unavailable:**
```typescript
{
  error: "Geocoding service temporarily unavailable. Please try again later."
}
```

---

### POST /api/auth/login

**Description:** Authenticate with email/password

**Request:**
```typescript
// Headers
Content-Type: application/json

// Body
{
  email: string;      // required
  password: string;   // required
}
```

**Response 200 OK:**
```typescript
{
  user: {
    id: number;
    full_name: string;
    email: string;
    role: "client" | "professional";
    // ... (same structure as /register response)
  },
  tokens: {
    access_token: string;
    refresh_token: string;
  }
}
```

**Response 401 Unauthorized:**
```typescript
{
  error: "Invalid credentials"
}
```

**Response 429 Too Many Requests:**
```typescript
{
  error: "Too many login attempts. Try again in 15 minutes."
}
```

---

### POST /api/auth/google

**Description:** Authenticate with Google OAuth ID token

**Request:**
```typescript
// Headers
Content-Type: application/json

// Body
{
  idToken: string;  // required, JWT from Google Sign-In SDK
}
```

**Response 201 Created / 200 OK:**
```typescript
// Same as POST /auth/login response
```

**Response 401 Unauthorized:**
```typescript
{
  error: "Invalid Google authentication token"
}
```

**Response 409 Conflict:**
```typescript
{
  error: "Email already registered with email/password. Account linking not supported in MVP."
}
```

---

### POST /api/auth/facebook

**Description:** Authenticate with Facebook access token

**Request:**
```typescript
// Headers
Content-Type: application/json

// Body
{
  accessToken: string;  // required, access token from Facebook SDK
}
```

**Response 201 Created / 200 OK:**
```typescript
// Same as POST /auth/login response
```

**Response 400 Bad Request:**
```typescript
{
  error: "Email permission required. Please allow email access in Facebook settings."
}
```

**Response 401 Unauthorized:**
```typescript
{
  error: "Invalid Facebook authentication token"
}
```

**Response 409 Conflict:**
```typescript
{
  error: "Email already registered with different provider..."
}
```

---

### POST /api/auth/refresh

**Description:** Rotate refresh token and get new access token

**Request:**
```typescript
// Headers
Content-Type: application/json

// Body
{
  refresh_token: string;  // required, UUID
}
```

**Response 200 OK:**
```typescript
{
  access_token: string;   // new JWT, exp 15min
  refresh_token: string;  // new UUID, exp 7 days (old token invalidated)
}
```

**Response 401 Unauthorized:**
```typescript
{
  error: "Refresh token expired. Please login again."
}
// OR
{
  error: "Token reuse detected. All sessions invalidated for security."
}
// OR
{
  error: "Invalid refresh token"
}
```

---

### POST /api/auth/logout

**Description:** Invalidate refresh token

**Request:**
```typescript
// Headers
Content-Type: application/json

// Body
{
  refresh_token: string;  // required
}
```

**Response 200 OK:**
```typescript
{
  message: "Logged out successfully"
}
```

---

### GET /api/users/me

**Description:** Get authenticated user profile

**Request:**
```typescript
// Headers
Authorization: Bearer <access_token>  // required
```

**Response 200 OK:**
```typescript
{
  id: number;
  full_name: string;
  email: string;
  phone: string;
  dni: string;
  address: string;
  latitude: number;
  longitude: number;
  profile_photo_url: string | null;
  role: "client" | "professional";
  rating: number;
  rating_count: number;
  created_at: string;
  professional?: {  // only if role='professional'
    years_experience: number;
    description: string;
    categories: Array<{ id: number; name: string; icon: string }>;
    certifications: Array<{
      id: number;
      file_url: string;
      status: "pending" | "approved" | "rejected";
      uploaded_at: string;
    }>;
  };
}
```

**Response 401 Unauthorized:**
```typescript
{
  error: "Authentication required"
}
```

---

### PATCH /api/users/me

**Description:** Update user profile (name, phone, address)

**Request:**
```typescript
// Headers
Authorization: Bearer <access_token>
Content-Type: application/json

// Body (all fields optional, only include fields to update)
{
  full_name?: string;    // 2-100 chars
  phone?: string;        // format validated
  address?: string;      // triggers re-geocoding
}
```

**Response 200 OK:**
```typescript
// Same structure as GET /api/users/me
```

**Response 400 Bad Request:**
```typescript
{
  error: "Validation failed",
  details: Array<{ field: string; message: string }>;
}
// OR
{
  error: "Cannot change email. Contact support for email updates."
}
```

**Response 401 Unauthorized:**
```typescript
{
  error: "Authentication required"
}
```

---

### POST /api/users/me/photo

**Description:** Upload profile photo

**Request:**
```typescript
// Headers
Authorization: Bearer <access_token>
Content-Type: multipart/form-data

// Body
photo: File  // JPEG/PNG/WEBP, max 5MB
```

**Response 200 OK:**
```typescript
{
  profile_photo_url: string;  // Cloudinary URL
}
```

**Response 400 Bad Request:**
```typescript
{
  error: "File size exceeds 5MB limit"
}
// OR
{
  error: "Only JPEG, PNG, WEBP images allowed"
}
```

**Response 401 Unauthorized:**
```typescript
{
  error: "Authentication required"
}
```

---

### GET /api/categories

**Description:** Get all available categories (public endpoint)

**Request:**
```typescript
// No authentication required
```

**Response 200 OK:**
```typescript
[
  { id: 1, name: "Electricista", icon: "⚡" },
  { id: 2, name: "Plomero", icon: "🔧" },
  { id: 3, name: "Gasista", icon: "🔥" }
]
```

---

### POST /api/professionals/me/categories

**Description:** Update professional's selected categories

**Request:**
```typescript
// Headers
Authorization: Bearer <access_token>
Content-Type: application/json

// Body
{
  category_ids: number[];  // array of 1-3 category IDs
}
```

**Response 200 OK:**
```typescript
{
  categories: Array<{ id: number; name: string; icon: string }>;
}
```

**Response 400 Bad Request:**
```typescript
{
  error: "Maximum 3 categories allowed"
}
// OR
{
  error: "Invalid category ID: 999"
}
```

**Response 403 Forbidden:**
```typescript
{
  error: "Only professionals can select categories"
}
```

---

### POST /api/professionals/me/certifications

**Description:** Upload certification document

**Request:**
```typescript
// Headers
Authorization: Bearer <access_token>
Content-Type: multipart/form-data

// Body
certification: File  // PDF/JPEG/PNG, max 10MB
```

**Response 201 Created:**
```typescript
{
  id: number;
  file_url: string;
  status: "pending";
  uploaded_at: string;  // ISO 8601
}
```

**Response 400 Bad Request:**
```typescript
{
  error: "Only PDF, JPEG, PNG files allowed"
}
// OR
{
  error: "File size exceeds 10MB limit"
}
```

**Response 403 Forbidden:**
```typescript
{
  error: "Only professionals can upload certifications"
}
```

---

### GET /api/professionals/me/certifications

**Description:** Get professional's uploaded certifications

**Request:**
```typescript
// Headers
Authorization: Bearer <access_token>
```

**Response 200 OK:**
```typescript
[
  {
    id: number;
    file_url: string;
    status: "pending" | "approved" | "rejected";
    uploaded_at: string;
  },
  // ...
]
```

**Response 403 Forbidden:**
```typescript
{
  error: "Only professionals can access certifications"
}
```

---

## 5. Validation Rules

| Field | Type | Required | Validation | Error Message |
|-------|------|----------|------------|---------------|
| email | string | Yes | RFC 5322 regex: `/^[^\s@]+@[^\s@]+\.[^\s@]+$/` | "Invalid email format" |
| password | string | Yes | Min 8 chars, 1 uppercase, 1 number, 1 special char | "Password must be at least 8 characters and contain 1 uppercase, 1 number, 1 special character" |
| full_name | string | Yes | 2-100 characters | "Full name must be 2-100 characters" |
| phone | string | Yes | Regex: `/^\+54 9 (11\|[2-9]\d{1,2}) \d{4}-\d{4}$/` | "Invalid phone format. Expected: +54 9 11 XXXX-XXXX or +54 9 XXX XXX-XXXX" |
| dni | string | Yes | Regex: `/^\d{7,8}$/` | "DNI must be 7-8 digits" |
| address | string | Yes | Min 10 characters | "Address must be at least 10 characters" |
| years_experience | number | Yes (prof) | Integer >= 0 | "Years of experience must be >= 0" |
| description | string | Yes (prof) | 10-500 characters | "Description must be 10-500 characters" |
| categories | array | Yes (prof) | Length 1-3, all IDs exist in `categories` table | "Must select 1-3 valid categories" |
| photo | file | Yes (upload) | MIME: image/jpeg, image/png, image/webp; Size <= 5MB | "Only JPEG, PNG, WEBP images allowed. Max 5MB." |
| certification | file | Yes (upload) | MIME: application/pdf, image/jpeg, image/png; Size <= 10MB | "Only PDF, JPEG, PNG files allowed. Max 10MB." |

---

## 6. Error Handling

### HTTP Status Codes

| Code | Meaning | When to Use |
|------|---------|-------------|
| **200 OK** | Success | GET, PATCH, DELETE successful |
| **201 Created** | Resource created | POST /auth/register, POST /certifications |
| **400 Bad Request** | Validation error | Invalid input data |
| **401 Unauthorized** | Authentication failed | Invalid/missing JWT, invalid credentials |
| **403 Forbidden** | Authorization failed | Client trying professional endpoint |
| **404 Not Found** | Resource doesn't exist | GET /users/999 (non-existent user) |
| **409 Conflict** | Duplicate resource | Email already registered |
| **429 Too Many Requests** | Rate limit exceeded | >5 login attempts in 15min |
| **500 Internal Server Error** | Unhandled exception | Database connection failure |
| **503 Service Unavailable** | External service down | Geocoding/Cloudinary unavailable |

### Error Response Format

All errors MUST follow this structure:

```typescript
{
  error: string;              // Human-readable error message
  details?: Array<{           // Optional validation details
    field: string;
    message: string;
  }>;
  code?: string;              // Optional error code (e.g., "TOKEN_REUSE_DETECTED")
}
```

### Prisma Error Mapping

| Prisma Error | HTTP Status | Client Message |
|--------------|-------------|----------------|
| `P2002` (Unique constraint) | 409 Conflict | "Email already registered" |
| `P2025` (Record not found) | 404 Not Found | "User not found" |
| `P2003` (Foreign key constraint) | 400 Bad Request | "Invalid category ID" |
| Connection timeout | 503 Service Unavailable | "Database temporarily unavailable" |

---

## 7. Security Requirements

### Password Security
- **Hashing:** bcrypt with cost factor 12 (NEVER store plaintext)
- **Strength policy:** Minimum 8 chars, 1 uppercase, 1 number, 1 special character
- **Timing attack protection:** Use `bcrypt.compare()` (constant-time), add 200ms delay for non-existent emails

### JWT Security
- **Algorithm:** RS256 (RSA asymmetric keys, 2048-bit)
- **Expiration:** Access token 15 minutes, refresh token 7 days
- **Payload:** `{ userId: number, role: string, iat: number, exp: number }`
- **Secret storage:** Private key in environment variable `JWT_PRIVATE_KEY`, public key in `JWT_PUBLIC_KEY`
- **Signature:** Sign with private key, verify with public key (prevents HMAC secret leaks)

### Refresh Token Security
- **Storage:** SHA-256 hashed in `refresh_tokens` table (NEVER store plaintext)
- **Rotation:** Generate new token on every refresh, invalidate old token (FR-006)
- **Reuse detection:** If revoked token is used, invalidate entire token family (security breach indicator)
- **Expiration:** 7 days, delete expired tokens daily via cron job

### OAuth Security
- **Token validation:** Verify Google/Facebook tokens with official APIs (NEVER trust client)
- **CSRF protection:** Use SDK-provided state parameter
- **Scope validation:** Only request `email` and `profile` scopes (minimum necessary)

### CORS Policy
- **Allowed origins:** Only whitelist mobile app origins (future web app domains)
- **Credentials:** Allow credentials (cookies) only from whitelisted origins
- **Methods:** Only allow POST, GET, PATCH, DELETE (no OPTIONS preflight caching in production)

### Rate Limiting
- **Auth endpoints:** Max 10 requests/min per IP on `/api/auth/*`
- **Login:** Max 5 failed attempts per IP per 15 minutes (429 response)
- **Implementation:** Use `express-rate-limit` middleware

### HTTPS Enforcement
- **Production:** Redirect all HTTP → HTTPS (301 Permanent Redirect)
- **Headers:** Set `Strict-Transport-Security: max-age=31536000; includeSubDomains`

### Secrets Management
- **Environment variables:** Store ALL secrets in `.env` (NEVER commit to git)
- **Required secrets:**
  - `JWT_PRIVATE_KEY`, `JWT_PUBLIC_KEY`
  - `DATABASE_URL`
  - `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`
  - `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
  - `FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET`
- **Validation:** Startup script MUST verify all secrets are set (fail fast if missing)

---

## 8. Performance Targets

### Latency Targets (by percentile)

| Endpoint | p50 | p95 | p99 | Max Acceptable |
|----------|-----|-----|-----|----------------|
| POST /auth/login | <200ms | <500ms | <1s | 2s |
| POST /auth/register | <1s | <2s | <3s | 5s |
| POST /auth/refresh | <100ms | <300ms | <500ms | 1s |
| GET /users/me | <100ms | <200ms | <500ms | 1s |
| PATCH /users/me (no geocoding) | <300ms | <700ms | <1s | 2s |
| PATCH /users/me (with geocoding) | <1.5s | <3s | <5s | 8s |
| POST /users/me/photo | <2s | <4s | <6s | 10s |
| POST /professionals/me/certifications | <3s | <6s | <10s | 15s |

### Database Query Targets
- User lookup by ID: <10ms
- User lookup by email (indexed): <20ms
- PostGIS radius query (30km, 10K users): <200ms
- Professional categories join query: <50ms

### External Service Targets
- Nominatim geocoding (cache hit): <50ms
- Nominatim geocoding (cache miss): <1s
- Google Geocoding API: <500ms
- Cloudinary upload (5MB photo): <3s
- Google OAuth token verification: <300ms
- Facebook OAuth token verification: <400ms

### Optimization Strategies
- **Database indexes:**
  - `CREATE INDEX idx_users_email ON users(email);` (unique)
  - `CREATE INDEX idx_users_location ON users USING GIST(location);` (PostGIS spatial)
  - `CREATE INDEX idx_refresh_tokens_user ON refresh_tokens(user_id, expires_at);`
  - `CREATE INDEX idx_professional_categories ON professional_categories(professional_id);`
- **Caching:**
  - Nominatim geocoding responses: 90-day Redis cache (key: `geocode:{address_hash}`)
  - Categories list: In-memory cache (invalidate on seed updates)
- **Connection pooling:**
  - Prisma connection pool: min 5, max 20 connections
- **Image optimization:**
  - Resize to 800x800 before upload (reduce Cloudinary bandwidth)
  - JPEG quality 80% (balance size vs quality)

---

## 9. Dependencies

### External Services

| Service | Purpose | Endpoint | Credentials Required | SLA |
|---------|---------|----------|---------------------|-----|
| **Nominatim** | Free geocoding (primary) | `https://nominatim.openstreetmap.org/search` | None (rate limit: 1 req/sec) | No SLA |
| **Google Geocoding API** | Geocoding fallback | `https://maps.googleapis.com/maps/api/geocode/json` | API Key | 99.9% |
| **Google Places Autocomplete** | Address autocomplete UI | `https://maps.googleapis.com/maps/api/place/autocomplete/json` | API Key | 99.9% |
| **Cloudinary** | Image/file storage | `https://api.cloudinary.com/v1_1/{cloud_name}/upload` | Cloud name, API key, API secret | 99.9% |
| **Google Sign-In** | OAuth identity provider | Google Auth API | Client ID, Client Secret | 99.9% |
| **Facebook Login** | OAuth identity provider | Facebook Graph API | App ID, App Secret | 99.5% |

### Third-Party SDKs

| SDK | Version | Purpose | Platform |
|-----|---------|---------|----------|
| `@react-native-google-signin/google-signin` | ^11.0 | Google OAuth | iOS + Android |
| `react-native-fbsdk-next` | ^12.0 | Facebook OAuth | iOS + Android |
| `react-native-keychain` | ^8.1 | Secure token storage | iOS + Android |
| `jsonwebtoken` | ^9.0 | JWT signing/verification | Node.js |
| `bcrypt` | ^5.1 | Password hashing | Node.js |
| `validator` | ^13.11 | Email/URL validation | Node.js |
| `libphonenumber-js` | ^1.10 | Phone validation | Node.js |

### Internal Prerequisites
None (Fase 1 is foundational)

### Approval Lead Times

| Requirement | Lead Time | Blocker Level |
|-------------|-----------|---------------|
| Google Cloud Console OAuth credentials | 3-7 days | Soft (can launch with email/password) |
| Facebook Developer App review | 3-7 days | Soft |
| Cloudinary free tier signup | Instant | None |
| PostgreSQL + PostGIS hosting (Railway/Render) | Instant | Hard (critical) |

---

## 10. Assumptions & Constraints

### Assumptions
1. **MVP geography:** Only Argentina supported (phone/DNI validation, geocoding CABA focus)
2. **Language:** Spanish-only error messages in Fase 1 (i18n in Fase 2)
3. **Admin validation:** Certifications approved manually via Prisma Studio (no admin UI in Fase 1)
4. **Email verification:** NOT required for MVP (user can post/quote without verified email)
5. **Password reset:** Manual process via support (automated flow in Fase 2)

<!-- NOTA: Contenido truncado en engram. Requiere regeneración completa. -->
