# Specification: Fase 2 - Posts & Proposals

## 1. Introduction

This specification defines the functional and non-functional requirements for **Fase 2: Posts & Proposals** of QuickFixU. It is derived from the approved exploration and proposal documents and serves as the binding contract between backend and frontend teams.

**Change name:** `fase-2-posts-proposals`  
**Persistence mode:** Engram  
**Prerequisite:** Fase 1 (Core Authentication & Profiles) MUST be completed  
**Base proposal:** Posts CRUD, Proposals CRUD, Feed, Notifications, Cronjobs, Chat auto-creation

**Features in scope:**
1. Posts CRUD (Create, Read, Update, Delete)
2. Post Media Upload (5 images + 2 videos)
3. Professional Feed with Geo-filtering (30km radius)
4. Proposals CRUD (Create, Read, Update)
5. Proposal Accept/Reject Workflow
6. Notifications Push (FCM + in-app table)
7. Cronjobs: Posts/Proposals Expiration (48hs)
8. Cronjobs: Soft Delete Old Posts (90 days)
9. Chat Auto-creation on Proposal Send

---

## 2. Functional Requirements

### FR-001: Create Post (Client)

**Description:**  
A client user MUST be able to create a post describing a problem/job, including title, description, category selection, location, and optional media (up to 5 images + 2 videos). The system MUST set expiration to 48 hours from creation.

**Requirements:**
- System MUST validate title is 10-100 characters
- System MUST validate description is 20-500 characters
- System MUST validate at least 1 category selected (max 3)
- System MUST use client's profile location OR allow custom address (triggers geocoding)
- System MUST accept up to 5 images (JPEG, PNG, WEBP, max 5MB each)
- System MUST accept up to 2 videos (MP4, MOV, max 50MB each)
- System MUST upload media to Cloudinary sequentially (timeout 30s total)
- System MUST set status='open' and expires_at = NOW() + 48 hours
- System MUST apply rate limit: max 10 posts per client per 24 hours
- System MUST create entries in `post_categories` join table

**Scenarios:**

```gherkin
Scenario: Successful post creation with images
  Given the client "juan@example.com" is authenticated
  And the client has created 3 posts in the last 24 hours (below rate limit)
  When the client sends POST /api/posts with:
    - title: "Fuga de agua en cocina"
    - description: "Se rompió la canilla del lavaplatos, gotea constantemente. Necesito urgente."
    - category_ids: [2] (Plomero)
    - use_profile_location: true
    - media: [image1.jpg (2MB), image2.jpg (1.5MB)]
  Then the system validates all fields (success)
  And uploads 2 images to Cloudinary folder "quickfixu/posts/{postId}"
  And creates record in `posts` table with:
    - user_id: <client_id>
    - title, description
    - latitude, longitude (from client's profile)
    - location (PostGIS point)
    - status: "open"
    - expires_at: NOW() + 48 hours
    - created_at: NOW()
  And creates 1 entry in `post_categories` (category_id=2)
  And creates 2 entries in `post_media` with media_type='image', media_url
  And returns 201 Created with:
    {
      "id": 1,
      "title": "Fuga de agua en cocina",
      "description": "...",
      "status": "open",
      "latitude": -34.603722,
      "longitude": -58.381592,
      "expires_at": "2026-03-24T10:30:00Z",
      "categories": [{ "id": 2, "name": "Plomero", "icon": "🔧" }],
      "media": [
        { "id": 1, "media_type": "image", "media_url": "https://res.cloudinary.com/..." },
        { "id": 2, "media_type": "image", "media_url": "https://..." }
      ],
      "created_at": "2026-03-22T10:30:00Z"
    }

Scenario: Post creation with custom address (geocoding)
  Given the client wants to post for a different location than their profile
  When the client sends POST /api/posts with:
    - custom_address: "Av. Corrientes 5000, CABA"
    - use_profile_location: false
  Then the system geocodes "Av. Corrientes 5000, CABA" with Nominatim
  And stores geocoded lat/lng in post.location
  And returns 201 Created

Scenario: Post creation exceeding media limits
  Given the client uploads 6 images
  When the client sends POST /api/posts with 6 image files
  Then the system validates media count (fails: >5 images)
  And returns 400 Bad Request with:
    { "error": "Maximum 5 images allowed" }

Scenario: Post creation with video too large
  Given the client uploads video.mp4 (60MB, exceeds 50MB limit)
  When the client sends POST /api/posts
  Then Multer middleware rejects file before upload
  And returns 413 Payload Too Large with:
    { "error": "Video exceeds 50MB limit" }

Scenario: Post creation rate limit exceeded
  Given the client has created 10 posts in the last 24 hours
  When the client tries to create an 11th post
  Then the system returns 429 Too Many Requests with:
    { "error": "Daily post limit reached. Maximum 10 posts per day." }

Scenario: Professional attempts to create post
  Given the user "carlos@example.com" has role='professional'
  When the professional sends POST /api/posts
  Then the system returns 403 Forbidden with:
    { "error": "Only clients can create posts" }

Scenario: Post creation with invalid category
  Given the client sends category_ids: [999] (non-existent)
  When the client sends POST /api/posts
  Then the system returns 400 Bad Request with:
    { "error": "Invalid category ID: 999" }

Scenario: Video upload timeout (>30s)
  Given the client uploads video.mp4 (45MB, Cloudinary processing takes 35s)
  When the system attempts Cloudinary upload
  Then upload times out after 30 seconds
  And returns 504 Gateway Timeout with:
    { "error": "Video upload timeout. Please use a shorter video (<15 seconds) or compress to <30MB." }
```

---

### FR-002: Get Professional Feed (Geo-filtered Posts)

**Description:**  
A professional user MUST be able to view a paginated feed of open posts within 30km radius, filtered by their selected categories, sorted by creation date (newest first), with cursor-based pagination.

**Requirements:**
- System MUST query posts where status='open', deleted_at=NULL, expires_at > NOW()
- System MUST use PostGIS ST_DWithin to filter posts within 30,000 meters (30km)
- System MUST filter posts matching professional's categories (join `post_categories`)
- System MUST sort by created_at DESC, id DESC (cursor-based pagination)
- System MUST return max 20 posts per page
- System MUST truncate lat/lng to 2 decimals for privacy (±1km precision)
- System MUST include media URLs, category names, distance_km
- System MUST return nextCursor for pagination
- System MUST complete query in <300ms (p95)

**Scenarios:**

```gherkin
Scenario: Professional views feed (first page)
  Given the professional "carlos@example.com" is authenticated
  And has categories [1, 3] (Electricista, Gasista)
  And profile location is lat=-34.603722, lng=-58.381592 (CABA)
  And database has 25 open posts within 30km:
    - 10 posts in category 1 (Electricista)
    - 8 posts in category 2 (Plomero) — should NOT appear
    - 7 posts in category 3 (Gasista)
  When the professional sends GET /api/posts?limit=20
  Then the system executes PostGIS query:
    SELECT * FROM posts p
    WHERE p.status='open' AND p.deleted_at IS NULL AND p.expires_at > NOW()
    AND ST_DWithin(p.location, ST_Point(-58.381592, -34.603722)::geography, 30000)
    AND EXISTS (
      SELECT 1 FROM post_categories pc 
      WHERE pc.post_id=p.id AND pc.category_id IN (1, 3)
    )
    ORDER BY p.created_at DESC, p.id DESC
    LIMIT 20
  And returns 200 OK with:
    {
      "posts": [
        {
          "id": 25,
          "title": "Instalación toma corriente",
          "description": "...",
          "status": "open",
          "latitude": -34.60,  // truncated from -34.603722
          "longitude": -58.38, // truncated from -58.381592
          "distance_km": 2.5,
          "categories": [{ "id": 1, "name": "Electricista" }],
          "media": [...],
          "expires_at": "2026-03-24T12:00:00Z",
          "created_at": "2026-03-22T12:00:00Z"
        },
        // ... 19 more posts
      ],
      "nextCursor": { "createdAt": "2026-03-21T08:00:00Z", "id": 6 },
      "hasMore": true
    }

Scenario: Professional views feed (second page with cursor)
  Given the professional received nextCursor from first page:
    { "createdAt": "2026-03-21T08:00:00Z", "id": 6 }
  When the professional sends GET /api/posts?cursor={"createdAt":"2026-03-21T08:00:00Z","id":6}&limit=20
  Then the system queries posts WHERE:
    (created_at < '2026-03-21T08:00:00Z') OR (created_at='2026-03-21T08:00:00Z' AND id < 6)
  And returns next 20 posts (posts 21-40)
  And returns nextCursor for page 3 OR null if last page

Scenario: Professional outside 30km radius (no posts)
  Given the professional is located in Rosario (400km from CABA)
  And all posts are in CABA
  When the professional sends GET /api/posts
  Then the system returns 200 OK with:
    { "posts": [], "nextCursor": null, "hasMore": false }

Scenario: Client attempts to view professional feed
  Given the user "juan@example.com" has role='client'
  When the client sends GET /api/posts
  Then the system returns 403 Forbidden with:
    { "error": "Only professionals can view the feed" }

Scenario: Feed excludes expired posts
  Given database has 5 open posts within 30km:
    - 3 posts with expires_at > NOW() (should appear)
    - 2 posts with expires_at < NOW() BUT status still 'open' (cronjob not executed yet)
  When the professional sends GET /api/posts
  Then the system returns ONLY 3 posts (WHERE expires_at > NOW())
  And filters expired posts client-side even if status='open'
```

