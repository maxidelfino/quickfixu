# Specification: Fase 5 - Reviews & Ratings

## 1. Introduction

This specification defines the functional and non-functional requirements for **Fase 5: Reviews & Ratings** of QuickFixU. It is derived from the approved exploration document and serves as the binding contract between backend and frontend teams.

**Change name:** `fase-5-reviews-ratings`  
**Persistence mode:** File-based (docs/phases/)  
**Prerequisite:** Fase 4 (Payments & Appointments) MUST be completed  
**Base proposal:** Bidirectional reviews, mutual rating system, time-window enforcement (30 days), dispute appeals for unfair reviews, moderation infrastructure

**Features in scope:**
1. Create Review Post-Completion (only after appointment completed + payment completed)
2. Rating Calculation Trigger (auto-update user.rating on INSERT)
3. Review Visualization in Professional Profile (pagination, filter by rating)
4. Rating Display in Search/Cards (average + count)
5. Reminder Notifications (day 3 and day 7 if no review)
6. Review Dispute System (preparation for Fase 6 admin resolution)
7. Moderation Infrastructure (report button, admin alerts)
8. 30-Day Time Window Enforcement (disable review button after deadline)

---

## 2. Functional Requirements

### FR-001: Create Review Post-Completion

**Description:**  
A user (client OR professional) MUST be able to leave a review for the other party ONLY if the appointment status is 'completed' AND payment status is 'completed'. The system MUST enforce a 30-day time window from scheduled_date, prevent duplicate reviews via UNIQUE constraint, and automatically update the reviewed user's average rating.

**Requirements:**
- System MUST validate appointment.status='completed' AND payment.status='completed'
- System MUST validate reviewer is either client_id OR professional_id of appointment
- System MUST calculate days since scheduled_date; reject if >30 days
- System MUST enforce UNIQUE constraint (appointment_id, reviewer_id)
- System MUST require rating (1-5 integer), comment is optional (max 500 chars)
- System MUST determine reviewed_id automatically (the other party in appointment)
- System MUST sanitize comment (escape HTML, prevent XSS)
- System MUST trigger update_user_rating() function to recalculate average
- System MUST send push notification to reviewed user
- System MUST complete operation in <1 second (p95)

**Scenarios:**

```gherkin
Scenario: Client leaves review for professional (happy path)
  Given appointment ID 10 exists with:
    - status: 'completed'
    - scheduled_date: '2026-03-15' (7 days ago, within 30-day window)
    - payment.status: 'completed'
    - payment.client_id: 1 (userId=1 is client)
    - payment.professional_id: 5
  And client userId=1 is authenticated
  And no review exists yet with (appointment_id=10, reviewer_id=1)
  When client sends POST /api/reviews with:
    {
      "appointmentId": 10,
      "rating": 5,
      "comment": "Excelente trabajo, llegó puntual y dejó todo limpio."
    }
  Then system validates appointment ownership (client is participant: YES)
  And validates appointment status='completed' (SUCCESS)
  And validates payment status='completed' (SUCCESS)
  And calculates days since completion: (2026-03-22 - 2026-03-15) = 7 days (<30, VALID)
  And determines reviewed_id=5 (professional, the other party)
  And sanitizes comment (escapes any HTML)
  And creates review:
    {
      "id": 1,
      "appointment_id": 10,
      "reviewer_id": 1,
      "reviewed_id": 5,
      "rating": 5,
      "comment": "Excelente trabajo...",
      "created_at": NOW()
    }
  And trigger update_user_rating() executes automatically (updates users.rating for userId=5)
  And sends push notification to professional (userId=5):
    {
      "title": "⭐ Nueva calificación",
      "body": "Recibiste 5 estrellas de juan@example.com",
      "data": { "type": "new_review", "reviewId": 1 }
    }
  And returns 201 Created with:
    {
      "reviewId": 1,
      "rating": 5,
      "comment": "Excelente trabajo...",
      "reviewedUser": {
        "id": 5,
        "fullName": "Carlos Pérez",
        "newRating": 4.8, // Updated average
        "ratingCount": 15 // Total reviews received
      }
    }

Scenario: Professional leaves review for client
  Given appointment ID 11 with client_id=2, professional_id=6
  When professional (userId=6) creates review with rating=4, comment="Cliente cordial, sitio limpio"
  Then system determines reviewed_id=2 (client)
  And creates review
  And updates client's rating (users.rating for userId=2)
  And sends push to client

Scenario: Duplicate review blocked (UNIQUE constraint)
  Given review already exists with (appointment_id=10, reviewer_id=1)
  When client userId=1 tries to create another review for same appointment
  Then system attempts INSERT
  And database UNIQUE constraint violation occurs (code 23505)
  And returns 409 Conflict with:
    { "error": "You already reviewed this appointment" }

Scenario: Review outside 30-day window
  Given appointment scheduled_date='2026-02-01' (50 days ago)
  And current date='2026-03-22'
  When client tries to create review
  Then system calculates days: (2026-03-22 - 2026-02-01) = 50 days (>30, INVALID)
  And returns 400 Bad Request with:
    { "error": "Review window expired (30 days after completion)" }

Scenario: Appointment not completed yet
  Given appointment status='scheduled' (work not done)
  When client tries to create review
  Then system validates status != 'completed' (FAIL)
  And returns 400 Bad Request with:
    { "error": "Can only review completed appointments" }

Scenario: Payment not completed yet
  Given appointment status='completed' but payment.status='pending'
  When client tries to create review
  Then system validates payment status != 'completed' (FAIL)
  And returns 400 Bad Request with:
    { "error": "Can only review after payment is completed" }

Scenario: Unauthorized user (not participant)
  Given appointment has client_id=1, professional_id=5
  When unrelated user userId=99 tries to create review
  Then system validates userId=99 not in (client_id, professional_id) (FAIL)
  And returns 403 Forbidden with:
    { "error": "Only appointment participants can leave reviews" }

Scenario: Invalid rating value
  Given valid completed appointment
  When client sends rating=6 (out of range 1-5)
  Then system validates rating NOT IN [1,2,3,4,5] (FAIL)
  And returns 400 Bad Request with:
    { "error": "Rating must be between 1 and 5" }
  
Scenario: Comment exceeds 500 characters
  Given comment length = 600 characters
  When client creates review
  Then system validates comment.length > 500 (FAIL)
  And returns 400 Bad Request with:
    { "error": "Comment must be 500 characters or less" }

Scenario: XSS prevention in comment
  Given comment contains: "Buen trabajo <script>alert('xss')</script>"
  When client submits review
  Then system sanitizes comment to: "Buen trabajo &lt;script&gt;alert('xss')&lt;/script&gt;"
  And stores sanitized version
  And frontend renders safely (no script execution)
```

