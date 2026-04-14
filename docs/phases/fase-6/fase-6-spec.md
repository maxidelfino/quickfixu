# Specification: Fase 6 - Admin Panel & OCR Certification Validation

## 1. Introduction

This specification defines the functional and non-functional requirements for **Fase 6: Admin Panel & OCR Certification Validation** of QuickFixU. It is derived from the approved exploration document and serves as the binding contract between backend and frontend teams.

**Change name:** `fase-6-admin-ocr`  
**Persistence mode:** Engram  
**Prerequisite:** Fase 4 (Payments & Appointments) MUST be completed, Fase 5 (Reviews) optional  
**Base proposal:** React.js admin panel with Material-UI, Tesseract.js OCR pipeline with sharp preprocessing, dispute resolution with integrated refund/payout, user moderation, content reports, analytics dashboard

**Features in scope:**
1. Admin Authentication (separate admins table, JWT with role claim)
2. Analytics Dashboard (KPIs, charts, conversion funnel)
3. User Management (search, block/unblock, transaction history)
4. OCR Pipeline (Tesseract.js + sharp + Bull queue + regex parsing)
5. Certification Management (approval/rejection workflow, OCR field editing)
6. Dispute Resolution (refund/payout integration, chat history view)
7. Payment Management (force payout, refund history)
8. Content Moderation (reports queue, delete/ban actions)
9. Admin Actions Logging (audit trail)
10. Webhook Logs Viewer (MercadoPago integration debugging)

---

## 2. Functional Requirements

### FR-001: Admin Authentication & Authorization

**Description:**  
Admins MUST authenticate via separate login endpoint with JWT token containing role claim. Admin panel access MUST be restricted to users in `admins` table. Super admins MUST have additional privileges (create/block admins, force payouts).

**Requirements:**
- System MUST maintain separate `admins` table (NOT unified with `users`)
- Admin passwords MUST be hashed with bcrypt cost factor 12
- Login endpoint MUST implement rate limiting: 5 attempts per 10 minutes per IP
- JWT token MUST include claims: `{ id, role: 'admin', is_super: boolean }`
- JWT token expiration MUST be 8 hours (longer than mobile users)
- Middleware `requireAdmin` MUST validate token and role claim
- Middleware `requireSuperAdmin` MUST validate `is_super` flag
- Failed login attempts MUST be logged for security monitoring

**Scenarios:**

```gherkin
Scenario: Successful admin login
  Given admin "admin@quickfixu.com" exists with:
    - password_hash: bcrypt("SecurePass123!", cost=12)
    - is_active: true
    - is_super_admin: true
  When POST /api/admin/login with:
    { "email": "admin@quickfixu.com", "password": "SecurePass123!" }
  Then system validates password with bcrypt.compare
  And generates JWT token with payload:
    { "id": 1, "role": "admin", "is_super": true }
  And returns:
    {
      "token": "eyJhbGc...",
      "admin": {
        "id": 1,
        "email": "admin@quickfixu.com",
        "full_name": "Admin QuickFixU",
        "is_super_admin": true
      }
    }
  And response time <500ms

Scenario: Login with invalid credentials
  Given admin "admin@quickfixu.com" exists with password_hash for "SecurePass123!"
  When POST /api/admin/login with:
    { "email": "admin@quickfixu.com", "password": "WrongPass" }
  Then system compares password (fails)
  And logs failed attempt to `admin_login_attempts` table
  And returns 401 Unauthorized:
    { "error": "Invalid credentials" }

Scenario: Rate limiting after 5 failed attempts
  Given IP "192.168.1.100" has made 5 failed login attempts in last 10 minutes
  When POST /api/admin/login from IP "192.168.1.100"
  Then system returns 429 Too Many Requests:
    { "error": "Too many login attempts. Try again in 10 minutes." }
  And does NOT check password (rate limit short-circuit)

Scenario: Super admin creates new admin
  Given authenticated super admin with id=1
  When POST /api/admin/admins/create with:
    {
      "email": "moderator@quickfixu.com",
      "password": "TempPass456!",
      "full_name": "Moderador Juan"
    }
  Then system validates password strength (min 12 chars, uppercase, number, special)
  And hashes password with bcrypt cost 12
  And creates admin record:
    {
      "id": 2,
      "email": "moderator@quickfixu.com",
      "full_name": "Moderador Juan",
      "is_super_admin": false,
      "is_active": true
    }
  And logs action to `admin_actions`:
    { "admin_id": 1, "action_type": "create_admin", "entity_id": 2 }
  And returns 201 Created

Scenario: Non-super admin attempts to create admin
  Given authenticated regular admin with is_super=false
  When POST /api/admin/admins/create
  Then system validates is_super flag (fails)
  And returns 403 Forbidden:
    { "error": "Super admin only" }
```

---

### FR-002: Analytics Dashboard

**Description:**  
Admin panel MUST display business KPIs and charts for operational visibility. Data MUST be cached in Redis with 5-minute TTL to prevent database overload. Dashboard MUST support time range filters (today, week, month, year).

**Requirements:**
- System MUST calculate and display KPIs:
  - Total users count (distinct users)
  - Active professionals count (≥1 completed appointment last 30 days)
  - Current month GMV (sum payments.amount WHERE status='completed')
  - Current month transaction count
- System MUST generate charts:
  - Registrations per day (last 30 days) - line chart
  - Transactions per day (last 30 days) - bar chart
  - GMV per day cumulative (last 30 days) - line chart
- System MUST display conversion funnel:
  - Registrations → Posts → Proposals → Payments → Completed (last 30 days)
- System MUST display top 5 professionals:
  - Most completed appointments
  - Highest average rating (minimum 20 reviews filter)
- Dashboard queries MUST use PostgreSQL indexes on: `created_at`, `status`, `updated_at`
- Query results MUST be cached in Redis with key pattern: `admin:analytics:{timeRange}:{metric}`
- Cache TTL MUST be 5 minutes
- Response time MUST be <2 seconds for full dashboard load

**Scenarios:**

```gherkin
Scenario: Dashboard displays current month KPIs
  Given today is 2026-03-22
  And users table has 1250 total records
  And professionals table has 350 records
  And payments table has:
    - 45 payments with status='completed' AND created_at BETWEEN '2026-03-01' AND '2026-03-31'
    - Sum amount = 225000.00 ARS
  And appointments table has 12 with status='completed' last 30 days by professional_id=5
  When GET /api/admin/analytics/dashboard?timeRange=month
  Then system checks Redis cache key "admin:analytics:month:kpis"
  And cache is empty (first request)
  And executes SQL queries with indexes
  And returns:
    {
      "kpis": {
        "totalUsers": 1250,
        "activeProfessionals": 8, // ≥1 appointment last 30 days
        "currentMonthGMV": 225000.00,
        "currentMonthTransactions": 45
      },
      "charts": {
        "registrationsPerDay": [...], // 30 data points
        "transactionsPerDay": [...],
        "gmvPerDay": [...]
      },
      "topProfessionals": [
        { "id": 5, "name": "Carlos Gomez", "completedJobs": 12, "avgRating": 4.8 }
      ],
      "conversionFunnel": {
        "registrations": 50,
        "posts": 35,
        "proposals": 28,
        "payments": 20,
        "completed": 15
      }
    }
  And stores result in Redis with TTL 300 seconds (5 min)
  And response time <2000ms

Scenario: Dashboard cache hit
  Given Redis cache key "admin:analytics:month:kpis" exists with TTL remaining
  When GET /api/admin/analytics/dashboard?timeRange=month
  Then system retrieves data from Redis (no DB query)
  And returns cached data
  And response time <200ms
```