---

### FR-003: Get Post Detail

**Description:**  
Any authenticated user MUST be able to view full details of a specific post, including all media, exact location (if owner or has accepted proposal), and received proposals (if owner).

**Requirements:**
- System MUST return post if exists and not soft-deleted
- System MUST include all media URLs
- System MUST show exact lat/lng ONLY if:
  - Requester is post owner (client), OR
  - Requester is professional with accepted proposal
- System MUST show truncated lat/lng (2 decimals) for other professionals
- System MUST include proposals count for post owner
- System MUST NOT expose proposals list to non-owners

**Scenarios:**

```gherkin
Scenario: Post owner views own post
  Given the client "juan@example.com" created post ID 1
  And post has 3 proposals (1 pending, 1 rejected, 1 accepted)
  When the client sends GET /api/posts/1
  Then the system returns 200 OK with:
    {
      "id": 1,
      "title": "Fuga de agua",
      "description": "...",
      "status": "open",
      "latitude": -34.603722,  // EXACT location (owner)
      "longitude": -58.381592,
      "categories": [...],
      "media": [...],
      "proposals_count": 3,
      "expires_at": "...",
      "created_at": "...",
      "owner": true  // flag indicating requester is owner
    }

Scenario: Professional views post (not owner, no accepted proposal)
  Given the professional "carlos@example.com" views post ID 1
  And has NOT sent proposal yet OR proposal is pending/rejected
  When the professional sends GET /api/posts/1
  Then the system returns 200 OK with:
    {
      "id": 1,
      "title": "Fuga de agua",
      "latitude": -34.60,  // TRUNCATED (privacy)
      "longitude": -58.38,
      "proposals_count": 3,  // NOT shown to non-owner
      "owner": false
    }

Scenario: Professional views post (has accepted proposal)
  Given the professional "carlos@example.com" has accepted proposal for post ID 1
  When the professional sends GET /api/posts/1
  Then the system returns EXACT lat/lng (work is confirmed, needs address)

Scenario: Get non-existent post
  Given post ID 999 does NOT exist
  When any user sends GET /api/posts/999
  Then the system returns 404 Not Found with:
    { "error": "Post not found" }

Scenario: Get soft-deleted post
  Given post ID 5 has deleted_at='2026-03-01T00:00:00Z'
  When any user sends GET /api/posts/5
  Then the system returns 404 Not Found (treat as non-existent)
```

---

### FR-004: Update Post (Client Owner Only)

**Description:**  
A client MUST be able to update their own post's title, description, and categories ONLY if the post has 0 proposals. Posts with proposals CANNOT be edited (prevents invalidating proposals).

**Requirements:**
- System MUST verify requester is post owner
- System MUST verify post status='open'
- System MUST verify post has 0 proposals
- System MUST allow updating: title, description, category_ids
- System MUST NOT allow updating: location, media (immutable)
- System MUST validate same rules as FR-001 (title 10-100 chars, etc.)

**Scenarios:**

```gherkin
Scenario: Successful post update (no proposals)
  Given the client "juan@example.com" owns post ID 1
  And post has 0 proposals
  And post status='open'
  When the client sends PATCH /api/posts/1 with:
    { "title": "Fuga urgente en cocina", "description": "Cambié texto" }
  Then the system validates title, description (success)
  And updates `posts` table: title, description, updated_at
  And returns 200 OK with updated post

Scenario: Attempt to edit post with proposals
  Given the client owns post ID 1
  And post has 2 proposals (pending)
  When the client sends PATCH /api/posts/1
  Then the system returns 400 Bad Request with:
    { "error": "Cannot edit post with existing proposals. Close this post and create a new one." }

Scenario: Attempt to edit closed post
  Given the client owns post ID 1
  And post status='closed' (proposal accepted)
  When the client sends PATCH /api/posts/1
  Then the system returns 400 Bad Request with:
    { "error": "Cannot edit closed post" }

Scenario: Non-owner attempts to edit post
  Given the client "maria@example.com" does NOT own post ID 1
  When maria sends PATCH /api/posts/1
  Then the system returns 403 Forbidden with:
    { "error": "You can only edit your own posts" }
```

---

### FR-005: Close Post Manually (Client Owner Only)

**Description:**  
A client MUST be able to manually close their own post before expiration (e.g., problem solved externally). This sets status='closed' and rejects all pending proposals.

**Requirements:**
- System MUST verify requester is post owner
- System MUST verify post status='open'
- System MUST set status='closed'
- System MUST set all pending proposals to status='rejected'
- System MUST NOT send notifications to professionals (manual close is implicit rejection)

**Scenarios:**

```gherkin
Scenario: Successful manual post close
  Given the client "juan@example.com" owns post ID 1
  And post status='open'
  And post has 3 proposals: 1 pending, 1 rejected, 1 expired
  When the client sends DELETE /api/posts/1
  Then the system updates `posts` SET status='closed'
  And updates `proposals` SET status='rejected' WHERE post_id=1 AND status='pending'
  And returns 200 OK with:
    { "message": "Post closed successfully", "rejected_proposals": 1 }

Scenario: Close already closed post (idempotent)
  Given post ID 1 status='closed'
  When the client sends DELETE /api/posts/1
  Then the system returns 200 OK (idempotent, no changes)

Scenario: Non-owner attempts to close post
  Given the client "maria@example.com" does NOT own post ID 1
  When maria sends DELETE /api/posts/1
  Then the system returns 403 Forbidden
```

---

### FR-006: Get Client's Own Posts (History)

**Description:**  
A client MUST be able to view a paginated list of their own posts (all statuses), sorted by created_at DESC, with proposal counts.

**Requirements:**
- System MUST filter posts WHERE user_id=<client_id> AND deleted_at=NULL
- System MUST include all statuses: open, closed, expired, completed
- System MUST include proposals_count for each post
- System MUST use cursor-based pagination (limit 20)
- System MUST sort by created_at DESC

**Scenarios:**

```gherkin
Scenario: Client views post history
  Given the client "juan@example.com" has created 25 posts:
    - 5 open
    - 10 closed (accepted proposal)
    - 8 expired
    - 2 completed (Fase 4)
  When the client sends GET /api/posts/me?limit=20
  Then the system returns 200 OK with:
    {
      "posts": [
        {
          "id": 25,
          "title": "...",
          "status": "open",
          "proposals_count": 3,
          "expires_at": "...",
          "created_at": "2026-03-22T10:00:00Z"
        },
        // ... 19 more posts
      ],
      "nextCursor": {...},
      "hasMore": true
    }

Scenario: Client with no posts
  Given the client "newuser@example.com" has created 0 posts
  When the client sends GET /api/posts/me
  Then the system returns 200 OK with:
    { "posts": [], "nextCursor": null, "hasMore": false }
```