---

### FR-002: Rating Calculation Trigger (Auto-update)

**Description:**  
When a review is created, a database trigger MUST automatically recalculate and update the reviewed user's average rating and total review count. This ensures real-time rating updates without manual cronjobs.

**Requirements:**
- System MUST execute SQL trigger AFTER INSERT ON reviews
- Trigger MUST calculate AVG(rating) for all reviews WHERE reviewed_id = NEW.reviewed_id
- Trigger MUST calculate COUNT(*) for total reviews
- Trigger MUST update users.rating (DECIMAL 3,2) and users.rating_count (INTEGER)
- Trigger MUST complete in <50ms (indexed query)
- System MUST handle new users (first review): rating NULL → rating value
- System MUST recalculate on review deletion (AFTER DELETE trigger for Fase 6)

**Scenarios:**

```gherkin
Scenario: First review received (rating NULL → 4.0)
  Given user ID 10 (new professional) has:
    - rating: NULL
    - rating_count: 0
  When first review is created with rating=4, reviewed_id=10
  Then trigger update_user_rating() fires
  And calculates: AVG(rating) = 4.0, COUNT(*) = 1
  And updates users:
    {
      "rating": 4.00,
      "rating_count": 1,
      "updated_at": NOW()
    }

Scenario: Second review updates average
  Given user ID 10 has rating=4.0 (1 review)
  When second review is created with rating=5, reviewed_id=10
  Then trigger calculates: AVG(4, 5) = 4.5, COUNT = 2
  And updates users:
    {
      "rating": 4.50,
      "rating_count": 2
    }

Scenario: Multiple reviews with varied ratings
  Given user ID 10 has 10 existing reviews: [5,5,5,4,4,4,4,3,3,2]
  And current rating=3.9 (calculated average)
  When 11th review created with rating=5
  Then trigger recalculates: AVG(5,5,5,5,4,4,4,4,3,3,2) = 4.0
  And updates rating=4.00, rating_count=11

Scenario: Trigger performance with 1000 reviews
  Given user ID 5 has 1000 existing reviews
  When new review inserted
  Then trigger query executes with INDEX on reviews.reviewed_id
  And AVG calculation completes in <50ms (p95)
  And transaction commits successfully

Scenario: Concurrent review inserts (same reviewed_id)
  Given two clients submit reviews for professional ID 10 simultaneously
  When both transactions INSERT review at same time
  Then database isolation prevents race condition
  And each trigger executes sequentially (row-level lock on users.id=10)
  And final rating reflects both reviews correctly
```

**SQL Trigger Implementation:**