---

### FR-003: User Management (Search, Block, Unblock)

**Description:**  
Admins MUST be able to search users by name/email/DNI, view detailed profiles with transaction history, block users with reason, and unblock users (super admin only). Blocked users MUST receive FCM notification.

**Requirements:**
- System MUST provide paginated user list (50 per page, cursor-based pagination)
- System MUST support filters:
  - Role: client, professional, all
  - Status: active, blocked
  - Date range: created_at
- System MUST support search using PostgreSQL `pg_trgm` extension on: `full_name`, `email`, `dni`
- User detail view MUST include:
  - Full profile (name, email, phone, DNI, role)
  - Transaction history (payments as client + appointments as professional)
  - Reviews received (if professional)
- Block action MUST:
  - Set `users.is_active = false`
  - Store `users.blocked_reason`
  - Create `admin_actions` log entry
  - Send FCM notification to user
- Unblock action MUST require super admin permissions
- Response time for search MUST be <1 second

**Scenarios:**

```gherkin
Scenario: Admin searches user by email
  Given authenticated admin
  And users table has user with email "spammer@example.com" (id=50)
  When GET /api/admin/users?search=spammer@example.com
  Then system uses pg_trgm index on email
  And returns:
    {
      "users": [
        {
          "id": 50,
          "email": "spammer@example.com",
          "full_name": "Spammer User",
          "role": "professional",
          "is_active": true,
          "created_at": "2026-02-15T10:30:00Z"
        }
      ],
      "pagination": { "total": 1, "page": 1 }
    }
  And response time <1000ms

Scenario: Admin blocks user for spam
  Given authenticated admin with id=1
  And user id=50 exists with is_active=true
  When POST /api/admin/users/50/block with:
    { "reason": "Spam posts - publicó 20 anuncios idénticos" }
  Then system updates users table:
    SET is_active = false,
        blocked_reason = "Spam posts - publicó 20 anuncios idénticos",
        blocked_at = NOW()
    WHERE id = 50
  And creates admin_actions log:
    {
      "admin_id": 1,
      "action_type": "ban_user",
      "entity_type": "user",
      "entity_id": 50,
      "details": { "reason": "Spam posts - publicó 20 anuncios idénticos" }
    }
  And sends FCM notification to user 50:
    {
      "title": "Cuenta suspendida",
      "body": "Tu cuenta fue suspendida. Motivo: Spam posts - publicó 20 anuncios idénticos. Contacta soporte."
    }
  And returns 200 OK: { "success": true }

Scenario: Regular admin attempts to unblock user
  Given authenticated admin with is_super=false
  And user id=50 is blocked
  When POST /api/admin/users/50/unblock
  Then system validates is_super flag (fails)
  And returns 403 Forbidden:
    { "error": "Super admin only" }

Scenario: Super admin unblocks user
  Given authenticated super admin with is_super=true
  And user id=50 is blocked
  When POST /api/admin/users/50/unblock
  Then system updates users table:
    SET is_active = true,
        blocked_reason = NULL,
        unblocked_at = NOW()
    WHERE id = 50
  And logs action to admin_actions
  And sends FCM notification to user 50:
    { "title": "Cuenta restaurada", "body": "Tu cuenta fue reactivada." }
  And returns 200 OK
```

---

### FR-004: OCR Pipeline (Tesseract + Sharp Preprocessing + Bull Queue)

**Description:**  
When a professional uploads a certification document (PDF or image), system MUST enqueue OCR job to Bull queue. Worker MUST preprocess image with sharp (grayscale, resize, normalize, sharpen), run Tesseract.js with Spanish language model, extract structured fields using regex patterns from `certification_patterns` table, and store results in `certifications.ocr_data` JSON field.

**Requirements:**
- System MUST accept file uploads: PDF (max 5 pages), JPEG, PNG (max 10MB)
- System MUST validate image DPI ≥300 using sharp metadata (reject if lower)
- Upload endpoint MUST immediately enqueue Bull job: `process-certification-ocr`
- Worker MUST execute in background (non-blocking)
- PDF files MUST be converted to PNG per page using pdf-poppler
- Image preprocessing pipeline MUST apply:
  1. Resize to 2000px width (maintain aspect ratio)
  2. Convert to grayscale
  3. Normalize contrast (auto-histogram)
  4. Sharpen edges (sigma=1.5)
- Tesseract configuration MUST use:
  - Language: `spa` (Spanish)
  - PSM mode: `3` (automatic page segmentation)
- System MUST calculate average confidence score from Tesseract output
- If confidence <60%, system MUST flag `low_confidence` in admin UI
- Regex extraction MUST use patterns from `certification_patterns` table WHERE `certification_type = {cert.type}` AND `is_active = true`
- Extracted fields MUST include: `number`, `issue_date`, `expiry_date`, `holder_name` (if patterns exist)
- Worker MUST retry 3 times with exponential backoff (5s, 10s, 20s) on failure
- Worker timeout MUST be 120 seconds per job
- System MUST log OCR processing time to monitoring (Sentry breadcrumb)

**Scenarios:**