---

### FR-007: Create Proposal (Professional)

**Description:**  
A professional MUST be able to send a proposal to an open post, including price, description, scheduled date/time. The system MUST auto-create a chat between client and professional, send push notification to client, and enforce 1 proposal per professional per post.

**Requirements:**
- System MUST verify requester is professional
- System MUST verify post status='open' AND expires_at > NOW()
- System MUST verify professional has NOT already sent proposal (unique constraint)
- System MUST validate price: ARS 500 - ARS 100,000
- System MUST validate description: 10-300 characters
- System MUST validate scheduled_date is future date (>2 hours from now)
- System MUST validate scheduled_time is valid time (HH:MM format)
- System MUST set status='pending', expires_at = NOW() + 48 hours
- System MUST create/update chat record (client_id, professional_id)
- System MUST send FCM notification to post owner
- System MUST create in-app notification record

**Scenarios:**

```gherkin
Scenario: Successful proposal creation
  Given the professional "carlos@example.com" is authenticated
  And professional has categories [1] (Electricista)
  And post ID 1 has category [1] (Electricista)
  And post status='open', expires_at='2026-03-24T10:00:00Z' (future)
  And professional has NOT sent proposal to post 1
  When the professional sends POST /api/proposals with:
    {
      "post_id": 1,
      "price": 5000,
      "description": "Puedo ir mañana a las 10am. Tengo 5 años experiencia en instalaciones eléctricas.",
      "scheduled_date": "2026-03-23",
      "scheduled_time": "10:00"
    }
  Then the system validates all fields (success)
  And creates record in `proposals` table:
    - post_id: 1
    - professional_id: <carlos_professional_id>
    - price: 5000.00
    - description: "..."
    - scheduled_date, scheduled_time
    - status: "pending"
    - expires_at: NOW() + 48 hours
  And upserts record in `chats` table:
    - client_id: <post_owner_id>
    - professional_id: <carlos_user_id>
    - last_message_at: NOW()
  And sends FCM push to post owner:
    - title: "🎉 Nueva propuesta"
    - body: "Carlos Lopez envió presupuesto: ARS $5,000"
    - data: { type: "new_proposal", proposalId, postId }
  And creates in-app notification in `notifications` table
  And returns 201 Created with:
    {
      "id": 1,
      "post_id": 1,
      "professional": {
        "id": 2,
        "full_name": "Carlos Lopez",
        "profile_photo_url": "...",
        "rating": 4.5
      },
      "price": 5000,
      "description": "...",
      "scheduled_date": "2026-03-23",
      "scheduled_time": "10:00",
      "status": "pending",
      "expires_at": "2026-03-24T12:00:00Z",
      "created_at": "2026-03-22T12:00:00Z"
    }

Scenario: Duplicate proposal (professional already sent one)
  Given the professional "carlos@example.com" already sent proposal to post 1
  And proposal status='pending'
  When the professional tries to send another proposal to post 1
  Then the system returns 409 Conflict with:
    { "error": "You already sent a proposal to this post. Edit it in the chat." }

Scenario: Proposal to expired post
  Given post ID 1 expires_at='2026-03-20T10:00:00Z' (past)
  When the professional sends POST /api/proposals for post 1
  Then the system returns 400 Bad Request with:
    { "error": "Post has expired" }

Scenario: Proposal to closed post
  Given post ID 1 status='closed'
  When the professional sends POST /api/proposals
  Then the system returns 400 Bad Request with:
    { "error": "Post is closed" }

Scenario: Proposal with invalid price (too low)
  Given the professional sends price: 100 (below ARS 500 minimum)
  When the professional sends POST /api/proposals
  Then the system returns 400 Bad Request with:
    { "error": "Price must be between ARS 500 and ARS 100,000" }

Scenario: Proposal with invalid price (too high)
  Given the professional sends price: 150000 (above ARS 100,000 maximum)
  When the professional sends POST /api/proposals
  Then the system returns 400 Bad Request with:
    { "error": "Price must be between ARS 500 and ARS 100,000. Contact support for larger jobs." }

Scenario: Proposal with past scheduled date
  Given the professional sends scheduled_date: "2026-03-20" (yesterday)
  When the professional sends POST /api/proposals
  Then the system returns 400 Bad Request with:
    { "error": "Scheduled date must be at least 2 hours in the future" }

Scenario: Client attempts to send proposal
  Given the user "juan@example.com" has role='client'
  When the client sends POST /api/proposals
  Then the system returns 403 Forbidden with:
    { "error": "Only professionals can send proposals" }

Scenario: FCM token missing (silent failure)
  Given the post owner has fcm_token=NULL (user disabled notifications)
  When the professional sends proposal
  Then the system creates proposal + in-app notification
  And SKIPS FCM push (no error thrown)
  And returns 201 Created
```

---

### FR-008: Update Proposal (Professional Owner Only)

**Description:**  
A professional MUST be able to update their own pending proposal (price, description, scheduled date/time). This allows re-negotiation in chat. System MUST send notification to client when proposal is updated.

**Requirements:**
- System MUST verify requester is proposal owner (professional)
- System MUST verify proposal status='pending'
- System MUST allow updating: price, description, scheduled_date, scheduled_time
- System MUST validate same rules as FR-007
- System MUST send FCM notification to post owner
- System MUST NOT allow updating if proposal is accepted/rejected/expired

**Scenarios:**

```gherkin
Scenario: Successful proposal update
  Given the professional "carlos@example.com" owns proposal ID 1
  And proposal status='pending'
  When the professional sends PATCH /api/proposals/1 with:
    { "price": 7500, "description": "Actualicé precio, incluye materiales" }
  Then the system validates price, description (success)
  And updates `proposals` table: price, description, updated_at
  And sends FCM notification to post owner:
    - title: "💬 Propuesta actualizada"
    - body: "Carlos Lopez actualizó su presupuesto: ARS $7,500"
  And returns 200 OK with updated proposal

Scenario: Attempt to update accepted proposal
  Given proposal ID 1 status='accepted'
  When the professional sends PATCH /api/proposals/1
  Then the system returns 400 Bad Request with:
    { "error": "Cannot update accepted proposal. Negotiate in chat." }

Scenario: Attempt to update rejected proposal
  Given proposal ID 1 status='rejected'
  When the professional sends PATCH /api/proposals/1
  Then the system returns 400 Bad Request with:
    { "error": "Cannot update rejected proposal" }

Scenario: Non-owner attempts to update proposal
  Given the professional "pedro@example.com" does NOT own proposal ID 1
  When pedro sends PATCH /api/proposals/1
  Then the system returns 403 Forbidden
```

---

### FR-009: Accept Proposal (Client Post Owner Only)

**Description:**  
A client MUST be able to accept a pending proposal. The system MUST atomically: (1) mark proposal as accepted, (2) close the post, (3) reject all other pending proposals, (4) send notifications to all involved professionals.

**Requirements:**
- System MUST verify requester is post owner
- System MUST verify proposal status='pending'
- System MUST verify post status='open'
- System MUST use database transaction (atomic operation)
- System MUST prevent race conditions (row-level locks)
- System MUST set proposal.status='accepted'
- System MUST set post.status='closed'
- System MUST set all other proposals for same post to status='rejected'
- System MUST send FCM notification to accepted professional
- System MUST send FCM notifications to rejected professionals
- System MUST create in-app notifications for all

**Scenarios:**