```sql
CREATE OR REPLACE FUNCTION update_user_rating()
RETURNS TRIGGER AS $$
BEGIN
  -- Recalculate rating promedio del reviewed_id
  WITH rating_stats AS (
    SELECT 
      AVG(rating)::DECIMAL(3,2) AS avg_rating,
      COUNT(*) AS total_reviews
    FROM reviews
    WHERE reviewed_id = NEW.reviewed_id
  )
  UPDATE users
  SET 
    rating = rating_stats.avg_rating,
    rating_count = rating_stats.total_reviews,
    updated_at = NOW()
  FROM rating_stats
  WHERE id = NEW.reviewed_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_user_rating
AFTER INSERT ON reviews
FOR EACH ROW
EXECUTE FUNCTION update_user_rating();
```

---

### FR-003: Visualize Reviews in Profile

**Description:**  
The system MUST provide a public endpoint to fetch all reviews for a given user (professional). Reviews MUST be paginated (cursor-based), filterable by rating, and ordered by created_at DESC (most recent first). The system MUST also return rating distribution statistics.

**Requirements:**
- System MUST expose GET /api/users/:userId/reviews (public, no auth required)
- System MUST support cursor-based pagination: ?cursor={reviewId}&limit=20
- System MUST support rating filter: ?rating=5 (exact) or ?rating=1-2 (range)
- System MUST include reviewer details: full_name, profile_photo_url, rating given
- System MUST order by created_at DESC (most recent first)
- System MUST return rating distribution: { "5_stars": 65%, "4_stars": 20%, ... }
- System MUST handle no reviews case: return empty array + 0% distribution
- System MUST complete in <300ms (p95) for 1000 reviews

**Scenarios:**

```gherkin
Scenario: Fetch reviews with default pagination
  Given professional userId=5 has 50 reviews
  When client sends GET /api/users/5/reviews
  Then system queries reviews WHERE reviewed_id=5 ORDER BY created_at DESC LIMIT 20
  And returns 200 OK with:
    {
      "reviews": [
        {
          "id": 50,
          "rating": 5,
          "comment": "Excelente profesional",
          "createdAt": "2026-03-20T10:00:00Z",
          "reviewer": {
            "id": 1,
            "fullName": "Juan Pérez",
            "profilePhotoUrl": "https://cloudinary.com/avatar1.jpg"
          }
        },
        // ... 19 more reviews
      ],
      "pagination": {
        "hasMore": true,
        "nextCursor": "30", // reviewId of last item
        "limit": 20
      },
      "stats": {
        "totalReviews": 50,
        "averageRating": 4.6,
        "distribution": {
          "5_stars": 60, // 30 reviews
          "4_stars": 30, // 15 reviews
          "3_stars": 6,  // 3 reviews
          "2_stars": 2,  // 1 review
          "1_star": 2    // 1 review
        }
      }
    }

Scenario: Fetch second page with cursor
  Given first page returned nextCursor=30
  When client sends GET /api/users/5/reviews?cursor=30&limit=20
  Then system queries reviews WHERE reviewed_id=5 AND id < 30 ORDER BY created_at DESC LIMIT 20
  And returns next 20 reviews (id 29 to 10)
  And pagination.hasMore = true (more reviews exist)

Scenario: Last page (no more reviews)
  Given professional has exactly 25 reviews total
  When client fetches with cursor=5 (last 5 reviews)
  Then system returns 5 reviews
  And pagination.hasMore = false
  And pagination.nextCursor = null

Scenario: Filter by rating (5 stars only)
  Given professional has 50 reviews (30 are 5-star)
  When client sends GET /api/users/5/reviews?rating=5
  Then system queries reviews WHERE reviewed_id=5 AND rating=5 ORDER BY created_at DESC LIMIT 20
  And returns only 5-star reviews
  And stats.distribution shows full distribution (not filtered)

Scenario: Filter by rating range (1-2 stars)
  When client sends GET /api/users/5/reviews?rating=1-2
  Then system queries WHERE reviewed_id=5 AND rating IN (1,2)
  And returns only negative reviews

Scenario: Professional with no reviews
  Given professional userId=10 has rating=NULL, rating_count=0
  When client fetches reviews
  Then returns 200 OK with:
    {
      "reviews": [],
      "pagination": { "hasMore": false, "nextCursor": null },
      "stats": {
        "totalReviews": 0,
        "averageRating": null,
        "distribution": {
          "5_stars": 0, "4_stars": 0, "3_stars": 0, "2_stars": 0, "1_star": 0
        }
      }
    }

Scenario: Invalid userId (not found)
  When client sends GET /api/users/99999/reviews (non-existent user)
  Then returns 404 Not Found with:
    { "error": "User not found" }
```

---

### FR-004: Display Rating in Cards/Search

**Description:**  
The system MUST include user.rating and user.rating_count in all professional listing endpoints (search, proposals, profile). Frontend MUST differentiate between rating=NULL (no reviews) and low rating (e.g., 2.0).

**Requirements:**
- System MUST include rating, rating_count in:
  - GET /api/professionals/search response
  - GET /api/posts/:postId/proposals response
  - GET /api/users/:userId profile response