```gherkin
Scenario: Professional uploads certification image (high quality)
  Given authenticated professional with id=5
  And certification type "Matrícula Gasista" has patterns:
    - field_name='number', regex_pattern='MATR[ÍI]CULA.*?(\d{4,8})'
    - field_name='expiry_date', regex_pattern='VENCIMIENTO.*?(\d{2}[-/]\d{2}[-/]\d{4})'
  When POST /api/professionals/me/certifications with:
    - file: matricula_gasista.jpg (3MB, 300 DPI, 2480x3508 px)
    - certification_type: "Matrícula Gasista"
  Then system validates file size ≤10MB (pass)
  And validates DPI using sharp metadata (300 DPI, pass)
  And uploads to Cloudinary
  And creates certification record:
    {
      "id": 100,
      "professional_id": 5,
      "certification_type": "Matrícula Gasista",
      "document_url": "https://res.cloudinary.com/quickfixu/image/upload/v123/cert100.jpg",
      "status": "pending",
      "ocr_data": null
    }
  And enqueues Bull job:
    Queue: "ocr-certifications"
    Data: { "certificationId": 100 }
    Options: { attempts: 3, backoff: { type: 'exponential', delay: 5000 } }
  And returns 201 Created: { "certification": {...}, "message": "Procesando certificación..." }
  And response time <2000ms

Scenario: OCR worker processes image successfully
  Given Bull job with data { "certificationId": 100 }
  And certification 100 has document_url pointing to valid JPG
  When worker picks up job
  Then downloads image from Cloudinary (buffer)
  And preprocesses with sharp:
    - resize({ width: 2000 })
    - grayscale()
    - normalize()
    - sharpen({ sigma: 1.5 })
  And runs Tesseract.recognize(buffer, { lang: 'spa', tessedit_pageseg_mode: 3 })
  And Tesseract returns:
    {
      "text": "REPÚBLICA ARGENTINA\nMATRÍCULA GASISTA N° 12345\nVENCIMIENTO: 10/05/2030\nTITULAR: Carlos Gomez",
      "confidence": 87.3
    }
  And extracts fields using regex:
    - number: "12345" (matched MATR[ÍI]CULA.*?(\d{4,8}))
    - expiry_date: "10/05/2030" (matched VENCIMIENTO.*?(\d{2}[-/]\d{2}[-/]\d{4}))
  And updates certification:
    SET ocr_data = {
      "raw_text": "REPÚBLICA ARGENTINA\nMATRÍCULA GASISTA N° 12345...",
      "confidence": 87.3,
      "extracted_fields": {
        "number": "12345",
        "expiry_date": "10/05/2030"
      },
      "processed_at": "2026-03-22T14:35:20Z"
    },
    certification_number = "12345",
    expiry_date = "2030-05-10"
    WHERE id = 100
  And job completes successfully
  And processing time ~8 seconds

Scenario: OCR confidence low (<60%) - flag for manual review
  Given Bull job with data { "certificationId": 101 }
  And certification 101 has low-quality scanned PDF
  When worker processes OCR
  And Tesseract returns confidence: 45.2
  Then updates certification:
    SET ocr_data = {
      "raw_text": "...",
      "confidence": 45.2,
      "extracted_fields": { ... },
      "low_confidence": true
    }
  And admin UI displays warning badge: "⚠️ Baja confianza OCR - revisar con cuidado"

Scenario: OCR worker timeout (large PDF)
  Given Bull job with certification pointing to 10-page PDF (exceeds limit)
  When worker starts processing
  And processing time exceeds 120 seconds
  Then Bull terminates job with timeout error
  And job enters retry queue (attempt 1/3)
  And after 3 failed attempts, marks job as failed
  And certification status remains "pending" with ocr_data=null
  And admin can trigger manual retry via endpoint POST /api/admin/certifications/101/retry-ocr

Scenario: Upload rejected - low DPI image
  Given professional uploads image with DPI 150 (below 300 threshold)
  When POST /api/professionals/me/certifications
  Then system reads sharp metadata: { density: 150 }
  And validates DPI ≥300 (fails)
  And returns 400 Bad Request:
    {
      "error": "Imagen de baja calidad",
      "message": "La imagen debe tener al menos 300 DPI. Toma una foto con buena luz o escanea el documento en alta calidad."
    }
  And does NOT create certification record
  And does NOT upload to Cloudinary
```

---

### FR-005: Certification Management (Approval/Rejection Workflow)

**Description:**  
Admins MUST view queue of pending certifications ordered by creation date (oldest first). Detail view MUST display original document image side-by-side with OCR extracted fields (editable). Admin MUST approve or reject with reason. Approval MUST trigger `professionals.is_verified = true` if at least 1 certification approved. FCM notification MUST be sent to professional.

**Requirements:**
- List endpoint MUST filter: `status='pending'` ORDER BY `created_at ASC`
- Detail view MUST display:
  - Original document URL (Cloudinary image/PDF viewer)
  - OCR raw text (read-only textarea)
  - Extracted fields (editable inputs: number, issue_date, expiry_date, holder_name)
  - Confidence score with color indicator (green >80%, yellow 60-80%, red <60%)
  - Professional info (name, email, phone)
- Admin MUST be able to edit OCR extracted fields before approving
- Approve action MUST:
  - Update `certifications.status = 'approved'`
  - Set `reviewed_by = admin.id`, `reviewed_at = NOW()`
  - If edited fields provided, update `certification_number`, `issue_date`, `expiry_date`
  - Check if professional has ≥1 approved certification → set `professionals.is_verified = true`
  - Log action to `admin_actions`
  - Send FCM notification: "Certificación aprobada"
- Reject action MUST:
  - Update `certifications.status = 'rejected'`
  - Store `rejection_reason`
  - Set `reviewed_by = admin.id`, `reviewed_at = NOW()`
  - Log action to `admin_actions`
  - Send FCM notification: "Certificación rechazada. Motivo: {reason}. Puedes re-subir."
- Stats panel MUST display:
  - Average approval time (reviewed_at - created_at)
  - Approval rate (approved / total reviewed)
  - Current queue size (pending count)

**Scenarios:**

```gherkin
Scenario: Admin approves certification with OCR edits
  Given authenticated admin with id=1
  And certification id=100 has:
    - status: 'pending'
    - ocr_data.extracted_fields.number: "12345" (OCR auto-extracted)
    - ocr_data.extracted_fields.expiry_date: "10/05/2030"
    - professional_id: 5
  And professional id=5 has is_verified=false (no approved certs yet)
  When POST /api/admin/certifications/100/approve with:
    {
      "edited_fields": {
        "number": "12345-A", // Admin corrects OCR error
        "expiry_date": "2030-05-10"
      }
    }
  Then system validates admin is authenticated
  And updates certifications table:
    SET status = 'approved',
        certification_number = "12345-A",
        expiry_date = "2030-05-10",
        reviewed_by = 1,
        reviewed_at = NOW()
    WHERE id = 100
  And checks: professional 5 has ≥1 approved certification (yes, this one)
  And updates professionals table:
    SET is_verified = true WHERE id = 5
  And creates admin_actions log:
    {
      "admin_id": 1,
      "action_type": "approve_cert",
      "entity_type": "certification",
      "entity_id": 100,
      "details": { "edited_fields": { "number": "12345-A" } }
    }
  And sends FCM to professional 5:
    {
      "title": "Certificación aprobada",
      "body": "Tu Matrícula Gasista fue aprobada. Ya puedes recibir trabajos.",
      "data": { "type": "certification_approved", "certification_id": 100 }
    }
  And returns 200 OK: { "success": true }

Scenario: Admin rejects certification (illegible document)
  Given authenticated admin with id=1
  And certification id=101 has status='pending'
  When POST /api/admin/certifications/101/reject with:
    { "reason": "Documento ilegible - tomar foto con mejor luz" }
  Then system updates certifications table:
    SET status = 'rejected',
        rejection_reason = "Documento ilegible - tomar foto con mejor luz",
        reviewed_by = 1,
        reviewed_at = NOW()
    WHERE id = 101
  And does NOT update professionals.is_verified (rejection doesn't affect)
  And logs action to admin_actions
  And sends FCM to professional:
    {
      "title": "Certificación rechazada",
      "body": "Motivo: Documento ilegible - tomar foto con mejor luz. Puedes re-subir.",
      "data": { "type": "certification_rejected", "certification_id": 101 }
    }
  And returns 200 OK

Scenario: Stats panel calculates metrics
  Given certifications table has:
    - 5 with status='approved', avg(reviewed_at - created_at) = 18 hours
    - 2 with status='rejected'
    - 3 with status='pending'
  When GET /api/admin/certifications/stats
  Then returns:
    {
      "avgApprovalTime": "18 hours",
      "approvalRate": 71.4, // 5/(5+2) * 100
      "queueSize": 3
    }
```