```gherkin
Scenario: Successful proposal acceptance
  Given the client "juan@example.com" owns post ID 1
  And post has 3 proposals:
    - Proposal 1 (professional A): status='pending'
    - Proposal 2 (professional B): status='pending'
    - Proposal 3 (professional C): status='rejected' (already rejected before)
  When the client sends POST /api/proposals/1/accept
  Then the system executes transaction:
    1. Lock post row (SELECT ... FOR UPDATE)
    2. Verify post.status='open' (prevent double-accept)
    3. UPDATE proposals SET status='accepted' WHERE id=1
    4. UPDATE posts SET status='closed' WHERE id=1
    5. UPDATE proposals SET status='rejected' WHERE post_id=1 AND id!=1 AND status='pending'
    6. COMMIT
  And sends FCM to professional A:
    - title: "✅ Propuesta aceptada"
    - body: "Juan Perez aceptó tu presupuesto de ARS $5,000"
  And sends FCM to professional B:
    - title: "❌ Propuesta rechazada"
    - body: "El cliente aceptó otra propuesta para este trabajo"
  And creates 3 in-app notifications (1 acceptance, 2 rejections)
  And returns 200 OK with:
    {
      "proposal": {
        "id": 1,
        "status": "accepted",
        "post": { "id": 1, "status": "closed" }
      },
      "chat_id": 5,  // existing chat ID for client + professional A
      "rejected_proposals": 1  // count of auto-rejected proposals
    }

Scenario: Race condition - two clients accept simultaneously (prevented)
  Given two clients try to accept different proposals for same post at exact same time
  When both send POST /api/proposals/{different_ids}/accept
  Then the first transaction acquires row-level lock on post
  And second transaction waits for lock
  And first transaction commits (post status='closed')
  And second transaction reads post.status='closed', aborts
  And second client receives 409 Conflict:
    { "error": "Post is already closed" }

Scenario: Accept already accepted proposal (idempotent check)
  Given proposal ID 1 status='accepted'
  When the client sends POST /api/proposals/1/accept again
  Then the system returns 400 Bad Request with:
    { "error": "Proposal already accepted" }

Scenario: Non-owner attempts to accept proposal
  Given the client "maria@example.com" does NOT own post ID 1
  When maria sends POST /api/proposals/1/accept
  Then the system returns 403 Forbidden with:
    { "error": "Only post owner can accept proposals" }

Scenario: Accept proposal for closed post
  Given post ID 1 status='closed' (another proposal already accepted)
  When the client sends POST /api/proposals/2/accept
  Then the system returns 400 Bad Request with:
    { "error": "Post is already closed" }
```

---

### FR-010: Reject Proposal (Client Post Owner Only)

**Description:**  
A client MUST be able to explicitly reject a pending proposal. This sets proposal.status='rejected' and sends notification to professional.

**Requirements:**
- System MUST verify requester is post owner
- System MUST verify proposal status='pending'
- System MUST set status='rejected'
- System MUST send FCM notification to professional
- System MUST NOT close post (other proposals still active)

**Scenarios:**

```gherkin
Scenario: Successful proposal rejection
  Given the client "juan@example.com" owns post ID 1
  And proposal ID 2 status='pending'
  When the client sends POST /api/proposals/2/reject
  Then the system updates `proposals` SET status='rejected' WHERE id=2
  And sends FCM to professional:
    - title: "❌ Propuesta rechazada"
    - body: "El cliente rechazó tu presupuesto"
  And creates in-app notification
  And returns 200 OK with:
    { "proposal": { "id": 2, "status": "rejected" } }

Scenario: Reject already rejected proposal (idempotent)
  Given proposal ID 2 status='rejected'
  When the client sends POST /api/proposals/2/reject
  Then the system returns 200 OK (no changes)

Scenario: Reject accepted proposal (cannot undo acceptance)
  Given proposal ID 1 status='accepted'
  When the client sends POST /api/proposals/1/reject
  Then the system returns 400 Bad Request with:
    { "error": "Cannot reject accepted proposal. Contact support to cancel job." }
```

---

### FR-011: Get Post Proposals (Client Post Owner Only)

**Description:**  
A client MUST be able to view all proposals received for their own post, including professional details, sorted by created_at DESC.

**Requirements:**
- System MUST verify requester is post owner
- System MUST return all proposals for post (all statuses)
- System MUST include professional profile (name, photo, rating, years_experience)
- System MUST sort by created_at DESC (newest first)
- System MUST NOT be paginated (assume <50 proposals per post in MVP)

**Scenarios:**

```gherkin
Scenario: Client views proposals for own post
  Given the client "juan@example.com" owns post ID 1
  And post has 3 proposals:
    - Proposal 1: professional A, status='accepted', price=5000
    - Proposal 2: professional B, status='rejected', price=4500
    - Proposal 3: professional C, status='pending', price=6000
  When the client sends GET /api/posts/1/proposals
  Then the system returns 200 OK with:
    [
      {
        "id": 3,
        "professional": {
          "id": 5,
          "full_name": "Pedro Martinez",
          "profile_photo_url": "...",
          "rating": 4.2,
          "rating_count": 8,
          "years_experience": 3
        },
        "price": 6000,
        "description": "...",
        "scheduled_date": "2026-03-25",
        "scheduled_time": "14:00",
        "status": "pending",
        "expires_at": "...",
        "created_at": "2026-03-22T14:00:00Z"
      },
      { "id": 1, "status": "accepted", ... },
      { "id": 2, "status": "rejected", ... }
    ]

Scenario: Non-owner attempts to view proposals
  Given the client "maria@example.com" does NOT own post ID 1
  When maria sends GET /api/posts/1/proposals
  Then the system returns 403 Forbidden with:
    { "error": "Only post owner can view proposals" }

Scenario: Post with no proposals
  Given post ID 5 has 0 proposals
  When the owner sends GET /api/posts/5/proposals
  Then the system returns 200 OK with: []
```

---

### FR-012: Get Professional's Own Proposals (History)

**Description:**  
A professional MUST be able to view a paginated list of all proposals they've sent, including post details, sorted by created_at DESC.

**Requirements:**
- System MUST filter proposals WHERE professional_id=<prof_id>
- System MUST include all statuses: pending, accepted, rejected, expired, cancelled
- System MUST include post snippet (title, status, client name)
- System MUST use cursor-based pagination (limit 20)
- System MUST sort by created_at DESC

**Scenarios:**

```gherkin
Scenario: Professional views proposal history
  Given the professional "carlos@example.com" has sent 25 proposals:
    - 5 pending
    - 10 accepted
    - 8 rejected
    - 2 expired
  When the professional sends GET /api/proposals/me?limit=20
  Then the system returns 200 OK with:
    {
      "proposals": [
        {
          "id": 25,
          "post": {
            "id": 12,
            "title": "Instalación toma corriente",
            "status": "closed",
            "client": { "full_name": "Juan Perez" }
          },
          "price": 5000,
          "status": "accepted",
          "scheduled_date": "2026-03-25",
          "created_at": "2026-03-22T12:00:00Z"
        },
        // ... 19 more proposals
      ],
      "nextCursor": {...},
      "hasMore": true
    }
```

---

### FR-013: Push Notifications (FCM + In-App Table)

**Description:**  
The system MUST send push notifications (FCM) for critical events and store them in the `notifications` table for in-app history. Users can view, mark as read, and clear notifications.

**Requirements:**
- System MUST send FCM for events: new_proposal, proposal_accepted, proposal_rejected, post_expiring, proposal_expiring
- System MUST create record in `notifications` table for all events
- System MUST NOT fail operations if FCM fails (silent failure)
- System MUST support GET /api/notifications (paginated, unread first)
- System MUST support PATCH /api/notifications/:id/read
- System MUST support PATCH /api/notifications/read-all

**Scenarios:**