- System MUST return rating as DECIMAL(3,2) or NULL
- System MUST return rating_count as INTEGER
- Frontend MUST render NULL as "Sin calificaciones aún"
- Frontend MUST render numeric rating as "⭐ {rating} ({count} reseñas)"
- System MUST support sorting by rating DESC (secondary sort after distance)

**Scenarios:**

```gherkin
Scenario: Search professionals with ratings
  When client sends GET /api/professionals/search?lat=-34.6&lng=-58.4
  Then system returns professionals sorted by distance
  And each professional includes:
    {
      "id": 5,
      "fullName": "Carlos Pérez",
      "rating": 4.8,
      "ratingCount": 35,
      "yearsExperience": 10
    }

Scenario: Professional without reviews (rating=NULL)
  Given professional userId=10 has rating=NULL, rating_count=0
  When included in search results
  Then returns:
    { "id": 10, "fullName": "Ana Gómez", "rating": null, "ratingCount": 0 }
  And frontend displays: "Sin calificaciones aún"

Scenario: Professional with low rating
  Given professional has rating=2.3, rating_count=8
  When displayed in card
  Then frontend renders: "⭐ 2.3 (8 reseñas)"
  And does NOT hide or filter (transparency)

Scenario: Sort professionals by rating (secondary)
  Given search results: [
    { id: 1, distance: 2km, rating: 4.5 },
    { id: 2, distance: 2km, rating: 4.8 },
    { id: 3, distance: 3km, rating: 5.0 }
  ]
  When sorted by distance ASC, then rating DESC
  Then order: [
    { id: 2, distance: 2km, rating: 4.8 }, // Same distance, higher rating first
    { id: 1, distance: 2km, rating: 4.5 },
    { id: 3, distance: 3km, rating: 5.0 }
  ]
```

---

### FR-005: Reminder Notifications (Day 3 and Day 7)

**Description:**  
The system MUST send push notifications to users who have not left a review 3 days and 7 days after appointment completion. Reminders MUST stop if both parties already reviewed.

**Requirements:**
- System MUST run cronjob daily at 2:00 AM
- System MUST query appointments WHERE:
  - status='completed'
  - scheduled_date = NOW() - 3 days OR NOW() - 7 days
  - No review exists for (appointment_id, reviewer_id)
- System MUST send push notification to client if client has not reviewed
- System MUST send push notification to professional if professional has not reviewed
- System MUST skip notification if BOTH parties already reviewed
- System MUST include appointmentId in notification data for deep linking
- System MUST NOT send more than 2 reminders per user per appointment

**Scenarios:**

```gherkin
Scenario: Day 3 reminder sent to client
  Given appointment ID 20 has:
    - status: 'completed'
    - scheduled_date: '2026-03-19' (3 days ago)
    - client_id: 1
    - professional_id: 5
  And NO review exists with (appointment_id=20, reviewer_id=1) // Client hasn't reviewed
  And professional HAS reviewed (reviewer_id=5 exists)
  When cronjob runs on 2026-03-22 at 02:00 AM
  Then system finds appointment 20 (3 days old, client pending)
  And sends push to client (userId=1):
    {
      "title": "⭐ Califica tu experiencia",
      "body": "¿Cómo fue tu experiencia con Carlos Pérez? Déjanos tu opinión.",
      "data": {
        "type": "review_reminder",
        "appointmentId": 20,
        "daysLeft": 27
      }
    }

Scenario: Day 7 reminder (final reminder)
  Given appointment scheduled_date was 7 days ago
  And client has NOT reviewed yet
  When cronjob runs
  Then sends push:
    {
      "title": "⏰ Última oportunidad para calificar",
      "body": "Tienes 23 días más para calificar a Carlos Pérez.",
      "data": { "appointmentId": 20, "finalReminder": true }
    }

Scenario: Both parties already reviewed (skip reminders)
  Given appointment has 2 reviews:
    - (appointment_id=20, reviewer_id=1) // Client reviewed
    - (appointment_id=20, reviewer_id=5) // Professional reviewed
  When cronjob runs on day 3 or day 7
  Then system skips this appointment (both parties reviewed)
  And NO notifications sent

Scenario: Only professional reviewed (remind client only)
  Given professional reviewed but client did not
  When day 3 cronjob runs
  Then sends reminder to client ONLY
  And does NOT send reminder to professional

Scenario: Multiple appointments on same day
  Given 5 appointments completed 3 days ago (all without reviews)
  When cronjob runs
  Then sends 10 push notifications (5 clients + 5 professionals)
  And processes all within 5 minutes
```

---

### FR-006: Review Dispute System (Preparation for Fase 6)

**Description:**  
A user who received a review with rating ≤2 stars MUST be able to report the review as unfair. The system MUST create a dispute record and notify admin. Full mediation UI is in Fase 6.