---

### FR-006: Dispute Resolution (Refund/Payout Integration)

**Description:**  
Admins MUST view disputes queue with filters (status, type). Detail view MUST display appointment info, payment details, full chat history, evidence photos, and admin notes. Admin MUST resolve dispute by executing refund (total/partial) or payout to professional via MercadoPago API, updating dispute status, logging action, and notifying users via FCM.

**Requirements:**
- List endpoint MUST filter: `status IN ('open', 'investigating')` ORDER BY `created_at ASC`
- Filters MUST support: `type` (payment_issue, review_appeal), `status`, date range
- Detail view MUST include:
  - Appointment info (date, professional, client, service description)
  - Payment details (amount, method, commission, net_amount, status, MP payment ID)
  - Chat history (read-only, full conversation)
  - Evidence photos (uploaded by reporter, Cloudinary URLs)
  - Admin notes textarea (internal, not visible to users)
  - SLA indicator: badge "⏰ Resolver en <48hs" if `created_at > 48 hours ago`
- Refund Total action MUST:
  - Validate `dispute.status = 'investigating'` (prevent double-refund)
  - Call MercadoPago API: `POST /v1/payments/{id}/refunds` with `amount = payment.amount`
  - Update `payments.status = 'refunded'`
  - Create `refunds` record with MP refund ID
  - Update `disputes.status = 'resolved_refund'`, set `resolved_at = NOW()`
  - Log to `admin_actions`
  - Send FCM to client: "Reembolso procesado. Recibirás ARS {amount} en 5-10 días hábiles."
  - Send FCM to professional: "Disputa resuelta. Pago reembolsado al cliente."
- Refund Partial action MUST accept custom amount (≤payment.amount)
- Payout Professional action MUST:
  - Release held payment (if escrow)
  - Call MercadoPago API transfer (if applicable)
  - Update `payments.payout_status = 'completed'`
  - Update `disputes.status = 'resolved_payout'`
- Close No Action MUST set `disputes.status = 'closed_no_action'`
- Response time for refund execution MUST be <5 seconds

**Scenarios:**

```gherkin
Scenario: Admin executes total refund for dispute
  Given authenticated admin with id=1
  And dispute id=50 has:
    - status: 'investigating'
    - appointment_id: 200
    - reporter_id: 10 (client)
  And appointment 200 has payment:
    - id: 300
    - amount: 5000.00
    - mercadopago_payment_id: "mp_12345"
    - status: 'completed'
  When POST /api/admin/disputes/50/refund-total with:
    { "admin_notes": "Cliente tiene razón - trabajo incompleto según fotos" }
  Then system validates dispute.status = 'investigating' (pass)
  And calls MercadoPago API:
    POST https://api.mercadopago.com/v1/payments/mp_12345/refunds
    Body: { "amount": 5000.00 }
    Headers: { "Authorization": "Bearer ACCESS_TOKEN" }
  And MP API returns:
    { "id": "refund_xyz", "status": "approved", "amount": 5000.00 }
  And updates payments table:
    SET status = 'refunded' WHERE id = 300
  And creates refunds record:
    {
      "payment_id": 300,
      "amount": 5000.00,
      "reason": "dispute_resolved_refund",
      "mercadopago_refund_id": "refund_xyz",
      "status": "completed",
      "completed_at": NOW()
    }
  And updates disputes table:
    SET status = 'resolved_refund',
        admin_notes = "Cliente tiene razón - trabajo incompleto según fotos",
        resolved_at = NOW()
    WHERE id = 50
  And creates admin_actions log:
    {
      "admin_id": 1,
      "action_type": "refund_total",
      "entity_type": "dispute",
      "entity_id": 50,
      "details": { "amount": 5000.00, "payment_id": 300 }
    }
  And sends FCM to client (user 10):
    { "title": "Reembolso procesado", "body": "Recibirás ARS 5000 en 5-10 días hábiles." }
  And sends FCM to professional:
    { "title": "Disputa resuelta", "body": "El pago fue reembolsado al cliente." }
  And returns 200 OK: { "success": true, "refund": {...} }
  And total execution time <5000ms

Scenario: Admin executes partial refund
  Given dispute id=51 with payment amount=5000.00
  When POST /api/admin/disputes/51/refund-partial with:
    { "amount": 2500.00, "admin_notes": "Trabajo parcialmente completado" }
  Then calls MP API with amount=2500.00
  And creates refund record with amount=2500.00
  And updates dispute.status = 'resolved_partial_refund'
  And sends FCM with custom amount: "Recibirás ARS 2500 en 5-10 días hábiles."

Scenario: Admin prevents double refund
  Given dispute id=50 with status='resolved_refund' (already resolved)
  When POST /api/admin/disputes/50/refund-total
  Then system validates dispute.status = 'investigating' (fails)
  And returns 400 Bad Request:
    { "error": "Dispute not in investigating status" }
  And does NOT call MercadoPago API

Scenario: Admin payouts professional (resolves in favor of pro)
  Given dispute id=52 with payment in escrow (payout_status='pending')
  When POST /api/admin/disputes/52/payout-professional with:
    { "admin_notes": "Profesional cumplió - cliente expectativa irreal" }
  Then updates payments.payout_status = 'completed'
  And updates disputes.status = 'resolved_payout'
  And logs action
  And sends FCM to professional: "Disputa resuelta a tu favor. Pago liberado."
```

---

### FR-007: Payment Management & Force Payout (Super Admin)

**Description:**  
Admins MUST view all payments with filters (status, method, date range, amount range). Super admins MUST be able to force payout even without mutual confirmation (emergency override). Refund history MUST be visible.

**Requirements:**
- List endpoint MUST support filters:
  - status: pending, completed, refunded, disputed
  - payment_method: mercadopago, cash
  - date range: created_at
  - amount range: min/max