```gherkin
Scenario: Send new proposal notification
  Given professional sends proposal to post ID 1
  And post owner has fcm_token='valid_token'
  When proposal is created
  Then the system sends FCM push:
    {
      "token": "valid_token",
      "notification": {
        "title": "🎉 Nueva propuesta",
        "body": "Carlos Lopez envió presupuesto: ARS $5,000"
      },
      "data": {
        "type": "new_proposal",
        "proposalId": "1",
        "postId": "1"
      }
    }
  And creates notification in DB:
    {
      "user_id": <post_owner_id>,
      "type": "new_proposal",
      "title": "🎉 Nueva propuesta",
      "body": "...",
      "data": { proposalId: 1, postId: 1 },
      "read": false,
      "sent_at": NOW()
    }

Scenario: FCM fails silently (user uninstalled app)
  Given post owner has fcm_token='invalid_token' (user uninstalled app)
  When proposal is created
  Then FCM send fails (token not registered)
  And system logs error but does NOT throw exception
  And creates in-app notification normally
  And returns 201 Created for proposal

Scenario: User views unread notifications
  Given the user has 10 notifications: 4 unread, 6 read
  When the user sends GET /api/notifications?limit=20
  Then the system returns 200 OK with:
    {
      "notifications": [
        { "id": 10, "type": "new_proposal", "title": "...", "read": false, "sent_at": "..." },
        { "id": 9, "type": "proposal_accepted", "title": "...", "read": false, "sent_at": "..." },
        // ... 4 unread first, then 6 read
      ],
      "unread_count": 4
    }

Scenario: Mark notification as read
  Given notification ID 10 has read=false
  When the user sends PATCH /api/notifications/10/read
  Then the system updates `notifications` SET read=true WHERE id=10
  And returns 200 OK

Scenario: Mark all notifications as read
  Given the user has 10 unread notifications
  When the user sends PATCH /api/notifications/read-all
  Then the system updates `notifications` SET read=true WHERE user_id=<user_id> AND read=false
  And returns 200 OK with: { "updated_count": 10 }
```

---

### FR-014: Cronjob - Expire Posts and Proposals (48 hours)

**Description:**  
The system MUST run a cronjob every 1 hour to mark posts and proposals as expired if expires_at < NOW() and status is still open/pending.

**Requirements:**
- System MUST run cron every 1 hour (0 * * * *)
- System MUST update posts WHERE status='open' AND expires_at < NOW()
- System MUST update proposals WHERE status='pending' AND expires_at < NOW()
- System MUST send notifications 24 hours BEFORE expiration (warning)
- System MUST log expired counts

**Scenarios:**

```gherkin
Scenario: Cronjob expires posts
  Given current time is 2026-03-24 12:00:00
  And database has:
    - Post 1: status='open', expires_at='2026-03-24 11:00:00' (expired 1h ago)
    - Post 2: status='open', expires_at='2026-03-24 13:00:00' (expires in 1h, NOT expired)
    - Post 3: status='closed', expires_at='2026-03-24 11:00:00' (already closed, ignore)
  When cronjob executes at 12:00:00
  Then the system updates:
    UPDATE posts SET status='expired' WHERE status='open' AND expires_at < '2026-03-24 12:00:00'
  And marks Post 1 as expired (Post 2 and 3 unchanged)
  And logs: "Expired 1 posts"

Scenario: Cronjob expires proposals
  Given current time is 2026-03-24 12:00:00
  And database has 3 proposals:
    - Proposal 1: status='pending', expires_at='2026-03-24 11:30:00' (expired)
    - Proposal 2: status='pending', expires_at='2026-03-24 13:00:00' (not expired)
    - Proposal 3: status='accepted', expires_at='2026-03-24 11:00:00' (ignore, already processed)
  When cronjob executes
  Then the system updates:
    UPDATE proposals SET status='expired' WHERE status='pending' AND expires_at < NOW()
  And marks Proposal 1 as expired
  And logs: "Expired 1 proposals"

Scenario: Cronjob sends expiration warning (24h before)
  Given current time is 2026-03-23 12:00:00
  And Post 1 expires_at='2026-03-24 12:30:00' (in 24.5 hours)
  And last warning sent_at=NULL
  When cronjob executes
  Then the system sends FCM to post owner:
    - title: "⏰ Post por expirar"
    - body: "Tu publicación 'Fuga de agua' expira en 24 horas"
  And updates post.last_warning_sent_at=NOW() (prevent duplicate warnings)

Scenario: Cronjob handles no expired items gracefully
  Given no posts or proposals are expired
  When cronjob executes
  Then the system logs: "Expired 0 posts, 0 proposals"
  And exits successfully (no errors)
```

---

### FR-015: Cronjob - Soft Delete Old Posts (90 days)

**Description:**  
The system MUST run a daily cronjob to soft-delete posts that have been closed or expired for >90 days. A weekly cronjob MUST hard-delete posts soft-deleted for >180 days.

**Requirements:**
- System MUST run daily cron at 3am (0 3 * * *)
- System MUST soft-delete: UPDATE posts SET deleted_at=NOW() WHERE status IN ('closed','expired') AND updated_at < NOW() - 90 days
- System MUST run weekly cron at 4am Sundays (0 4 * * 0)
- System MUST hard-delete: DELETE FROM posts WHERE deleted_at < NOW() - 180 days (cascade to post_media, post_categories, proposals)

**Scenarios:**

```gherkin
Scenario: Daily cronjob soft-deletes old posts
  Given current time is 2026-03-22 03:00:00
  And database has:
    - Post 1: status='closed', updated_at='2025-12-01' (111 days ago, >90)
    - Post 2: status='expired', updated_at='2026-01-01' (80 days ago, <90)
    - Post 3: status='open', updated_at='2025-11-01' (ignore, still open)
  When daily cronjob executes
  Then the system updates:
    UPDATE posts SET deleted_at='2026-03-22 03:00:00'
    WHERE status IN ('closed', 'expired')
    AND updated_at < '2025-12-22' (90 days ago)
    AND deleted_at IS NULL
  And marks Post 1 as soft-deleted (Post 2 and 3 unchanged)
  And logs: "Soft deleted 1 old posts"

Scenario: Weekly cronjob hard-deletes very old posts
  Given current time is 2026-03-23 04:00:00 (Sunday)
  And database has:
    - Post 1: deleted_at='2025-08-01' (234 days ago, >180)
    - Post 2: deleted_at='2025-12-01' (111 days ago, <180)
  When weekly cronjob executes
  Then the system deletes:
    DELETE FROM posts WHERE deleted_at < '2025-09-23' (180 days ago)
  And hard-deletes Post 1 (cascade to post_media, post_categories, proposals)
  And logs: "Hard deleted 1 posts"
```

---

### FR-016: Chat Auto-Creation on Proposal Send

**Description:**  
When a professional sends a proposal, the system MUST automatically create or update a chat record linking client and professional. This prepares for Fase 3 (chat messages).

**Requirements:**
- System MUST upsert chat WHERE client_id=<post_owner_id> AND professional_id=<professional_user_id>
- System MUST set last_message_at=NOW() (simulate activity)
- System MUST use unique constraint to prevent duplicates
- System MUST NOT create actual messages (Fase 3)

**Scenarios:**

```gherkin
Scenario: Chat created on first proposal
  Given the professional "carlos@example.com" sends first proposal to post owned by "juan@example.com"
  And no chat exists between carlos and juan
  When proposal is created
  Then the system upserts chat:
    INSERT INTO chats (client_id, professional_id, last_message_at)
    VALUES (<juan_id>, <carlos_user_id>, NOW())
    ON CONFLICT (client_id, professional_id) DO UPDATE SET last_message_at=NOW()
  And creates new chat record with id=1

Scenario: Chat updated on second proposal (same client-professional pair)
  Given the professional "carlos@example.com" already has chat with "juan@example.com"
  And carlos sends proposal to another post owned by juan
  When proposal is created
  Then the system updates existing chat:
    UPDATE chats SET last_message_at=NOW()
    WHERE client_id=<juan_id> AND professional_id=<carlos_user_id>
  And does NOT create duplicate chat
```

---

## 3. Non-Functional Requirements

### NFR-001: Performance

| Endpoint | p50 Latency | p95 Latency | p99 Latency | Max Acceptable |
|----------|-------------|-------------|-------------|----------------|
| POST /api/posts (no media) | <500ms | <1s | <2s | 3s |
| POST /api/posts (with 5 images) | <4s | <7s | <10s | 15s |
| POST /api/posts (with 2 videos) | <8s | <15s | <25s | 30s |
| GET /api/posts (feed, 20 items) | <200ms | <400ms | <700ms | 1s |
| GET /api/posts/:id | <100ms | <200ms | <500ms | 1s |
| POST /api/proposals | <300ms | <600ms | <1s | 2s |
| POST /api/proposals/:id/accept | <400ms | <800ms | <1.5s | 3s |
| GET /api/notifications | <150ms | <300ms | <600ms | 1s |