**Requirements:**
- System MUST allow POST /api/reviews/:reviewId/dispute
- System MUST validate requester is reviewed_id (the person who received review)
- System MUST validate review.rating ≤ 2 (only negative reviews can be disputed)
- System MUST require reason (min 20 chars)
- System MUST accept optional evidence_urls (array of image URLs)
- System MUST create review_disputes record with status='open'
- System MUST send admin alert (email + Sentry event)
- System MUST send notification to reviewer (informing dispute filed)
- System MUST enforce UNIQUE constraint (1 dispute per review)
- System MUST NOT remove review (visible until admin resolves in Fase 6)

**Scenarios:**

```gherkin
Scenario: Professional disputes unfair 1-star review
  Given review ID 100 exists with:
    - rating: 1
    - reviewed_id: 5 (professional)
    - reviewer_id: 1 (client)
    - comment: "No vino a la cita, no responde llamadas"
  When professional (userId=5) sends POST /api/reviews/100/dispute with:
    {
      "reason": "Sí fui a la cita. Cliente no estaba en domicilio. Tengo fotos de ubicación.",
      "evidenceUrls": ["https://cloudinary.com/foto-gps.jpg"]
    }
  Then system validates reviewed_id=5 matches authenticated user (SUCCESS)
  And validates rating=1 ≤ 2 (ALLOWED)
  And validates reason.length=80 ≥ 20 (VALID)
  And creates dispute:
    {
      "id": 1,
      "review_id": 100,
      "disputer_id": 5,
      "reason": "Sí fui a la cita...",
      "evidence_urls": ["https://cloudinary.com/foto-gps.jpg"],
      "status": "open",
      "created_at": NOW()
    }
  And sends alert to admin:
    - Sentry event: "New review dispute #1 - Review 100"
    - Email to support@quickfixu.com:
      Subject: "⚠️ Disputa de review #100"
      Body: "Profesional Carlos Pérez (ID 5) reportó review como injusta. Razón: Sí fui a la cita..."
      Link: "https://admin.quickfixu.com/disputes/1"
  And sends push to reviewer (client userId=1):
    {
      "title": "ℹ️ Tu review fue reportada",
      "body": "El profesional reportó tu calificación. Soporte la revisará en 48 horas.",
      "data": { "disputeId": 1 }
    }
  And returns 201 Created: { "disputeId": 1, "status": "open" }

Scenario: Cannot dispute 3-star review (rating > 2)
  Given review has rating=3
  When professional tries to dispute
  Then system validates rating=3 > 2 (NOT ALLOWED)
  And returns 400 Bad Request with:
    { "error": "Only reviews with 1-2 stars can be disputed" }

Scenario: Unauthorized dispute (not reviewed user)
  Given review 100 has reviewed_id=5 (professional)
  When unrelated user userId=99 tries to dispute
  Then system validates userId=99 != reviewed_id=5 (FAIL)
  And returns 403 Forbidden with:
    { "error": "Only the reviewed user can dispute this review" }

Scenario: Duplicate dispute (UNIQUE constraint)
  Given dispute already exists for review_id=100
  When professional tries to create another dispute
  Then database UNIQUE constraint violation (code 23505)
  And returns 409 Conflict with:
    { "error": "Dispute already exists for this review" }

Scenario: Reason too short
  Given reason = "Mentira" (7 chars, <20)
  When professional submits dispute
  Then system validates reason.length=7 < 20 (FAIL)
  And returns 400 Bad Request with:
    { "error": "Reason must be at least 20 characters" }

Scenario: Review remains visible during dispute
  Given dispute created for review 100
  When client fetches GET /api/users/5/reviews
  Then review 100 is still included in results
  And does NOT show "Under dispute" badge (transparency, no bias)
  And admin resolves in Fase 6 (may remove if confirmed unfair)
```

---

### FR-007: Moderation - Report Inappropriate Review

**Description:**  
ANY user MUST be able to report a review as inappropriate (insults, threats, spam). The system MUST create a report record and notify admin for manual review (Fase 6).

**Requirements:**
- System MUST allow POST /api/reviews/:reviewId/report (public, no auth required)
- System MUST accept: reason (required, min 10 chars)
- System MUST create review_reports record with reporter_id, reason
- System MUST send admin alert (Sentry + email)
- System MUST allow multiple reports for same review (no UNIQUE constraint)
- System MUST NOT hide review until admin resolves (Fase 6)
- System MUST rate-limit to 5 reports/hour per IP (prevent abuse)

**Scenarios:**