- Detail view MUST display:
  - Proposal info (title, description, professional, client)
  - Appointment info (date, status, confirmations)
  - Payment breakdown (amount, commission, net_amount, penalty)
  - Refund history (if any refunds exist)
- Force Payout action MUST:
  - Require super admin role
  - Validate payment.status = 'completed'
  - Execute payout via MercadoPago API (if online payment)
  - Update `payments.payout_status = 'completed'`, `payout_forced = true`
  - Log action to `admin_actions` with reason
- Stats panel MUST display:
  - Total transactions current month
  - GMV current month
  - Total commissions collected
  - Total refunds issued

**Scenarios:**

```gherkin
Scenario: Super admin forces payout (emergency)
  Given authenticated super admin with is_super=true
  And payment id=300 has:
    - status: 'completed'
    - payout_status: 'pending'
    - amount: 5000.00
    - net_amount: 4500.00 (10% commission)
  And appointment has NO mutual confirmation (client hasn't confirmed)
  When POST /api/admin/payments/300/force-payout with:
    { "reason": "Cliente no responde - liberar pago después 30 días" }
  Then system validates is_super = true (pass)
  And validates payment.status = 'completed' (pass)
  And executes payout (MP API or balance transfer)
  And updates payments table:
    SET payout_status = 'completed',
        payout_forced = true,
        payout_completed_at = NOW()
    WHERE id = 300
  And logs admin_actions:
    {
      "admin_id": 1,
      "action_type": "force_payout",
      "entity_type": "payment",
      "entity_id": 300,
      "details": { "reason": "Cliente no responde - liberar pago después 30 días", "amount": 4500.00 }
    }
  And sends FCM to professional: "Pago liberado por administración."
  And returns 200 OK

Scenario: Regular admin attempts force payout
  Given authenticated admin with is_super=false
  When POST /api/admin/payments/300/force-payout
  Then system validates is_super (fails)
  And returns 403 Forbidden: { "error": "Super admin only" }

Scenario: Payment stats for current month
  Given payments table has March 2026 data:
    - 45 completed payments, sum(amount) = 225000.00
    - sum(commission_amount) = 22500.00
  And refunds table has March 2026: 3 refunds, sum(amount) = 10000.00
  When GET /api/admin/payments/stats?month=2026-03
  Then returns:
    {
      "totalTransactions": 45,
      "gmv": 225000.00,
      "commissionsCollected": 22500.00,
      "refundsIssued": 10000.00
    }
```

---

### FR-008: Content Moderation (Reports Queue)

**Description:**  
Users MUST be able to report inappropriate content (posts, profiles, reviews) via mobile app. Reports MUST enter admin queue. Admins MUST review reported content, delete content, ban user, or dismiss report. All actions MUST be logged.

**Requirements:**
- Mobile endpoint MUST accept: `POST /api/reports/create`
  - Body: `{ entity_type: 'post'|'user'|'review', entity_id: number, reason: string }`
- System MUST create `content_reports` record with status='open'
- Admin list endpoint MUST filter: `status='open'` ORDER BY `created_at ASC`
- Detail view MUST display:
  - Reported content (post text + images, OR user profile, OR review text)
  - Reporter info (name, email)
  - Report reason
  - Report date
- Delete Content action MUST:
  - Soft delete entity (set `deleted_at = NOW()`)
  - Update `content_reports.status = 'action_taken'`, `resolved_by = admin.id`
  - Log action to `admin_actions`
- Ban User action MUST:
  - Set `users.is_active = false`
  - Store `blocked_reason`
  - Update report status
  - Send FCM notification to user
- Dismiss Report action MUST:
  - Update `content_reports.status = 'dismissed'`
  - No other changes (content stays active)
- Response time for moderation actions MUST be <1 second

**Scenarios:**

```gherkin
Scenario: User reports post for inappropriate content
  Given authenticated user id=20
  And post id=500 exists (created by user 30)
  When POST /api/reports/create with:
    {
      "entity_type": "post",
      "entity_id": 500,
      "reason": "Contenido sexual explícito"
    }
  Then system creates content_reports record:
    {
      "id": 100,
      "reporter_id": 20,
      "entity_type": "post",
      "entity_id": 500,
      "reason": "Contenido sexual explícito",
      "status": "open",
      "created_at": NOW()
    }
  And returns 201 Created: { "report": {...} }

Scenario: Admin deletes reported post and bans user
  Given authenticated admin with id=1
  And content_report id=100 points to post id=500 (created by user 30)
  When POST /api/admin/reports/100/delete-content
  Then system soft deletes post:
    UPDATE posts SET deleted_at = NOW() WHERE id = 500
  And updates report:
    SET status = 'action_taken', resolved_by = 1, resolved_at = NOW()
    WHERE id = 100
  And logs admin_actions:
    { "admin_id": 1, "action_type": "delete_post", "entity_id": 500 }
  And returns 200 OK
  
  When admin follows up with POST /api/admin/reports/100/ban-user with:
    { "reason": "Contenido sexual explícito - violación TOS" }
  Then system blocks user 30 (post creator):
    UPDATE users SET is_active = false, blocked_reason = "Contenido sexual explícito - violación TOS"
    WHERE id = 30
  And sends FCM notification to user 30
  And logs action

Scenario: Admin dismisses false report
  Given content_report id=101 for post that is legitimate
  When POST /api/admin/reports/101/dismiss
  Then updates report:
    SET status = 'dismissed', resolved_by = 1, resolved_at = NOW()
    WHERE id = 101
  And does NOT modify post or user
  And logs action
  And returns 200 OK
```

---

### FR-009: Admin Actions Audit Log

**Description:**  
All admin actions MUST be logged to `admin_actions` table with timestamp, admin ID, action type, entity type, entity ID, and details JSON. Admin panel MUST display filterable log viewer. CSV export MUST be available.

**Requirements:**
- Every admin action (approve cert, ban user, refund, etc.) MUST create log entry
- Log entry MUST include:
  - admin_id (FK to admins.id)
  - action_type (enum: approve_cert, reject_cert, ban_user, refund_total, delete_post, etc.)
  - entity_type (enum: certification, user, payment, dispute, post, etc.)
  - entity_id (ID of affected entity)
  - details (JSONB with action-specific data)
  - created_at (timestamp)
- Admin panel logs viewer MUST support filters:
  - admin_id (dropdown of all admins)
  - action_type (multiselect)
  - entity_type (multiselect)
  - date range
- Export endpoint MUST generate CSV with all filtered logs
- Logs MUST be immutable (no UPDATE or DELETE allowed, except hard delete by super admin)

**Scenarios:**