- PostGIS geo-queries (30km, 10K posts) MUST execute <200ms
- Cloudinary image upload (5MB) MUST complete <3s
- Cloudinary video upload (30MB) MUST complete <15s (timeout 30s)
- Cronjob expiration query (1K posts) MUST execute <500ms

### NFR-002: Security

- Post media URLs MUST be signed Cloudinary URLs (prevent hotlinking)
- Exact post location MUST be visible only to owner or accepted professional
- Rate limit: Max 10 posts per client per 24 hours (prevent spam)
- Rate limit: Max 20 proposals per professional per 24 hours
- All proposal price changes MUST be logged (audit trail for disputes)
- HTTPS MUST be enforced in production
- CORS MUST whitelist only mobile app origins
- JWT access token MUST be validated on all authenticated endpoints

### NFR-003: Availability

- System uptime SHOULD maintain 99.5% (target SLA)
- Cloudinary downtime MUST NOT block post creation (503 error, retry later)
- FCM downtime MUST NOT block proposal creation (silent failure, in-app notification created)
- Database backups MUST run daily (automated via Railway/Render)
- Cronjobs MUST have monitoring alerts (if not executed in 2 hours)

### NFR-004: Scalability

- System SHOULD handle 500 concurrent users (MVP target)
- Database SHOULD support 50,000 posts initially
- PostGIS queries SHOULD scale to 100,000 posts with <300ms latency
- Cloudinary free tier (25GB bandwidth) SHOULD support ~500 posts with video (avg 40MB per post with media)
- Proposal accept transaction MUST handle 10 concurrent requests without race conditions

### NFR-005: Observability

- All API errors MUST log to console with:
  - Timestamp, endpoint, user ID, error message + stack trace
- Media upload failures MUST log file size, type, Cloudinary error
- Cronjob executions MUST log: start time, expired counts, duration
- Proposal accept race conditions MUST log: post ID, conflicting user IDs
- FCM push failures MUST log: user ID, token, error code
- Performance metrics SHOULD log: feed query time, geo query time

---

## 4. API Contract

### POST /api/posts

**Description:** Create new post with optional media upload

**Request:**
```typescript
// Headers
Authorization: Bearer <access_token>
Content-Type: multipart/form-data

// Form fields
title: string;                // required, 10-100 chars
description: string;          // required, 20-500 chars
category_ids: number[];       // required, 1-3 category IDs (JSON array as string)
use_profile_location: boolean; // required, true = use user's profile location
custom_address?: string;      // optional, required if use_profile_location=false
media?: File[];               // optional, max 5 images + 2 videos
```

**Response 201 Created:**
```typescript
{
  id: number;
  title: string;
  description: string;
  status: "open";
  latitude: number;
  longitude: number;
  expires_at: string;  // ISO 8601, NOW() + 48 hours
  categories: Array<{ id: number; name: string; icon: string }>;
  media: Array<{
    id: number;
    media_type: "image" | "video";
    media_url: string;  // Cloudinary URL
  }>;
  created_at: string;
}
```

**Response 400 Bad Request:**
```typescript
{
  error: "Validation failed" | "Maximum 5 images allowed" | "Maximum 2 videos allowed" | "Invalid category ID: {id}";
}
```

**Response 413 Payload Too Large:**
```typescript
{
  error: "Video exceeds 50MB limit" | "Image exceeds 5MB limit";
}
```

**Response 429 Too Many Requests:**
```typescript
{
  error: "Daily post limit reached. Maximum 10 posts per day.";
}
```

**Response 504 Gateway Timeout:**
```typescript
{
  error: "Video upload timeout. Please use a shorter video (<15 seconds) or compress to <30MB.";
}
```

---

### GET /api/posts

**Description:** Get professional feed (geo-filtered, paginated)

**Request:**
```typescript
// Headers
Authorization: Bearer <access_token>  // required (professional only)

// Query params
limit?: number;          // optional, default 20, max 50
cursor?: string;         // optional, JSON object: {"createdAt":"2026-03-22T10:00:00Z","id":42}
```

**Response 200 OK:**
```typescript
{
  posts: Array<{
    id: number;
    title: string;
    description: string;
    status: "open";
    latitude: number;      // truncated to 2 decimals
    longitude: number;     // truncated to 2 decimals
    distance_km: number;   // distance from professional's location
    categories: Array<{ id: number; name: string; icon: string }>;
    media: Array<{ media_type: string; media_url: string }>;
    expires_at: string;
    created_at: string;
  }>;
  nextCursor: { createdAt: string; id: number } | null;
  hasMore: boolean;
}
```

**Response 403 Forbidden:**
```typescript
{
  error: "Only professionals can view the feed";
}
```

---

### GET /api/posts/:id

**Description:** Get post detail

**Request:**
```typescript
// Headers
Authorization: Bearer <access_token>

// URL params
id: number  // post ID
```

**Response 200 OK:**
```typescript
{
  id: number;
  title: string;
  description: string;
  status: "open" | "closed" | "expired" | "completed";
  latitude: number;   // exact if owner/accepted professional, truncated otherwise
  longitude: number;
  categories: Array<{ id: number; name: string; icon: string }>;
  media: Array<{ id: number; media_type: string; media_url: string }>;
  proposals_count?: number;  // only shown to post owner
  expires_at: string;
  created_at: string;
  owner: boolean;  // true if requester is post owner
}
```

**Response 404 Not Found:**
```typescript
{
  error: "Post not found";
}
```

---

### PATCH /api/posts/:id

**Description:** Update post (owner only, 0 proposals required)

**Request:**
```typescript
// Headers
Authorization: Bearer <access_token>
Content-Type: application/json

// Body (all fields optional)
{
  title?: string;           // 10-100 chars
  description?: string;     // 20-500 chars
  category_ids?: number[];  // 1-3 IDs
}
```

**Response 200 OK:**
```typescript
// Same structure as GET /api/posts/:id
```

**Response 400 Bad Request:**
```typescript
{
  error: "Cannot edit post with existing proposals. Close this post and create a new one." 
    | "Cannot edit closed post"
    | "Validation failed";
}
```

**Response 403 Forbidden:**
```typescript
{
  error: "You can only edit your own posts";
}
```

---

### DELETE /api/posts/:id

**Description:** Close post manually (owner only)

**Request:**
```typescript
// Headers
Authorization: Bearer <access_token>
```

**Response 200 OK:**
```typescript
{
  message: "Post closed successfully";
  rejected_proposals: number;  // count of auto-rejected proposals
}
```

**Response 403 Forbidden:**
```typescript
{
  error: "You can only close your own posts";
}
```

---

### GET /api/posts/me

**Description:** Get client's own posts (history)

**Request:**
```typescript
// Headers
Authorization: Bearer <access_token>

// Query params
limit?: number;     // default 20
cursor?: string;    // pagination cursor
```

**Response 200 OK:**
```typescript
{
  posts: Array<{
    id: number;
    title: string;
    status: "open" | "closed" | "expired" | "completed";
    proposals_count: number;
    expires_at: string;
    created_at: string;
  }>;
  nextCursor: { createdAt: string; id: number } | null;
  hasMore: boolean;
}
```

---

### POST /api/proposals

**Description:** Create proposal (professional only)

**Request:**
```typescript
// Headers
Authorization: Bearer <access_token>
Content-Type: application/json

// Body
{
  post_id: number;           // required
  price: number;             // required, 500-100000
  description: string;       // required, 10-300 chars
  scheduled_date: string;    // required, ISO date, >2 hours from now
  scheduled_time: string;    // required, HH:MM format
}
```

**Response 201 Created:**
```typescript
{
  id: number;
  post_id: number;
  professional: {
    id: number;
    full_name: string;
    profile_photo_url: string;
    rating: number;
    rating_count: number;
    years_experience: number;
  };
  price: number;
  description: string;
  scheduled_date: string;
  scheduled_time: string;
  status: "pending";
  expires_at: string;  // NOW() + 48 hours
  created_at: string;
}
```

**Response 400 Bad Request:**
```typescript
{
  error: "Post has expired" 
    | "Post is closed" 
    | "Price must be between ARS 500 and ARS 100,000"
    | "Scheduled date must be at least 2 hours in the future"
    | "Validation failed";
}
```