```gherkin
Scenario: User reports review with insults
  Given review ID 50 has comment: "Este tipo es un estafador de mierda"
  When any user sends POST /api/reviews/50/report with:
    { "reason": "Contiene insultos y acusaciones sin fundamento" }
  Then system creates report:
    {
      "id": 1,
      "review_id": 50,
      "reporter_id": 10, // or NULL if unauthenticated
      "reason": "Contiene insultos...",
      "created_at": NOW()
    }
  And sends alert to admin:
    - Sentry: "Review #50 reported for: Contiene insultos..."
    - Email with link to review
  And returns 201 Created: { "reportId": 1 }

Scenario: Multiple users report same review
  Given review 50 already has 1 report
  When another user reports same review
  Then creates second report (no UNIQUE constraint)
  And admin sees 2 reports for review 50 (higher priority)

Scenario: Rate limit exceeded
  Given user IP has submitted 5 reports in last hour
  When same IP tries 6th report
  Then returns 429 Too Many Requests with:
    { "error": "Rate limit exceeded. Try again in 60 minutes." }

Scenario: Reason too short
  Given reason = "Malo" (4 chars, <10)
  When user submits report
  Then returns 400 Bad Request with:
    { "error": "Reason must be at least 10 characters" }
```

---

### FR-008: 30-Day Time Window Enforcement

**Description:**  
The system MUST enforce a strict 30-day window from scheduled_date for leaving reviews. After 30 days, the "Calificar" button MUST be disabled in the UI with a tooltip explaining the deadline.

**Requirements:**
- System MUST validate (NOW() - scheduled_date) ≤ 30 days when creating review
- Frontend MUST check days remaining and disable button if expired
- Frontend MUST show tooltip: "Plazo vencido (30 días después de completar trabajo)"
- Frontend MUST show countdown if within last 7 days: "Tienes X días para calificar"
- System MUST allow admin to extend deadline manually (Fase 6 dispute cases)

**Scenarios:**

```gherkin
Scenario: Button enabled within window (day 15)
  Given appointment scheduled_date='2026-03-07' (15 days ago)
  When client views appointment details
  Then frontend calculates: 30 - 15 = 15 days left
  And shows button: "⭐ Calificar" (enabled)
  And tooltip: "Tienes 15 días para dejar tu calificación"

Scenario: Button disabled after 30 days
  Given scheduled_date='2026-02-10' (40 days ago)
  When client views appointment
  Then frontend calculates: 40 - 30 = expired
  And shows button: "⭐ Calificar" (disabled, grayed out)
  And tooltip: "Plazo vencido (30 días después de completar trabajo)"

Scenario: Urgent reminder (last 3 days)
  Given scheduled_date was 28 days ago
  When client views appointment
  Then shows warning badge: "⏰ Solo 2 días para calificar"
  And button color changes to orange (urgency)

Scenario: Backend enforcement (attempt after 30 days)
  Given scheduled_date='2026-02-10' (40 days ago)
  When client bypasses frontend and sends POST /api/reviews
  Then backend validates: (NOW() - scheduled_date) = 40 days > 30 (FAIL)
  And returns 400 Bad Request with:
    { "error": "Review window expired (30 days after completion)" }
```

---

## 3. Database Schema

### Table: reviews

```sql
CREATE TABLE reviews (
  id SERIAL PRIMARY KEY,
  appointment_id INTEGER NOT NULL REFERENCES appointments(id) ON DELETE RESTRICT,
  
  -- Quién califica a quién
  reviewer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  reviewed_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  
  -- Contenido review
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT, -- Opcional, max 500 chars validado en app
  
  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT uq_review_per_person_per_appointment UNIQUE (appointment_id, reviewer_id),
  CONSTRAINT chk_review_different_users CHECK (reviewer_id != reviewed_id)
);

CREATE INDEX idx_reviews_appointment_id ON reviews(appointment_id);
CREATE INDEX idx_reviews_reviewer_id ON reviews(reviewer_id);
CREATE INDEX idx_reviews_reviewed_id ON reviews(reviewed_id); -- Critical for AVG rating
CREATE INDEX idx_reviews_created_at ON reviews(created_at DESC);
CREATE INDEX idx_reviews_rating ON reviews(rating); -- For filter by rating
```

### Table: review_disputes (Preparation for Fase 6)

```sql
CREATE TABLE review_disputes (
  id SERIAL PRIMARY KEY,
  review_id INTEGER NOT NULL REFERENCES reviews(id) ON DELETE RESTRICT,
  disputer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  
  reason TEXT NOT NULL, -- Min 20 chars validated in app
  evidence_urls TEXT[], -- PostgreSQL array of URLs
  
  status VARCHAR(20) NOT NULL DEFAULT 'open' 
    CHECK (status IN ('open', 'investigating', 'resolved_kept', 'resolved_removed', 'closed_invalid')),
  admin_notes TEXT,
  resolved_at TIMESTAMP,
  resolution_reason TEXT,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  CONSTRAINT uq_one_dispute_per_review UNIQUE (review_id)
);

CREATE INDEX idx_review_disputes_review_id ON review_disputes(review_id);
CREATE INDEX idx_review_disputes_status ON review_disputes(status) 
  WHERE status IN ('open', 'investigating');
```

### Table: review_reports