```gherkin
Scenario: Log created on certification approval
  Given admin id=1 approves certification id=100
  When action completes
  Then system automatically creates admin_actions record:
    {
      "admin_id": 1,
      "action_type": "approve_cert",
      "entity_type": "certification",
      "entity_id": 100,
      "details": {
        "certification_type": "Matrícula Gasista",
        "professional_id": 5,
        "edited_fields": { "number": "12345-A" }
      },
      "created_at": "2026-03-22T15:30:00Z"
    }

Scenario: Admin views filtered logs
  Given authenticated admin
  When GET /api/admin/actions?admin_id=1&action_type=refund_total,refund_partial&dateFrom=2026-03-01&dateTo=2026-03-31
  Then system queries admin_actions table with filters:
    WHERE admin_id = 1
      AND action_type IN ('refund_total', 'refund_partial')
      AND created_at BETWEEN '2026-03-01' AND '2026-03-31'
    ORDER BY created_at DESC
  And returns:
    {
      "actions": [
        {
          "id": 500,
          "admin": { "id": 1, "full_name": "Admin QuickFixU" },
          "action_type": "refund_total",
          "entity_type": "dispute",
          "entity_id": 50,
          "details": { "amount": 5000.00 },
          "created_at": "2026-03-22T15:30:00Z"
        },
        ...
      ],
      "pagination": { "total": 8, "page": 1 }
    }

Scenario: Export logs to CSV
  Given admin requests logs export with filters
  When GET /api/admin/actions/export-csv?dateFrom=2026-03-01&dateTo=2026-03-31
  Then system generates CSV file:
    "ID,Admin,Action Type,Entity Type,Entity ID,Details,Timestamp\n
     500,Admin QuickFixU,refund_total,dispute,50,\"{\"amount\":5000.00}\",2026-03-22 15:30:00\n
     ..."
  And returns file download response
  And response headers:
    Content-Type: text/csv
    Content-Disposition: attachment; filename="admin_actions_2026-03.csv"
```

---

### FR-010: Webhook Logs Viewer (MercadoPago Debugging)

**Description:**  
System MUST log all incoming MercadoPago webhooks (request body, signature validation result, processing result) to database. Admin panel MUST display last 100 webhooks with details for debugging payment integration issues.

**Requirements:**
- Webhook handler MUST log to `webhook_logs` table:
  - webhook_id (MP notification ID)
  - event_type (payment.created, payment.updated, etc.)
  - data_id (MP payment ID)
  - request_body (full JSON)
  - signature_valid (boolean)
  - processing_status (success, failed, skipped)
  - error_message (if processing failed)
  - received_at (timestamp)
- Admin panel MUST display last 100 webhooks ORDER BY received_at DESC
- Detail view MUST display:
  - Full request body (formatted JSON)
  - Signature validation result
  - Processing logs/errors
- Logs older than 30 days MUST be auto-deleted (cron job)

**Scenarios:**

```gherkin
Scenario: Webhook received and logged
  Given MercadoPago sends POST /webhooks/mercadopago with:
    Body: { "id": 123, "type": "payment", "data": { "id": "mp_12345" } }
    Headers: { "x-signature": "...", "x-request-id": "webhook_abc" }
  When webhook handler processes request
  Then validates HMAC-SHA256 signature (success)
  And processes payment update (success)
  And creates webhook_logs record:
    {
      "webhook_id": "webhook_abc",
      "event_type": "payment",
      "data_id": "mp_12345",
      "request_body": { "id": 123, "type": "payment", "data": { "id": "mp_12345" } },
      "signature_valid": true,
      "processing_status": "success",
      "received_at": NOW()
    }

Scenario: Admin views webhook logs
  Given authenticated admin
  When GET /api/admin/webhooks/logs
  Then returns last 100 webhook_logs:
    {
      "webhooks": [
        {
          "id": 1000,
          "webhook_id": "webhook_abc",
          "event_type": "payment",
          "data_id": "mp_12345",
          "signature_valid": true,
          "processing_status": "success",
          "received_at": "2026-03-22T15:30:00Z"
        },
        ...
      ]
    }

Scenario: Admin views webhook detail for debugging
  Given webhook_logs id=1000
  When GET /api/admin/webhooks/logs/1000
  Then returns full details:
    {
      "id": 1000,
      "request_body": { "id": 123, "type": "payment", "data": { "id": "mp_12345" } },
      "signature_valid": true,
      "processing_status": "success",
      "error_message": null,
      "received_at": "2026-03-22T15:30:00Z"
    }
```

---

### FR-011: Analytics Export AFIP CSV

**Description:**  
System MUST provide monthly export of all completed payments in CSV format compatible with AFIP (Argentina tax authority) reporting requirements. Super admins MUST have access to this export.

**Requirements:**
- Export endpoint MUST be super admin only
- CSV format MUST include columns:
  - Fecha (ISO 8601 date)
  - Cliente DNI
  - Cliente Nombre
  - Profesional DNI
  - Profesional Nombre
  - Monto Bruto (payment.amount)
  - Comisión (payment.commission_amount)
  - Neto Profesional (payment.net_amount)
  - Método Pago (mercadopago/cash)
  - MercadoPago ID (if applicable)
- Export MUST filter by month (required parameter)
- Export MUST include only payments with status='completed'

**Scenarios:**

```gherkin
Scenario: Super admin exports AFIP CSV for March 2026
  Given authenticated super admin
  And payments table has 45 completed payments in March 2026
  When GET /api/admin/payments/export-afip-csv?month=2026-03
  Then system queries:
    SELECT
      payments.created_at,
      clients.dni, clients.full_name,
      professionals.dni, professionals.full_name,
      payments.amount, payments.commission_amount, payments.net_amount,
      payments.payment_method, payments.mercadopago_payment_id
    FROM payments
    JOIN users clients ON payments.client_id = clients.id
    JOIN users professionals ON payments.professional_id = professionals.id
    WHERE payments.status = 'completed'
      AND DATE_TRUNC('month', payments.created_at) = '2026-03-01'
    ORDER BY payments.created_at
  And generates CSV:
    "Fecha,Cliente DNI,Cliente Nombre,Profesional DNI,Profesional Nombre,Monto Bruto,Comisión,Neto Profesional,Método Pago,MercadoPago ID\n
     2026-03-05,12345678,Juan Perez,87654321,Carlos Gomez,5000.00,500.00,4500.00,mercadopago,mp_12345\n
     ..."
  And returns file download response
  And response headers:
    Content-Type: text/csv; charset=utf-8
    Content-Disposition: attachment; filename="afip_export_2026-03.csv"

Scenario: Regular admin attempts AFIP export
  Given authenticated admin with is_super=false
  When GET /api/admin/payments/export-afip-csv?month=2026-03
  Then system validates is_super (fails)
  And returns 403 Forbidden: { "error": "Super admin only" }
```

---

## 3. Non-Functional Requirements

### NFR-001: Performance

**Requirements:**
- Dashboard analytics load time MUST be <2 seconds (p95)
- User search response time MUST be <1 second (p95)
- OCR processing time MUST be <15 seconds per certification (p90)
- Dispute refund execution MUST complete in <5 seconds (p95)
- Admin panel initial page load MUST be <3 seconds (p95)