**Response 403 Forbidden:**
```typescript
{
  error: "Only professionals can send proposals";
}
```

**Response 409 Conflict:**
```typescript
{
  error: "You already sent a proposal to this post. Edit it in the chat.";
}
```

---

### PATCH /api/proposals/:id

**Description:** Update proposal (professional owner only, pending only)

**Request:**
```typescript
// Headers
Authorization: Bearer <access_token>
Content-Type: application/json

// Body (all fields optional)
{
  price?: number;           // 500-100000
  description?: string;     // 10-300 chars
  scheduled_date?: string;  // ISO date, future
  scheduled_time?: string;  // HH:MM
}
```

**Response 200 OK:**
```typescript
// Same structure as POST /api/proposals response
```

**Response 400 Bad Request:**
```typescript
{
  error: "Cannot update accepted proposal. Negotiate in chat." 
    | "Cannot update rejected proposal"
    | "Validation failed";
}
```

**Response 403 Forbidden:**
```typescript
{
  error: "You can only edit your own proposals";
}
```

---

### POST /api/proposals/:id/accept

**Description:** Accept proposal (client post owner only)

**Request:**
```typescript
// Headers
Authorization: Bearer <access_token>
```

**Response 200 OK:**
```typescript
{
  proposal: {
    id: number;
    status: "accepted";
    post: { id: number; status: "closed" };
  };
  chat_id: number;          // chat ID for client + professional
  rejected_proposals: number;  // count of other proposals auto-rejected
}
```

**Response 400 Bad Request:**
```typescript
{
  error: "Proposal already accepted" 
    | "Post is already closed";
}
```

**Response 403 Forbidden:**
```typescript
{
  error: "Only post owner can accept proposals";
}
```

**Response 409 Conflict:**
```typescript
{
  error: "Post is already closed";  // race condition prevented
}
```

---

### POST /api/proposals/:id/reject

**Description:** Reject proposal (client post owner only)

**Request:**
```typescript
// Headers
Authorization: Bearer <access_token>
```

**Response 200 OK:**
```typescript
{
  proposal: { id: number; status: "rejected" };
}
```

**Response 400 Bad Request:**
```typescript
{
  error: "Cannot reject accepted proposal. Contact support to cancel job.";
}
```

**Response 403 Forbidden:**
```typescript
{
  error: "Only post owner can reject proposals";
}
```

---

### GET /api/posts/:postId/proposals

**Description:** Get all proposals for post (client post owner only)

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
    professional: {
      id: number;
      full_name: string;
      profile_photo_url: string;
      rating: number;
      rating_count: number;
      years_experience: number;
    };
    price: number;
    description: string;
    scheduled_date: string;
    scheduled_time: string;
    status: "pending" | "accepted" | "rejected" | "expired" | "cancelled";
    expires_at: string;
    created_at: string;
  },
  // ... all proposals, sorted by created_at DESC
]
```

**Response 403 Forbidden:**
```typescript
{
  error: "Only post owner can view proposals";
}
```

---

### GET /api/proposals/me

**Description:** Get professional's own proposals (history)

**Request:**
```typescript
// Headers
Authorization: Bearer <access_token>

// Query params
limit?: number;     // default 20
cursor?: string;    // pagination cursor
```

**Response 200 OK:**
```typescript
{
  proposals: Array<{
    id: number;
    post: {
      id: number;
      title: string;
      status: "open" | "closed" | "expired";
      client: { full_name: string; profile_photo_url: string };
    };
    price: number;
    status: "pending" | "accepted" | "rejected" | "expired";
    scheduled_date: string;
    created_at: string;
  }>;
  nextCursor: { createdAt: string; id: number } | null;
  hasMore: boolean;
}
```

---

### GET /api/notifications

**Description:** Get user's notifications (unread first)

**Request:**
```typescript
// Headers
Authorization: Bearer <access_token>

// Query params
limit?: number;  // default 20, max 50
```

**Response 200 OK:**
```typescript
{
  notifications: Array<{
    id: number;
    type: "new_proposal" | "proposal_accepted" | "proposal_rejected" | "post_expiring" | "proposal_expiring";
    title: string;
    body: string;
    data: Record<string, any>;  // { proposalId, postId, ... }
    read: boolean;
    sent_at: string;  // ISO 8601
  }>;
  unread_count: number;
}
```

---

### PATCH /api/notifications/:id/read

**Description:** Mark notification as read

**Request:**
```typescript
// Headers
Authorization: Bearer <access_token>
```

**Response 200 OK:**
```typescript
{
  message: "Notification marked as read";
}
```

---

### PATCH /api/notifications/read-all

**Description:** Mark all notifications as read

**Request:**
```typescript
// Headers
Authorization: Bearer <access_token>
```

**Response 200 OK:**
```typescript
{
  message: "All notifications marked as read";
  updated_count: number;
}
```

---

## 5. Validation Rules

| Field | Type | Required | Validation | Error Message |
|-------|------|----------|------------|---------------|
| title | string | Yes | 10-100 characters | "Title must be 10-100 characters" |
| description | string | Yes | 20-500 characters | "Description must be 20-500 characters" |
| category_ids | array | Yes | Length 1-3, all IDs exist | "Must select 1-3 valid categories" |
| custom_address | string | Conditional | Min 10 chars (if use_profile_location=false) | "Address must be at least 10 characters" |
| media (images) | file[] | No | MIME: image/jpeg, image/png, image/webp; Max 5 files; Max 5MB each | "Maximum 5 images allowed. Each image max 5MB." |
| media (videos) | file[] | No | MIME: video/mp4, video/quicktime; Max 2 files; Max 50MB each | "Maximum 2 videos allowed. Each video max 50MB." |
| price | number | Yes | 500 ≤ price ≤ 100000 | "Price must be between ARS 500 and ARS 100,000" |
| scheduled_date | string | Yes | ISO date, >2 hours from now | "Scheduled date must be at least 2 hours in the future" |
| scheduled_time | string | Yes | Regex: /^\d{2}:\d{2}$/ | "Time must be in HH:MM format (e.g., 14:30)" |

---

## 6. Error Handling

### HTTP Status Codes

| Code | Meaning | When to Use |
|------|---------|-------------|
| **200 OK** | Success | GET, PATCH, DELETE successful |
| **201 Created** | Resource created | POST /posts, POST /proposals |
| **400 Bad Request** | Validation error | Invalid input, business rule violation |
| **401 Unauthorized** | Authentication failed | Invalid/missing JWT |
| **403 Forbidden** | Authorization failed | Client trying professional endpoint, non-owner editing post |
| **404 Not Found** | Resource doesn't exist | GET /posts/999, soft-deleted post |
| **409 Conflict** | Duplicate resource | Professional already sent proposal to post |
| **413 Payload Too Large** | File too large | Video >50MB, image >5MB |
| **429 Too Many Requests** | Rate limit exceeded | >10 posts/day, >20 proposals/day |
| **500 Internal Server Error** | Unhandled exception | Database connection failure |
| **503 Service Unavailable** | External service down | Cloudinary unavailable |
| **504 Gateway Timeout** | External service timeout | Cloudinary upload >30s |

### Error Response Format

```typescript
{
  error: string;              // Human-readable error message
  details?: Array<{           // Optional validation details
    field: string;
    message: string;
  }>;
  code?: string;              // Optional error code
}
```

### Prisma Error Mapping

| Prisma Error | HTTP Status | Client Message |
|--------------|-------------|----------------|
| `P2002` (Unique constraint - professional_id, post_id) | 409 Conflict | "You already sent a proposal to this post" |
| `P2025` (Record not found) | 404 Not Found | "Post not found" / "Proposal not found" |
| `P2003` (Foreign key constraint - invalid category_id) | 400 Bad Request | "Invalid category ID: {id}" |
| Connection timeout | 503 Service Unavailable | "Database temporarily unavailable" |

---

## 7. Security Requirements

### Post Media Security
- Cloudinary URLs MUST be signed to prevent hotlinking
- Media upload MUST validate MIME type server-side (don't trust client)
- Videos MUST be scanned for malware (Cloudinary feature enabled)
- Media folders MUST be organized: `quickfixu/posts/{postId}/` (prevent enumeration)

### Location Privacy
- Truncate lat/lng to 2 decimals (±1km precision) for non-owners viewing feed
- Exact coordinates visible ONLY to post owner OR professional with accepted proposal
- PostGIS location field MUST NOT be exposed in API responses (only lat/lng)

### Authorization Model
- `requireClient` middleware: Only clients can create posts
- `requireProfessional` middleware: Only professionals can view feed, send proposals
- `requirePostOwnership` middleware: Only post owner can edit, close, view proposals, accept/reject
- `requireProposalOwnership` middleware: Only proposal owner (professional) can update

### Rate Limiting
- **Posts:** Max 10 per client per 24 hours (key: `post:create:{userId}`)
- **Proposals:** Max 20 per professional per 24 hours (key: `proposal:create:{userId}`)
- **Feed:** Max 100 requests per professional per hour (prevent scraping)
- **Notifications:** Max 50 requests per user per hour

### Transaction Isolation
- Proposal accept MUST use `SERIALIZABLE` isolation level (prevent race conditions)
- Database row locks (SELECT ... FOR UPDATE) on post during accept
- Retry logic: If transaction fails due to serialization error, retry once

---

## 8. Performance Targets

### Latency Targets (by percentile)

| Endpoint | p50 | p95 | p99 | Max Acceptable |
|----------|-----|-----|-----|----------------|
| POST /api/posts (no media) | <500ms | <1s | <2s | 3s |
| POST /api/posts (5 images) | <4s | <7s | <10s | 15s |
| POST /api/posts (2 videos) | <8s | <15s | <25s | 30s |
| GET /api/posts (feed) | <200ms | <400ms | <700ms | 1s |
| GET /api/posts/:id | <100ms | <200ms | <500ms | 1s |
| POST /api/proposals | <300ms | <600ms | <1s | 2s |
| POST /api/proposals/:id/accept | <400ms | <800ms | <1.5s | 3s |

### Database Query Targets
- Feed query (PostGIS + categories join, 10K posts): <200ms
- Post detail query (includes media): <50ms
- Proposal accept transaction (with locks): <300ms
- Cronjob expiration query (1K posts): <500ms

### External Service Targets
- Cloudinary image upload (5MB): <3s
- Cloudinary video upload (30MB): <15s (timeout at 30s)
- FCM push send: <500ms

### Optimization Strategies

**Database indexes:**
```sql
-- PostGIS spatial index
CREATE INDEX idx_posts_location ON posts USING GIST(location);