```sql
CREATE TABLE review_reports (
  id SERIAL PRIMARY KEY,
  review_id INTEGER NOT NULL REFERENCES reviews(id) ON DELETE RESTRICT,
  reporter_id INTEGER REFERENCES users(id) ON DELETE SET NULL, -- NULL if unauthenticated
  reporter_ip VARCHAR(45), -- IPv4/IPv6 for rate limiting
  
  reason TEXT NOT NULL, -- Min 10 chars
  
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'reviewed', 'action_taken', 'dismissed')),
  admin_notes TEXT,
  
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_review_reports_review_id ON review_reports(review_id);
CREATE INDEX idx_review_reports_status ON review_reports(status) WHERE status='pending';
CREATE INDEX idx_review_reports_created_at ON review_reports(created_at DESC);
```

### Trigger: update_user_rating()

```sql
CREATE OR REPLACE FUNCTION update_user_rating()
RETURNS TRIGGER AS $$
BEGIN
  WITH rating_stats AS (
    SELECT 
      AVG(rating)::DECIMAL(3,2) AS avg_rating,
      COUNT(*) AS total_reviews
    FROM reviews
    WHERE reviewed_id = NEW.reviewed_id
  )
  UPDATE users
  SET 
    rating = rating_stats.avg_rating,
    rating_count = rating_stats.total_reviews,
    updated_at = NOW()
  FROM rating_stats
  WHERE id = NEW.reviewed_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_user_rating
AFTER INSERT ON reviews
FOR EACH ROW
EXECUTE FUNCTION update_user_rating();
```

---

## 4. Non-Functional Requirements

### NFR-001: Performance - Review Creation Latency

**Description:**  
Review creation MUST complete in <1 second (p95) including trigger execution.

**Requirements:**
- POST /api/reviews endpoint: <1000ms (p95)
- Trigger update_user_rating(): <50ms (p95) with indexed query
- Index on reviews.reviewed_id guarantees O(n) performance where n = user's review count

**Acceptance Criteria:**
- ✅ Load test: 100 reviews/min → p95 latency <1000ms
- ✅ Professional with 1000 reviews → trigger executes <50ms

---

### NFR-002: Data Integrity - UNIQUE Constraint Enforcement

**Description:**  
The system MUST prevent duplicate reviews via database UNIQUE constraint (not app-level check).

**Requirements:**
- UNIQUE constraint (appointment_id, reviewer_id) at database level
- Concurrent review attempts must fail atomically (one succeeds, other gets 23505 error)

**Acceptance Criteria:**
- ✅ Concurrent POST requests → only 1 review created (test with 2 parallel requests)
- ✅ Second attempt returns 409 Conflict

---

### NFR-003: Security - XSS Prevention

**Description:**  
The system MUST sanitize review comments to prevent XSS attacks.

**Requirements:**
- Escape HTML entities: `<`, `>`, `&`, `"`, `'`
- Use library: `validator.escape()` or `DOMPurify` (backend)
- Frontend MUST render as plain text (NOT innerHTML)

**Acceptance Criteria:**
- ✅ Test: Submit comment with `<script>alert('xss')</script>` → stored as escaped HTML
- ✅ Frontend renders escaped text (no script execution)

---

### NFR-004: Scalability - Review Pagination

**Description:**  
Review listing MUST support cursor-based pagination for profiles with >1000 reviews.

**Requirements:**
- Cursor-based pagination (id + created_at composite cursor)
- Limit: 20 reviews per page (configurable)
- No OFFSET-based pagination (poor performance at large offsets)

**Acceptance Criteria:**
- ✅ Professional with 5000 reviews → fetch page 100 in <300ms

---

### NFR-005: Reliability - Notification Delivery

**Description:**  
Reminder notifications MUST be delivered with >95% success rate.

**Requirements:**
- Use Firebase Cloud Messaging (FCM) with retries
- Retry failed notifications 3 times (exponential backoff)
- Log all notification attempts to database

**Acceptance Criteria:**
- ✅ Notification delivery rate >95% over 30 days
- ✅ Failed notifications retried within 1 hour

---

## 5. API Contract

### POST /api/reviews

**Request:**
```json
{
  "appointmentId": 10,
  "rating": 5,
  "comment": "Excelente trabajo, llegó puntual."
}
```

**Response 201 Created:**
```json
{
  "reviewId": 1,
  "rating": 5,
  "comment": "Excelente trabajo, llegó puntual.",
  "reviewedUser": {
    "id": 5,
    "fullName": "Carlos Pérez",
    "newRating": 4.8,
    "ratingCount": 15
  },
  "createdAt": "2026-03-22T10:30:00Z"
}
```

**Error 400:** `{ "error": "Review window expired (30 days after completion)" }`  
**Error 409:** `{ "error": "You already reviewed this appointment" }`

---

### GET /api/users/:userId/reviews