### NFR-002: Security

**Requirements:**
- Admin passwords MUST be hashed with bcrypt cost factor ≥12
- Admin JWT tokens MUST expire after 8 hours
- Login rate limiting MUST be 5 attempts per 10 minutes per IP
- MercadoPago webhook signatures MUST be validated with HMAC-SHA256
- Admin actions MUST be logged for audit trail (immutable)
- Super admin actions (force payout, unblock user) MUST require is_super=true flag
- Admin panel MUST be served over HTTPS only

### NFR-003: Scalability

**Requirements:**
- OCR Bull queue MUST support horizontal scaling (multiple worker processes)
- Redis cache MUST be used for analytics queries (5-minute TTL)
- Database queries MUST use indexes on: created_at, status, email, DNI
- Pagination MUST use cursor-based approach (not offset) for large tables
- Admin panel MUST handle 10+ concurrent admin sessions

### NFR-004: Reliability

**Requirements:**
- OCR worker MUST retry failed jobs 3 times with exponential backoff
- OCR job timeout MUST be 120 seconds
- Webhook handler MUST respond to MercadoPago within 5 seconds (prevent retries)
- Database transactions MUST be atomic for refund/payout operations
- System MUST log errors to Sentry for monitoring

### NFR-005: Usability (Admin Panel)

**Requirements:**
- Admin panel MUST be responsive (desktop 1920x1080 primary, tablet 1024x768 supported)
- OCR confidence score MUST have color indicators (green/yellow/red)
- Dispute SLA indicator MUST display "⏰ Resolver en <48hs" badge
- Certification queue MUST sort by oldest first (FIFO)
- Low-confidence OCR results MUST display warning badge "⚠️ Baja confianza"

---

## 4. Data Model

### 4.1 New Tables

```sql
-- Admins table (separate from users)
CREATE TABLE admins (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  is_super_admin BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_admins_email ON admins(email);
CREATE INDEX idx_admins_is_active ON admins(is_active);

-- Admin actions audit log
CREATE TABLE admin_actions (
  id SERIAL PRIMARY KEY,
  admin_id INTEGER NOT NULL REFERENCES admins(id) ON DELETE RESTRICT,
  action_type VARCHAR(50) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id INTEGER NOT NULL,
  details JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_admin_actions_admin_id ON admin_actions(admin_id);
CREATE INDEX idx_admin_actions_entity ON admin_actions(entity_type, entity_id);
CREATE INDEX idx_admin_actions_created_at ON admin_actions(created_at DESC);

-- Content reports
CREATE TABLE content_reports (
  id SERIAL PRIMARY KEY,
  reporter_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  entity_type VARCHAR(20) NOT NULL CHECK (entity_type IN ('post', 'user', 'review')),
  entity_id INTEGER NOT NULL,
  reason TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'dismissed', 'action_taken')),
  resolved_by INTEGER REFERENCES admins(id) ON DELETE SET NULL,
  resolved_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_content_reports_status ON content_reports(status) WHERE status = 'open';
CREATE INDEX idx_content_reports_entity ON content_reports(entity_type, entity_id);
CREATE INDEX idx_content_reports_created_at ON content_reports(created_at DESC);

-- Certification OCR patterns
CREATE TABLE certification_patterns (
  id SERIAL PRIMARY KEY,
  certification_type VARCHAR(100) NOT NULL,
  field_name VARCHAR(50) NOT NULL,
  regex_pattern TEXT NOT NULL,
  example_value VARCHAR(255),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_cert_patterns_type ON certification_patterns(certification_type);

-- Webhook logs
CREATE TABLE webhook_logs (
  id SERIAL PRIMARY KEY,
  webhook_id VARCHAR(255),
  event_type VARCHAR(50),
  data_id VARCHAR(255),
  request_body JSONB,
  signature_valid BOOLEAN,
  processing_status VARCHAR(20), -- success, failed, skipped
  error_message TEXT,
  received_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_webhook_logs_received_at ON webhook_logs(received_at DESC);
```

### 4.2 Modified Tables

```sql
-- Users: add blocked fields
ALTER TABLE users ADD COLUMN blocked_at TIMESTAMP;
ALTER TABLE users ADD COLUMN unblocked_at TIMESTAMP;

-- Certifications: add low_confidence flag and reviewed fields
ALTER TABLE certifications ADD COLUMN reviewed_by INTEGER REFERENCES admins(id);
ALTER TABLE certifications ADD COLUMN reviewed_at TIMESTAMP;

-- Payments: add payout_forced flag
ALTER TABLE payments ADD COLUMN payout_forced BOOLEAN DEFAULT FALSE;
```

---

## 5. API Endpoints Summary

### Admin Auth
- `POST /api/admin/login` - Admin authentication
- `POST /api/admin/admins/create` - Create new admin (super admin only)

### Analytics
- `GET /api/admin/analytics/dashboard` - KPIs, charts, conversion funnel

### Users
- `GET /api/admin/users` - List users with filters
- `GET /api/admin/users/:id` - User detail
- `POST /api/admin/users/:id/block` - Block user
- `POST /api/admin/users/:id/unblock` - Unblock user (super admin only)

### Certifications
- `GET /api/admin/certifications/pending` - List pending certifications
- `GET /api/admin/certifications/:id` - Certification detail
- `POST /api/admin/certifications/:id/approve` - Approve certification
- `POST /api/admin/certifications/:id/reject` - Reject certification
- `POST /api/admin/certifications/:id/retry-ocr` - Manual OCR retry
- `GET /api/admin/certifications/stats` - Queue stats

### Disputes
- `GET /api/admin/disputes` - List disputes
- `GET /api/admin/disputes/:id` - Dispute detail
- `POST /api/admin/disputes/:id/refund-total` - Execute total refund
- `POST /api/admin/disputes/:id/refund-partial` - Execute partial refund
- `POST /api/admin/disputes/:id/payout-professional` - Payout professional
- `POST /api/admin/disputes/:id/close-no-action` - Close without action

### Payments
- `GET /api/admin/payments` - List payments with filters
- `GET /api/admin/payments/:id` - Payment detail
- `POST /api/admin/payments/:id/force-payout` - Force payout (super admin only)
- `GET /api/admin/payments/stats` - Payment stats
- `GET /api/admin/payments/export-afip-csv` - AFIP export (super admin only)

### Content Moderation
- `POST /api/reports/create` - User reports content (mobile endpoint)
- `GET /api/admin/reports` - List content reports
- `GET /api/admin/reports/:id` - Report detail
- `POST /api/admin/reports/:id/delete-content` - Delete reported content
- `POST /api/admin/reports/:id/ban-user` - Ban user
- `POST /api/admin/reports/:id/dismiss` - Dismiss report