-- Feed query optimization
CREATE INDEX idx_posts_status_expires_created 
  ON posts(status, expires_at, created_at DESC, id DESC) 
  WHERE deleted_at IS NULL;

-- Category filtering
CREATE INDEX idx_post_categories_category 
  ON post_categories(category_id, post_id);

-- Proposals queries
CREATE INDEX idx_proposals_post_status 
  ON proposals(post_id, status);
CREATE INDEX idx_proposals_professional_created 
  ON proposals(professional_id, created_at DESC);

-- Notifications
CREATE INDEX idx_notifications_user_read_sent 
  ON notifications(user_id, read, sent_at DESC);

-- Soft delete filter
CREATE INDEX idx_posts_deleted_at 
  ON posts(deleted_at) 
  WHERE deleted_at IS NULL;
```

**Caching:**
- Categories list: In-memory cache (invalidate on seed updates)
- Professional's own categories: Cache in JWT payload (refresh on category change)

**Connection pooling:**
- Prisma connection pool: min 5, max 30 connections (higher than Fase 1 due to more concurrent writes)

**Media optimization:**
- Resize images to max 1920px width before upload (reduce Cloudinary storage)
- Transcode videos to H.264 MP4 (Cloudinary eager transformation)
- Lazy-load media in feed (thumbnail URLs, full URLs on demand)

---

## 9. Dependencies

### External Services

| Service | Purpose | Endpoint | Credentials Required | SLA |
|---------|---------|----------|---------------------|-----|
| **Cloudinary** | Post media storage | `https://api.cloudinary.com/v1_1/{cloud}/upload` | Cloud name, API key, secret | 99.9% |
| **Firebase Cloud Messaging** | Push notifications | FCM API | Server key | 99.9% |
| **Nominatim** | Geocoding custom addresses | `https://nominatim.openstreetmap.org/search` | None (rate limit 1/sec) | No SLA |
| **Google Geocoding** | Geocoding fallback | `https://maps.googleapis.com/maps/api/geocode/json` | API key | 99.9% |

### Third-Party NPM Packages

| Package | Version | Purpose |
|---------|---------|---------|
| `multer` | ^1.4.5-lts.1 | Multipart/form-data parsing (media upload) |
| `sharp` | ^0.33.0 | Image resizing (already in Fase 1) |
| `node-cron` | ^3.0.3 | Cronjob scheduling |
| `cloudinary` | ^2.0.0 | Cloudinary SDK (already in Fase 1) |
| `firebase-admin` | ^12.0.0 | FCM SDK (already in Fase 1) |

### Internal Prerequisites

| Dependency | Source | Required For |
|------------|--------|--------------|
| Fase 1 users table | Fase 1 | Post ownership, proposal author |
| Fase 1 professionals table | Fase 1 | Proposal professional_id FK |
| Fase 1 categories table | Fase 1 | Post categories filtering |
| Fase 1 PostGIS setup | Fase 1 | Geo-queries on posts.location |
| Fase 1 Cloudinary config | Fase 1 | Media upload reuses service |
| Fase 1 FCM config | Fase 1 | Push notifications reuse service |
| Fase 1 JWT middleware | Fase 1 | All authenticated endpoints |

### Database Migrations

**New tables:**
- `posts`
- `post_categories`
- `post_media`
- `proposals`
- `chats`
- `notifications`

**Schema changes in existing tables:**
- `users`: Add relations to posts, chats, notifications (no column changes)
- `professionals`: Add relation to proposals (no column changes)
- `categories`: Add relation to post_categories (no column changes)

---

## 10. Assumptions & Constraints

### Assumptions
1. **MVP geography:** Only Argentina (geocoding, phone/DNI from Fase 1)
2. **Language:** Spanish-only error messages (i18n in Fase 3)
3. **Media moderation:** Manual review via admin panel (no auto-moderation in MVP)
4. **Chat implementation:** Fase 3 will add `messages` table + WebSockets (Fase 2 only creates chat records)
5. **Payment integration:** Fase 4 (proposals accepted in Fase 2 don't require payment yet)
6. **Dispute resolution:** Manual via support (no in-app dispute flow in MVP)
7. **Professional verification:** Certifications approved manually (no automated verification)

### Constraints
1. **Cloudinary free tier:** 25GB bandwidth/month (~500 posts with videos, monitoring required)
2. **FCM free tier:** Unlimited push messages (no constraint)
3. **PostGIS performance:** Tested up to 100K posts, re-index required beyond that
4. **Cronjob precision:** Expiration tolerance ±1 hour (not real-time)
5. **Rate limits:** 10 posts/day, 20 proposals/day (adjustable via config)
6. **Pagination:** Max 50 items per page (prevent abuse)
7. **Video upload timeout:** 30 seconds (Cloudinary limitation on free tier)
8. **Proposal edit:** Only `pending` status (cannot edit accepted/rejected)
9. **Post edit:** Only if 0 proposals (prevents invalidating existing proposals)
10. **Soft delete recovery:** 90-day window before hard delete (compliance)

---

## Document Status

**Version:** 1.0  
**Date:** March 22, 2026  
**Status:** Draft (pending review)  
**Approval required from:**
- [ ] Product Owner (scope + user stories)
- [ ] Tech Lead (architecture + performance targets)
- [ ] DevOps (Cloudinary quota + monitoring)
- [ ] Security (privacy + rate limits)
- [ ] Frontend Lead (API contract + error handling)

**Next steps:**
1. Review + approve this specification
2. Create technical design document (`sdd-design`)
3. Break down into tasks (`sdd-tasks`)
4. Begin implementation (`sdd-apply`)

---

**End of Specification Document**