**Query Params:**
- `cursor` (optional): reviewId for pagination
- `limit` (optional, default 20): items per page
- `rating` (optional): filter by rating (e.g., `5` or `1-2`)

**Response 200 OK:**
```json
{
  "reviews": [
    {
      "id": 50,
      "rating": 5,
      "comment": "Excelente profesional",
      "createdAt": "2026-03-20T10:00:00Z",
      "reviewer": {
        "id": 1,
        "fullName": "Juan Pérez",
        "profilePhotoUrl": "https://cloudinary.com/avatar1.jpg"
      }
    }
  ],
  "pagination": {
    "hasMore": true,
    "nextCursor": "49",
    "limit": 20
  },
  "stats": {
    "totalReviews": 50,
    "averageRating": 4.6,
    "distribution": {
      "5_stars": 60,
      "4_stars": 30,
      "3_stars": 6,
      "2_stars": 2,
      "1_star": 2
    }
  }
}
```

---

### POST /api/reviews/:reviewId/dispute

**Request:**
```json
{
  "reason": "Sí fui a la cita. Cliente no estaba en domicilio.",
  "evidenceUrls": ["https://cloudinary.com/foto-gps.jpg"]
}
```

**Response 201 Created:**
```json
{
  "disputeId": 1,
  "status": "open",
  "createdAt": "2026-03-22T11:00:00Z"
}
```

**Error 400:** `{ "error": "Only reviews with 1-2 stars can be disputed" }`  
**Error 409:** `{ "error": "Dispute already exists for this review" }`

---

### POST /api/reviews/:reviewId/report

**Request:**
```json
{
  "reason": "Contiene insultos y acusaciones sin fundamento"
}
```

**Response 201 Created:**
```json
{
  "reportId": 1,
  "message": "Report submitted. Admin will review within 48 hours."
}
```

**Error 429:** `{ "error": "Rate limit exceeded. Try again in 60 minutes." }`

---

## 6. Frontend Changes

### AppointmentDetailsScreen.tsx

**Requirements:**
- Show "⭐ Calificar" button if:
  - appointment.status='completed'
  - payment.status='completed'
  - (NOW() - scheduled_date) ≤ 30 days
  - User has NOT reviewed yet
- Disable button if >30 days with tooltip
- Open ReviewModal on button press

---

### ReviewModal.tsx (New Component)

**Requirements:**
- Star selector (1-5, required)
- Textarea (optional, max 500 chars with counter)
- Submit button: POST /api/reviews
- Show loading state during submission
- Show success message + close modal
- Show error message if failed

---

### ProfessionalProfileScreen.tsx

**Requirements:**
- Display rating badge: "⭐ 4.8 (35 reseñas)" or "Sin calificaciones aún"
- Show rating distribution chart (horizontal bars)
- List reviews with pagination (infinite scroll)
- Filter dropdown: "Todas", "5 estrellas", "4 estrellas", etc.
- Each review card: reviewer avatar, name, rating stars, comment, date

---

## 7. Acceptance Criteria

### AC-001: Review Creation
- ✅ Client creates review after completed appointment
- ✅ Rating updated in real-time (trigger fires)
- ✅ Professional receives push notification
- ✅ Duplicate review blocked (UNIQUE constraint)

### AC-002: Time Window Enforcement
- ✅ Review created at day 15 → SUCCESS
- ✅ Review attempt at day 35 → 400 Bad Request
- ✅ Frontend disables button after 30 days

### AC-003: Review Display
- ✅ Professional profile shows all reviews (paginated)
- ✅ Filter by rating=5 → only 5-star reviews
- ✅ Distribution chart matches actual percentages
- ✅ No reviews → "Sin calificaciones aún"

### AC-004: Reminders
- ✅ Day 3 notification sent to users who didn't review
- ✅ Day 7 final reminder sent
- ✅ No reminders if both parties reviewed

### AC-005: Dispute System
- ✅ Professional disputes 1-star review → admin notified
- ✅ 3-star review dispute blocked (rating > 2)
- ✅ Duplicate dispute blocked (UNIQUE constraint)

### AC-006: Moderation
- ✅ User reports inappropriate review → admin alerted
- ✅ XSS attempt escaped and rendered safely
- ✅ Rate limit prevents spam (5 reports/hour)

---

## 8. Out of Scope (Fase 6 or Later)

- Admin panel for dispute resolution (Fase 6)
- Review editing (reviews are immutable in MVP)
- Professional response to reviews (not implemented)
- Weighted average by recency (all reviews equal weight)
- Automatic profanity filter (manual moderation only)
- Review verification badges ("Trabajo verificado")
- Incentives for leaving reviews (5% discount)

---

**Specification Status:** ✅ READY FOR IMPLEMENTATION  
**Next Phase:** Design (database indexes, cronjob schedule, notification templates)  
**Estimated Complexity:** MEDIUM (3-4 weeks for 1 full-stack developer)