### Admin Actions
- `GET /api/admin/actions` - List admin actions with filters
- `GET /api/admin/actions/export-csv` - Export logs to CSV

### Webhooks
- `GET /api/admin/webhooks/logs` - List webhook logs
- `GET /api/admin/webhooks/logs/:id` - Webhook detail

---

## 6. Admin Panel Tech Stack

### Frontend (React.js)
```json
{
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.20.0",
    "@mui/material": "^5.15.0",
    "@mui/x-data-grid": "^6.18.0",
    "@mui/x-date-pickers": "^6.18.0",
    "@tanstack/react-query": "^5.17.0",
    "recharts": "^2.10.0",
    "axios": "^1.6.0",
    "react-hook-form": "^7.49.0",
    "zod": "^3.22.0",
    "date-fns": "^3.0.0"
  },
  "devDependencies": {
    "vite": "^5.0.0",
    "typescript": "^5.3.0"
  }
}
```

### Backend OCR Stack
```json
{
  "dependencies": {
    "tesseract.js": "^5.0.0",
    "sharp": "^0.33.0",
    "pdf-poppler": "^0.2.1",
    "bull": "^4.12.0",
    "redis": "^4.6.0"
  }
}
```

---

## 7. Acceptance Criteria

### Admin Authentication
- ✅ Admin can login with email/password
- ✅ JWT token includes role='admin' claim
- ✅ Rate limiting prevents brute-force (5 attempts/10min)
- ✅ Super admin can create new admins
- ✅ Failed login attempts are logged

### Analytics Dashboard
- ✅ Dashboard displays 4 KPIs (users, professionals, GMV, transactions)
- ✅ 3 charts render correctly (registrations, transactions, GMV)
- ✅ Conversion funnel shows 5 stages
- ✅ Top 5 professionals list displayed
- ✅ Time range filters work (today, week, month, year)
- ✅ Dashboard loads in <2 seconds

### User Management
- ✅ Admin can search users by name/email/DNI
- ✅ Search uses pg_trgm index (response <1s)
- ✅ Admin can block user with reason
- ✅ Blocked user receives FCM notification
- ✅ Super admin can unblock user
- ✅ User detail shows transaction history

### OCR Pipeline
- ✅ Professional can upload PDF/image certification
- ✅ Upload validates DPI ≥300
- ✅ OCR job enqueued to Bull immediately
- ✅ Worker preprocesses with sharp (grayscale, resize, normalize, sharpen)
- ✅ Tesseract runs with Spanish language
- ✅ Regex extracts fields from `certification_patterns` table
- ✅ Confidence <60% flagged as low confidence
- ✅ OCR completes in <15 seconds (p90)
- ✅ Failed jobs retry 3 times

### Certification Management
- ✅ Admin sees pending certifications queue (oldest first)
- ✅ Detail view shows image + OCR fields (editable)
- ✅ Admin can edit OCR fields before approving
- ✅ Approval sets `professionals.is_verified = true`
- ✅ Rejection stores reason
- ✅ Professional receives FCM notification
- ✅ Stats show average approval time and approval rate

### Dispute Resolution
- ✅ Admin sees disputes queue with filters
- ✅ Detail view shows appointment, payment, chat history, evidence
- ✅ Admin can execute total refund via MP API
- ✅ Admin can execute partial refund with custom amount
- ✅ Admin can payout professional
- ✅ Refund updates payment status and creates refund record
- ✅ Double-refund prevented (idempotency check)
- ✅ Users receive FCM notifications
- ✅ SLA badge displays for disputes >48h old

### Payment Management
- ✅ Admin can view all payments with filters
- ✅ Super admin can force payout
- ✅ Force payout sets `payout_forced = true`
- ✅ Payment stats calculated correctly
- ✅ AFIP CSV export works (super admin only)

### Content Moderation
- ✅ Users can report content via mobile app
- ✅ Reports enter admin queue
- ✅ Admin can delete reported content (soft delete)
- ✅ Admin can ban user
- ✅ Admin can dismiss report
- ✅ All actions logged to `admin_actions`

### Admin Actions Log
- ✅ Every admin action creates log entry
- ✅ Logs immutable (no UPDATE/DELETE except super admin)
- ✅ Admin panel displays filterable log viewer
- ✅ CSV export works

### Webhook Logs
- ✅ All MP webhooks logged to database
- ✅ Admin can view last 100 webhooks
- ✅ Detail view shows full request body and signature validation
- ✅ Logs older than 30 days auto-deleted

---

## 8. Testing Requirements

### Unit Tests
- Admin auth: password validation, JWT generation, rate limiting
- OCR service: sharp preprocessing, Tesseract execution, regex parsing
- Dispute resolution: refund idempotency, MP API error handling

### Integration Tests
- Admin login flow: POST /api/admin/login → receive JWT → access protected endpoint
- OCR pipeline: upload cert → Bull job enqueued → worker processes → OCR data saved
- Refund flow: admin executes refund → MP API called → payment updated → FCM sent

### E2E Tests (Admin Panel)
- Login → dashboard loads → view certifications → approve cert
- Login → view disputes → execute refund → verify payment updated
- Login → search user → block user → verify FCM sent

---

## 9. Deployment

### Admin Panel Build
```bash
cd admin-panel
npm run build  # Output: dist/
```

Deploy to:
- **Cloudflare Pages** (free, CDN)
- **Vercel** (free tier)
- **Railway** (Nginx static files)

### Backend
- OCR worker runs as separate process: `node dist/workers/ocr.worker.js`
- Redis required for Bull queue
- Environment variables:
  - `REDIS_URL`
  - `MERCADOPAGO_ACCESS_TOKEN`
  - `CLOUDINARY_URL`
  - `JWT_SECRET`
  - `TESSERACT_LANG_DATA_PATH`

---

## 10. Future Enhancements (Post-MVP)

- Multi-factor authentication (MFA) for admins (Authy, Google Authenticator)
- Real-time dashboard updates (WebSocket)
- AI-powered content moderation (Cloudinary AI Moderation)
- Advanced OCR morphological preprocessing (ImageMagick)
- Admin roles with granular permissions (approve_certs, resolve_disputes, etc.)
- IP whitelist for admin panel (VPN requirement)
- Export analytics to Google Sheets API
- Automated weekly/monthly reports via email

---

## 11. Glossary

- **OCR**: Optical Character Recognition - text extraction from images
- **Tesseract**: Open-source OCR engine
- **sharp**: High-performance Node.js image processing library
- **Bull**: Redis-based queue for Node.js
- **pg_trgm**: PostgreSQL trigram extension for fuzzy text search
- **AFIP**: Argentina tax authority (Administración Federal de Ingresos Públicos)
- **GMV**: Gross Merchandise Value - total transaction volume
- **SLA**: Service Level Agreement - target resolution time
- **MFA**: Multi-Factor Authentication
