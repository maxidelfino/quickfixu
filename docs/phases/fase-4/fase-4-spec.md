# Specification: Fase 4 - Payments & Appointments

> **Historical artifact note (April 2026):** This specification captures a pre-pivot payments architecture and is no longer the active V1 contract.
>
> Current V1 source of truth is:
> - `docs/PRD.md`
> - `docs/FunctionalFlow.md`
> - `docs/BusinessCase.md`
> - `docs/tickets/2026-04-v1-marketplace-pivot.md`
>
> Keep this file for history only; do **not** implement its payment/escrow/payout requirements for current V1.

## 1. Introduction

This specification defines the functional and non-functional requirements for **Fase 4: Payments & Appointments** of QuickFixU. It is derived from the approved exploration document and serves as the binding contract between backend and frontend teams.

**Change name:** `fase-4-payments-appointments`  
**Persistence mode:** Engram  
**Prerequisite:** Fase 3 (Chat en Tiempo Real) MUST be completed  
**Base proposal:** MercadoPago integration, escrow with mutual confirmation, reprogramaciones, cancelaciones con penalty, payout automation, cash payments with balance tracking

**Features in scope:**
1. MercadoPago Checkout Pro Integration (preferencia + webview)
2. Webhook Handler with Signature Verification (HMAC-SHA256)
3. Payment Creation & Status Tracking (pending/completed/failed/refunded/disputed)
4. Commission Calculation Variable (0%/10%/50% snapshot)
5. Appointments Auto-creation on Payment Success
6. Mutual Confirmation System (client + professional)
7. Auto-Release Timeout (7 días sin confirmación cliente)
8. Reprogramaciones (máximo 2, tercera = cancelación)
9. Cancelaciones con Penalty (15% del monto)
10. Payout Automation Cronjob (<24hs confirmación mutua)
11. Cash Payments with Balance Tracking (deuda + cobro mensual)
12. Disputes Reporting (bloqueo payout, Fase 6 resolución)
13. Refunds API (total/parcial)
14. AFIP Compliance Export (CSV mensual)

---

## 2. Functional Requirements

### FR-001: Create Payment Preference (MercadoPago Checkout Pro)

**Description:**  
A client user MUST be able to initiate payment for an accepted proposal. The system MUST create a MercadoPago preference, calculate variable commission (0%/10%/50%), create a payment record in pending status, and return the Checkout Pro init_point URL for webview redirect.

**Requirements:**
- System MUST validate proposal status='accepted' and belongs to requesting client
- System MUST calculate commission percentage based on:
  - 0% if professional has credit_card_token AND created_at < 1 year ago
  - 50% if professional does NOT have credit_card_token
  - 10% default (has card but >1 year)
- System MUST calculate commission_amount = amount * commission_percentage / 100
- System MUST calculate net_amount = amount - commission_amount
- System MUST create payment record with status='pending', payment_method='mercadopago'
- System MUST generate UUID for payment.id (idempotent external_reference)
- System MUST create MercadoPago preference with:
  - items: proposal.title, proposal.price
  - payer: client email, name, phone
  - back_urls: quickfixu://payment/{success|failure|pending}
  - auto_return: 'approved'
  - external_reference: payment.id (UUID)
  - notification_url: {API_URL}/webhooks/mercadopago
- System MUST return init_point and sandbox_init_point URLs
- System MUST complete operation in <2 seconds (p95)

**Scenarios:**

```gherkin
Scenario: Successful payment preference creation (0% commission)
  Given the client "juan@example.com" (userId=1) is authenticated
  And proposal ID 10 exists with:
    - status: 'accepted'
    - price: 5000.00 (ARS)
    - post.user_id: 1 (client owns post)
    - professional_id: 5
  And professional ID 5 has:
    - credit_card_token: "tok_abc123" (registered card)
    - created_at: "2025-06-01" (8 months ago, <1 year)
  When the client sends POST /api/payments/create-preference with:
    { "proposalId": 10 }
  Then the system validates proposal ownership (success)
  And calculates commission:
    - Has card: YES
    - Created <1 year ago: YES (2025-06-01 to 2026-03-22 = 9 months)
    - commission_percentage: 0%
    - commission_amount: 0.00
    - net_amount: 5000.00
  And creates payment record in database:
    {
      "id": "550e8400-e29b-41d4-a716-446655440000", // UUID
      "proposal_id": 10,
      "client_id": 1,
      "professional_id": 5,
      "amount": 5000.00,
      "commission_percentage": 0.00,
      "commission_amount": 0.00,
      "net_amount": 5000.00,
      "penalty_amount": 0.00,
      "payment_method": "mercadopago",
      "status": "pending",
      "payout_status": "pending",
      "created_at": NOW()
    }
  And creates MercadoPago preference with:
    - title: "Trabajo: {proposal.post.title}"
    - unit_price: 5000.00
    - currency_id: "ARS"
    - payer.email: "juan@example.com"
    - external_reference: "550e8400-e29b-41d4-a716-446655440000"
    - notification_url: "https://api.quickfixu.com/webhooks/mercadopago"
  And returns 201 Created with:
    {
      "paymentId": "550e8400-e29b-41d4-a716-446655440000",
      "preferenceId": "123456789-abc-def",
      "initPoint": "https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=123456789-abc-def",
      "sandboxInitPoint": "https://sandbox.mercadopago.com.ar/checkout/v1/redirect?pref_id=...",
      "amount": 5000.00,
      "commissionPercentage": 0.00,
      "commissionAmount": 0.00,
      "netAmount": 5000.00,
      "message": "Comisión 0% - Promoción Año 1 ¡Gratis!"
    }

Scenario: Payment preference creation (50% commission - sin tarjeta)
  Given the client requests payment for proposal ID 11
  And professional ID 6 has:
    - credit_card_token: NULL (NO card registered)
    - created_at: "2024-01-01"
  When the client sends POST /api/payments/create-preference with { proposalId: 11 }
  Then the system calculates commission:
    - Has card: NO
    - commission_percentage: 50%
    - commission_amount: 2500.00 (5000 * 0.50)
    - net_amount: 2500.00
  And returns warning message: "Comisión 50% - El profesional no tiene tarjeta registrada"

Scenario: Payment preference creation (10% commission - default)
  Given professional ID 7 has:
    - credit_card_token: "tok_xyz789" (registered)
    - created_at: "2023-01-01" (>1 year ago)
  When client creates preference
  Then commission_percentage: 10%
  And commission_amount: 500.00 (5000 * 0.10)
  And net_amount: 4500.00
  And message: "Comisión 10%"

Scenario: Unauthorized access (not proposal owner)
  Given proposal ID 10 belongs to client userId=1
  And user userId=5 (different client) is authenticated
  When userId=5 sends POST /api/payments/create-preference with { proposalId: 10 }
  Then the system returns 403 Forbidden with:
    { "error": "Access denied. You are not the owner of this proposal." }

Scenario: Proposal not accepted yet
  Given proposal ID 12 has status='pending'
  When client sends create-preference
  Then system returns 400 Bad Request with:
    { "error": "Proposal must be accepted before creating payment" }

Scenario: MercadoPago API timeout
  Given MercadoPago API is slow (response time >5s)
  When client creates preference
  Then system retries 2 times (exponential backoff)
  And if still fails, returns 504 Gateway Timeout with:
    { "error": "Payment gateway timeout. Please retry in 30 seconds." }
```

---

### FR-002: Webhook Handler - Payment Status Update

**Description:**  
The system MUST receive and process MercadoPago IPN webhooks when payment status changes. The system MUST verify HMAC-SHA256 signature, fetch payment details from MP API, update payment status idempotently, and trigger appointment creation if payment is completed.

**Requirements:**
- System MUST validate `x-signature` header using HMAC-SHA256 with MP_WEBHOOK_SECRET
- System MUST reject webhooks with invalid/missing signature (401 Unauthorized)
- System MUST parse signature format: "ts={timestamp},v1={hash}"
- System MUST recreate manifest: "id:{data.id};request-id:{x-request-id};ts:{ts};"
- System MUST compare computed HMAC hash with provided hash (constant-time comparison)
- System MUST fetch full payment details from MP API (do NOT trust webhook body alone)
- System MUST find payment by external_reference (our UUID)
- System MUST update payment.status based on MP status mapping (idempotent upsert)
- System MUST create appointment if new status='completed' AND appointment doesn't exist
- System MUST send push notification to professional on payment completed
- System MUST respond 200 OK even if payment not found (MP retries on 4xx/5xx)
- System MUST log all webhook events to Sentry/Winston
- System MUST handle duplicate webhooks gracefully (same payment_id multiple times)

**MercadoPago Status Mapping:**

| MP Status | Our Status |
|-----------|------------|
| approved | completed |
| pending, in_process, in_mediation | pending |
| rejected, cancelled | failed |
| refunded, charged_back | refunded |

**Scenarios:**

```gherkin
Scenario: Valid webhook - payment approved
  Given payment "550e8400-e29b-41d4-a716-446655440000" exists with status='pending'
  And MercadoPago sends POST /webhooks/mercadopago with:
    - Headers:
      x-signature: "ts=1679000000,v1=abc123def456..."
      x-request-id: "req-123"
    - Body:
      {
        "id": 12345,
        "type": "payment",
        "data": { "id": "67890" }
      }
  When the webhook handler receives request
  Then the system parses x-signature (ts=1679000000, hash=abc123def456...)
  And recreates manifest: "id:12345;request-id:req-123;ts:1679000000;"
  And computes HMAC-SHA256 using MP_WEBHOOK_SECRET
  And compares hash (SUCCESS - valid signature)
  And fetches payment 67890 from MercadoPago API GET /v1/payments/67890
  And receives MP payment data:
    {
      "id": 67890,
      "status": "approved",
      "external_reference": "550e8400-e29b-41d4-a716-446655440000",
      "transaction_amount": 5000.00
    }
  And finds payment in database by id "550e8400..."
  And updates payment:
    {
      "mercadopago_payment_id": "67890",
      "status": "completed",
      "updated_at": NOW()
    }
  And creates appointment (see FR-005)
  And sends push notification to professional:
    {
      "title": "💰 Pago confirmado",
      "body": "El cliente pagó ARS 5,000. El trabajo está agendado.",
      "data": { "type": "payment_completed", "paymentId": "550e8400..." }
    }
  And responds 200 OK with: { "message": "Webhook processed" }

Scenario: Invalid signature - webhook rejected
  Given attacker sends forged webhook with:
    - x-signature: "ts=1679000000,v1=FAKE_HASH_123"
    - Body: { "type": "payment", "data": { "id": "99999" } }
  When webhook handler processes request
  Then system computes expected hash (does NOT match "FAKE_HASH_123")
  And logs security alert to Sentry: "Invalid webhook signature from IP {ip}"
  And responds 401 Unauthorized with: { "error": "Invalid signature" }
  And does NOT update any payment

Scenario: Missing signature header
  Given webhook arrives without x-signature header
  When handler processes request
  Then returns 400 Bad Request with: { "error": "Missing signature" }

Scenario: Duplicate webhook (idempotent)
  Given payment "550e8400..." already has status='completed', mercadopago_payment_id='67890'
  When MercadoPago resends same webhook (retry due to network)
  Then system validates signature (success)
  And fetches MP payment 67890 (status still 'approved')
  And updates payment (upsert - no change, updated_at refreshed)
  And checks if appointment exists (YES - already created)
  And skips appointment creation (idempotent)
  And responds 200 OK

Scenario: Payment not found (external_reference mismatch)
  Given webhook has external_reference="UNKNOWN-UUID-123"
  And no payment exists with id="UNKNOWN-UUID-123"
  When handler processes webhook
  Then system logs warning: "Payment not found: UNKNOWN-UUID-123"
  And responds 200 OK (prevent MP retry loop)
  And does NOT crash or return 500

Scenario: Payment rejected by MP
  Given payment status='pending'
  When webhook arrives with MP status='rejected'
  Then system maps status to 'failed'
  And updates payment.status='failed'
  And sends push notification to client:
    {
      "title": "❌ Pago rechazado",
      "body": "Tu pago fue rechazado. Intenta con otra tarjeta.",
      "data": { "type": "payment_failed" }
    }
  And does NOT create appointment

Scenario: Webhook timeout (MP API fetch slow)
  Given MP API GET /v1/payments/{id} takes >10 seconds
  When webhook handler fetches payment details
  Then request times out after 10s
  And responds 500 Internal Server Error (MP will retry)
  And logs error to Sentry

Scenario: Non-payment webhook (ignored)
  Given webhook arrives with type='merchant_order'
  When handler processes
  Then returns 200 OK with: { "message": "Ignored non-payment webhook" }
  And does NOT process further
```

---

### FR-003: Signature Verification Protocol

**Description:**  
The system MUST implement HMAC-SHA256 signature verification for all MercadoPago webhooks to prevent unauthorized/forged webhook attacks. This is a CRITICAL security requirement.

**Requirements:**
- System MUST extract `x-signature` header (format: "ts={timestamp},v1={hash}")
- System MUST extract `x-request-id` header
- System MUST parse timestamp `ts` and hash `v1` from x-signature
- System MUST construct manifest string: "id:{body.id};request-id:{x-request-id};ts:{ts};"
- System MUST compute HMAC-SHA256 of manifest using MP_WEBHOOK_SECRET (from env)
- System MUST compare computed hash with provided hash using constant-time comparison
- System MUST reject if hashes differ (401 Unauthorized)
- System MUST log all signature validation failures to Sentry with IP address
- System MUST use crypto.timingSafeEqual() to prevent timing attacks

**Scenarios:**

```gherkin
Scenario: Valid signature verification
  Given webhook arrives with:
    - x-signature: "ts=1679000000,v1=a1b2c3d4e5f6..."
    - x-request-id: "req-456"
    - body.id: 12345
  And MP_WEBHOOK_SECRET = "my-secret-key-xyz"
  When system verifies signature
  Then parses ts=1679000000, hash=a1b2c3d4e5f6...
  And constructs manifest: "id:12345;request-id:req-456;ts:1679000000;"
  And computes HMAC-SHA256(manifest, "my-secret-key-xyz") = "a1b2c3d4e5f6..."
  And compares using crypto.timingSafeEqual(computed, provided) = TRUE
  And verification succeeds

Scenario: Invalid hash (tampered webhook)
  Given webhook with x-signature: "ts=1679000000,v1=WRONG_HASH"
  When system computes expected hash = "CORRECT_HASH_123"
  Then crypto.timingSafeEqual(CORRECT_HASH_123, WRONG_HASH) = FALSE
  And verification fails
  And returns 401 Unauthorized

Scenario: Malformed signature header
  Given x-signature: "invalid-format-no-ts-or-v1"
  When system attempts to parse
  Then throws parsing error
  And returns 400 Bad Request with: { "error": "Malformed signature" }

Scenario: Missing MP_WEBHOOK_SECRET env var
  Given MP_WEBHOOK_SECRET is undefined in environment
  When server starts
  Then throws fatal error: "MP_WEBHOOK_SECRET not configured"
  And server fails to start (fail-fast)
```

---

### FR-004: Commission Calculation Variable (Snapshot)

**Description:**  
The system MUST calculate commission percentage based on professional's credit card registration and account age at the time of payment creation. The calculated commission MUST be stored as a snapshot (immutable) in the payment record for AFIP compliance and transparent auditing.

**Requirements:**
- System MUST check if professional.credit_card_token is NOT NULL
- System MUST calculate account age: NOW() - professional.created_at
- System MUST apply rules:
  - 0% if has card AND created <1 year ago (promotion)
  - 50% if NO card (discourage cash-only professionals)
  - 10% default (has card, >1 year old)
- System MUST store commission_percentage, commission_amount, net_amount in payment record
- System MUST NEVER recalculate historical commissions (snapshot is immutable)
- System MUST display commission breakdown in checkout UI before payment
- System MUST log commission calculation for each payment (audit trail)

**Scenarios:**

```gherkin
Scenario: 0% commission (new professional with card)
  Given professional created_at = "2025-09-01" (6 months ago)
  And has credit_card_token = "tok_abc"
  When system calculates commission for amount=5000
  Then commission_percentage = 0
  And commission_amount = 0.00
  And net_amount = 5000.00
  And saves snapshot to payment record

Scenario: 50% commission (no card registered)
  Given professional credit_card_token = NULL
  When system calculates commission for amount=5000
  Then commission_percentage = 50
  And commission_amount = 2500.00
  And net_amount = 2500.00

Scenario: 10% commission (old professional with card)
  Given professional created_at = "2022-01-01" (4 years ago)
  And has credit_card_token = "tok_xyz"
  When system calculates commission for amount=5000
  Then commission_percentage = 10
  And commission_amount = 500.00
  And net_amount = 4500.00

Scenario: Commission rule change does NOT affect old payments
  Given payment ID 1 was created on 2025-01-01 with commission_percentage=0
  And today is 2026-03-22
  And commission rules changed to 5% for year 1
  When system displays payment history for payment ID 1
  Then shows commission_percentage = 0 (original snapshot)
  And does NOT recalculate (maintains historical accuracy)
```

---

### FR-005: Appointment Auto-creation on Payment Success

**Description:**  
When a payment status changes to 'completed' (via webhook), the system MUST automatically create an appointment record and an appointment_confirmation record. The appointment MUST use the scheduled_date and scheduled_time from the original proposal.

**Requirements:**
- System MUST check if appointment already exists for payment_id (idempotent)
- System MUST create appointment with status='scheduled'
- System MUST set scheduled_date and scheduled_time from proposal
- System MUST set rescheduled_count=0
- System MUST create appointment_confirmation record with:
  - client_confirmed = FALSE
  - professional_confirmed = FALSE
  - auto_release_date = scheduled_date + 7 days
  - auto_released = FALSE
- System MUST send push notification to both users
- System MUST complete in <500ms (p95)

**Scenarios:**

```gherkin
Scenario: Appointment created on payment success
  Given payment "550e8400..." status changes from 'pending' to 'completed'
  And proposal ID 10 has scheduled_date='2026-03-25', scheduled_time='14:00:00'
  And no appointment exists for payment_id "550e8400..."
  When webhook handler processes payment completed
  Then system creates appointment:
    {
      "id": 1,
      "proposal_id": 10,
      "payment_id": "550e8400...",
      "scheduled_date": "2026-03-25",
      "scheduled_time": "14:00:00",
      "status": "scheduled",
      "rescheduled_count": 0,
      "created_at": NOW()
    }
  And creates appointment_confirmation:
    {
      "id": 1,
      "appointment_id": 1,
      "client_confirmed": false,
      "professional_confirmed": false,
      "auto_release_date": "2026-04-01T14:00:00Z", // +7 days
      "auto_released": false
    }
  And sends push to client:
    { "title": "✅ Trabajo agendado", "body": "Pago confirmado. Trabajo el 25/03 a las 14:00." }
  And sends push to professional:
    { "title": "💼 Nuevo trabajo agendado", "body": "Cliente pagó. Trabajo el 25/03 a las 14:00." }

Scenario: Idempotent appointment creation (duplicate webhook)
  Given appointment ID 1 already exists with payment_id "550e8400..."
  When webhook processes same payment completed event again
  Then system queries appointment (finds existing ID 1)
  And skips creation (idempotent)
  And does NOT duplicate appointment

Scenario: Payment failed - no appointment created
  Given payment status changes to 'failed'
  When webhook handler processes
  Then system does NOT create appointment
  And sends notification to client about payment failure
```

---

### FR-006: Mutual Confirmation System

**Description:**  
After an appointment is completed, BOTH the client AND the professional MUST independently confirm the work was done satisfactorily. Only when BOTH confirmations are received, the system MUST release payment to the professional (payout_status='ready').

**Requirements:**
- System MUST provide separate "Confirmar trabajo" endpoints for client and professional
- System MUST validate user is either client or professional of the appointment
- System MUST update appointment_confirmations.client_confirmed OR professional_confirmed
- System MUST set confirmation timestamp (client_confirmed_at / professional_confirmed_at)
- System MUST check if BOTH confirmations are TRUE after each update
- System MUST trigger database function/trigger to set payment.payout_status='ready'
- System MUST send push notification to other party when one confirms
- System MUST prevent double-confirmation (idempotent)
- System MUST NOT allow confirmation if appointment status is cancelled/disputed

**Scenarios:**

```gherkin
Scenario: Client confirms first, professional pending
  Given appointment ID 5 exists with:
    - client_id: 1
    - professional_id: 2
    - status: 'scheduled'
    - scheduled_date: '2026-03-20' (3 days ago - work done)
  And appointment_confirmation has:
    - client_confirmed: false
    - professional_confirmed: false
  When client (userId=1) sends POST /api/appointments/5/confirm-client
  Then system validates user is client (success)
  And updates appointment_confirmation:
    {
      "client_confirmed": true,
      "client_confirmed_at": NOW()
    }
  And checks if BOTH confirmed (client=TRUE, professional=FALSE) → NO
  And does NOT update payment.payout_status (still 'pending')
  And sends push to professional:
    {
      "title": "✅ Cliente confirmó trabajo",
      "body": "Confirma tu parte para recibir el pago.",
      "data": { "appointmentId": 5 }
    }
  And returns 200 OK: { "confirmed": true, "waitingFor": "professional" }

Scenario: Professional confirms second - triggers payout
  Given client already confirmed (client_confirmed=true)
  And professional_confirmed=false
  When professional (userId=2) sends POST /api/appointments/5/confirm-professional
  Then system updates appointment_confirmation:
    {
      "professional_confirmed": true,
      "professional_confirmed_at": NOW()
    }
  And checks BOTH confirmed (client=TRUE, professional=TRUE) → YES
  And triggers DB function handle_mutual_confirmation()
  And updates payment.payout_status='ready'
  And sends push to professional:
    {
      "title": "💸 Pago listo para liberación",
      "body": "Recibirás ARS 5,000 en menos de 24 horas."
    }
  And sends push to client:
    { "title": "✅ Trabajo confirmado", "body": "Ambos confirmaron. El pago será liberado." }
  And returns 200 OK: { "confirmed": true, "payoutReady": true }

Scenario: Professional confirms first, client pending
  Given both confirmations are false
  When professional confirms first
  Then professional_confirmed=true, client_confirmed=false
  And payment.payout_status remains 'pending'
  And sends push to client:
    { "title": "⏳ Confirma el trabajo", "body": "El profesional marcó el trabajo como completado. Confirma para liberar el pago." }

Scenario: Double confirmation (idempotent)
  Given client already confirmed (client_confirmed=true)
  When client sends confirm request again
  Then system updates with same values (no change)
  And returns 200 OK: { "confirmed": true, "alreadyConfirmed": true }

Scenario: Unauthorized confirmation attempt
  Given appointment ID 5 has client_id=1, professional_id=2
  When user userId=99 (unrelated) sends confirm request
  Then returns 403 Forbidden: { "error": "Access denied" }

Scenario: Cannot confirm cancelled appointment
  Given appointment status='cancelled_by_client'
  When client tries to confirm
  Then returns 400 Bad Request: { "error": "Cannot confirm cancelled appointment" }

Scenario: Cannot confirm disputed appointment
  Given payment status='disputed'
  When either party tries to confirm
  Then returns 400 Bad Request: { "error": "Appointment is under dispute. Wait for admin resolution." }
```

---

### FR-007: Auto-Release Timeout (7 días)

**Description:**  
If the client does NOT confirm the work within 7 days after scheduled_date, the system MUST automatically confirm on behalf of the client and release payment to the professional. The system MUST send preventive notifications on days 5, 6, and 7.

**Requirements:**
- System MUST run cronjob daily at 3:00 AM to check expired appointments
- System MUST query appointment_confirmations WHERE:
  - auto_release_date <= NOW()
  - client_confirmed = FALSE
  - auto_released = FALSE
- System MUST auto-confirm client (set client_confirmed=TRUE, auto_released=TRUE)
- System MUST trigger payout if professional already confirmed
- System MUST send preventive notifications:
  - Day 5: "Tienes 2 días para confirmar o rechazar trabajo"
  - Day 6: "Último día para confirmar trabajo"
  - Day 7: "El pago será liberado automáticamente hoy"
- System MUST log all auto-releases to audit log
- System MUST allow admin to extend timeout manually (dispute cases)

**Scenarios:**

```gherkin
Scenario: Auto-release triggered on day 7
  Given appointment ID 10 has:
    - scheduled_date: '2026-03-15'
    - auto_release_date: '2026-03-22T14:00:00Z' (scheduled_date + 7 days)
  And today is 2026-03-22 at 03:00 AM (cronjob runs)
  And client_confirmed=false, professional_confirmed=true
  And auto_released=false
  When cronjob executes
  Then system finds appointment 10 (auto_release_date <= NOW())
  And updates appointment_confirmation:
    {
      "client_confirmed": true,
      "client_confirmed_at": NOW(),
      "auto_released": true
    }
  And checks BOTH confirmed (client=TRUE, professional=TRUE) → YES
  And updates payment.payout_status='ready'
  And sends push to client:
    {
      "title": "⏰ Pago liberado automáticamente",
      "body": "No confirmaste el trabajo en 7 días. El pago fue liberado. Si hubo problemas, contacta soporte.",
      "data": { "appointmentId": 10, "autoReleased": true }
    }
  And sends push to professional:
    { "title": "💸 Pago listo", "body": "Cliente no confirmó a tiempo. Pago liberado automáticamente." }
  And logs to audit: "Auto-released appointment 10 on timeout"

Scenario: Preventive notification - Day 5
  Given appointment auto_release_date = '2026-03-27T14:00:00Z'
  And today is 2026-03-22 (5 days before)
  And client_confirmed=false
  When preventive notification cronjob runs
  Then sends push to client:
    {
      "title": "⏳ Confirma el trabajo",
      "body": "Tienes 2 días para confirmar o rechazar el trabajo antes de liberación automática.",
      "data": { "appointmentId": 10, "daysLeft": 2 }
    }

Scenario: Preventive notification - Day 6
  Given 1 day before auto_release_date
  When cronjob runs
  Then sends push: "⏰ Último día para confirmar trabajo"

Scenario: Preventive notification - Day 7 (morning)
  Given auto_release_date is today at 14:00
  And current time is 08:00 AM
  When cronjob runs at 08:00
  Then sends push: "🚨 El pago será liberado automáticamente hoy a las 14:00. Confirma o reporta problema AHORA."

Scenario: Client confirms before timeout
  Given auto_release_date is tomorrow
  When client confirms today
  Then client_confirmed=true
  And auto_release cronjob skips this appointment (client already confirmed)

Scenario: Admin extends timeout (dispute case)
  Given appointment is under investigation
  When admin sends PATCH /admin/appointments/10/extend-timeout with { days: 3 }
  Then system updates auto_release_date = current_auto_release_date + 3 days
  And sends notification to client: "El plazo fue extendido 3 días por soporte."
```

---

### FR-008: Reprogramaciones (Máximo 2)

**Description:**  
Either the client OR the professional MUST be able to request rescheduling of an appointment up to 2 times. The other party MUST accept or reject the reschedule request. If rescheduled_count reaches 2 and another reschedule is attempted, the system MUST force cancellation with penalty.

**Requirements:**
- System MUST allow POST /api/appointments/{id}/request-reschedule
- System MUST validate requester is client OR professional of the appointment
- System MUST validate appointment status='scheduled' (cannot reschedule in_progress/completed/cancelled)
- System MUST validate rescheduled_count < 2
- System MUST accept: new_date, new_time, reason (optional)
- System MUST create reschedule_request record (status='pending')
- System MUST send push notification to other party with "Aceptar" / "Rechazar" actions
- System MUST handle accept: update scheduled_date, scheduled_time, increment rescheduled_count
- System MUST handle reject: delete reschedule_request, notify requester
- System MUST show warning if rescheduled_count=2: "Última reprogramación permitida"
- System MUST block reschedule if rescheduled_count=2, show "Cancelar con penalización" option

**Scenarios:**

```gherkin
Scenario: Client requests first reschedule
  Given appointment ID 7 has:
    - scheduled_date: '2026-03-25'
    - scheduled_time: '14:00'
    - rescheduled_count: 0
    - status: 'scheduled'
  When client sends POST /api/appointments/7/request-reschedule with:
    {
      "newDate": "2026-03-26",
      "newTime": "10:00",
      "reason": "Tengo reunión de trabajo ese día"
    }
  Then system validates rescheduled_count=0 < 2 (ALLOWED)
  And creates reschedule_request:
    {
      "id": 1,
      "appointment_id": 7,
      "requester_id": 1, // client
      "new_date": "2026-03-26",
      "new_time": "10:00",
      "reason": "Tengo reunión...",
      "status": "pending"
    }
  And sends push to professional:
    {
      "title": "📅 Solicitud de reprogramación",
      "body": "Cliente quiere cambiar trabajo al 26/03 a las 10:00. Motivo: Tengo reunión...",
      "actions": [
        { "id": "accept", "title": "Aceptar" },
        { "id": "reject", "title": "Rechazar" }
      ],
      "data": { "rescheduleRequestId": 1 }
    }
  And returns 201 Created: { "rescheduleRequestId": 1, "status": "pending" }

Scenario: Professional accepts reschedule
  Given reschedule_request ID 1 exists (status='pending')
  When professional sends POST /api/reschedule-requests/1/accept
  Then system validates professional is recipient
  And updates appointment:
    {
      "scheduled_date": "2026-03-26",
      "scheduled_time": "10:00",
      "rescheduled_count": 1,
      "last_reschedule_reason": "Tengo reunión..."
    }
  And updates appointment_confirmation.auto_release_date = new_date + 7 days
  And updates reschedule_request.status='accepted'
  And sends push to client:
    { "title": "✅ Reprogramación aceptada", "body": "Trabajo movido al 26/03 a las 10:00." }
  And returns 200 OK

Scenario: Professional rejects reschedule
  Given reschedule_request ID 1 pending
  When professional sends POST /api/reschedule-requests/1/reject with:
    { "reason": "No puedo ese día, tengo otro trabajo" }
  Then system updates reschedule_request.status='rejected'
  And sends push to client:
    {
      "title": "❌ Reprogramación rechazada",
      "body": "Profesional no puede el 26/03. Motivo: No puedo ese día..."
    }
  And appointment remains with original date

Scenario: Second reschedule (last allowed)
  Given appointment rescheduled_count=1
  When client requests second reschedule
  Then system validates rescheduled_count=1 < 2 (ALLOWED)
  And creates reschedule_request
  And shows warning in UI: "⚠️ Última reprogramación permitida. Siguiente cambio requerirá cancelación con penalización 15%."

Scenario: Third reschedule blocked (force cancel)
  Given appointment rescheduled_count=2
  When client tries to request reschedule
  Then system returns 400 Bad Request:
    {
      "error": "Maximum reschedules reached (2/2). To change date again, you must cancel the appointment (15% penalty applies).",
      "action": "cancel_with_penalty"
    }
  And UI shows only "Cancelar trabajo" button (penalty warning visible)

Scenario: Cannot reschedule completed appointment
  Given appointment status='completed'
  When user requests reschedule
  Then returns 400 Bad Request: { "error": "Cannot reschedule completed appointment" }
```

---

### FR-009: Cancelaciones con Penalty (15%)

**Description:**  
Either party MUST be able to cancel an appointment. If rescheduled_count >= 2, a 15% penalty of the payment amount applies. The penalty goes to the non-cancelling party. If rescheduled_count < 2, cancellation is penalty-free.

**Requirements:**
- System MUST allow POST /api/appointments/{id}/cancel
- System MUST accept: cancellation_reason (required)
- System MUST check if rescheduled_count >= 2 OR scheduled_date < 12 hours away
- System MUST calculate penalty_amount = amount * 0.15 if penalty applies
- System MUST update payment:
  - If client cancels: payout penalty to professional, refund (amount - penalty) to client
  - If professional cancels: refund (amount - penalty) to client, penalty kept by platform OR donated
- System MUST update appointment status to 'cancelled_by_client' OR 'cancelled_by_professional'
- System MUST set appointment.penalty_applied=TRUE if penalty charged
- System MUST send push notifications to both parties
- System MUST trigger refund API call (MercadoPago)
- System MUST create refund record in database

**Scenarios:**

```gherkin
Scenario: Client cancels penalty-free (first reschedule)
  Given appointment ID 8 has:
    - rescheduled_count: 1 (<2, no penalty)
    - amount: 5000.00
    - scheduled_date: '2026-03-30' (5 days away, >12 hours)
  When client sends POST /api/appointments/8/cancel with:
    { "reason": "Ya no necesito el servicio" }
  Then system checks rescheduled_count=1 < 2 (NO PENALTY)
  And scheduled_date - NOW() = 5 days (>12 hours, NO PENALTY)
  And updates appointment:
    {
      "status": "cancelled_by_client",
      "cancellation_reason": "Ya no necesito...",
      "cancelled_by": "client",
      "penalty_applied": false
    }
  And initiates full refund to client:
    - Calls MercadoPago POST /v1/payments/{mpPaymentId}/refunds
    - amount: 5000.00 (total)
  And creates refund record:
    {
      "payment_id": "550e8400...",
      "amount": 5000.00,
      "reason": "cancellation_early",
      "status": "pending"
    }
  And sends push to professional:
    { "title": "❌ Trabajo cancelado", "body": "Cliente canceló sin penalización." }
  And returns 200 OK

Scenario: Client cancels with penalty (after 2 reschedules)
  Given appointment rescheduled_count=2 (max reached)
  And amount=5000.00
  When client cancels
  Then system applies penalty:
    - penalty_amount = 5000 * 0.15 = 750.00
    - refund_amount = 5000 - 750 = 4250.00
  And updates appointment:
    {
      "status": "cancelled_by_client",
      "penalty_applied": true
    }
  And updates payment:
    { "penalty_amount": 750.00, "penalty_reason": "cancelled_by_client" }
  And initiates partial refund to client:
    - amount: 4250.00
  And initiates payout to professional:
    - amount: 750.00 (penalty compensation)
  And sends push to client:
    {
      "title": "⚠️ Trabajo cancelado con penalización",
      "body": "Reembolso: ARS 4,250 (15% penalización aplicada: ARS 750)"
    }
  And sends push to professional:
    { "title": "💰 Compensación por cancelación", "body": "Recibirás ARS 750 por cancelación del cliente." }

Scenario: Professional cancels with penalty
  Given appointment rescheduled_count=2
  And amount=5000.00, net_amount=4500.00 (10% commission)
  When professional cancels
  Then penalty_amount = 5000 * 0.15 = 750.00
  And refunds to client:
    - amount: 5000 - 750 = 4250.00
  And professional forfeits net_amount (does NOT receive payout)
  And penalty 750 goes to platform (or client, configurable)
  And updates appointment:
    {
      "status": "cancelled_by_professional",
      "penalty_applied": true
    }

Scenario: Cancellation <12 hours before (emergency penalty)
  Given scheduled_date='2026-03-25T14:00:00'
  And current time='2026-03-25T03:00:00' (11 hours before)
  And rescheduled_count=0 (normally penalty-free)
  When client cancels
  Then system checks scheduled_date - NOW() = 11 hours (<12 hours)
  And applies penalty (emergency cancellation rule)
  And penalty_amount = 750.00

Scenario: Cannot cancel completed appointment
  Given appointment status='completed'
  When user tries to cancel
  Then returns 400 Bad Request: { "error": "Cannot cancel completed appointment. Report a problem instead." }
```

---

### FR-010: Payout Automation Cronjob

**Description:**  
The system MUST run a cronjob every hour to automatically payout funds to professionals when payment.payout_status='ready' (mutual confirmation completed). The payout MUST occur within 24 hours of confirmation.

**Requirements:**
- System MUST run cronjob every hour (cron: '0 * * * *')
- System MUST query payments WHERE:
  - payout_status='ready'
  - status='completed'
  - payout_at IS NULL
- System MUST update payment.payout_status='processing' (prevent duplicate processing)
- System MUST call MercadoPago Payout API with professional email and net_amount
- System MUST handle success: update payout_status='completed', payout_at=NOW()
- System MUST handle failure: retry 3 times (exponential backoff), then mark payout_status='failed'
- System MUST send push notification to professional on success
- System MUST alert admin via Sentry/email on failure
- System MUST log all payout attempts

**Scenarios:**

```gherkin
Scenario: Successful payout processing
  Given cronjob runs at 14:00
  And payment "550e8400..." has:
    - payout_status: 'ready'
    - status: 'completed'
    - net_amount: 4500.00
    - professional email: "carlos@example.com"
  When cronjob executes
  Then system queries payments (finds payment "550e8400...")
  And updates payout_status='processing'
  And calls MercadoPago POST /v1/money_requests with:
    {
      "amount": 4500.00,
      "email": "carlos@example.com",
      "concept": "Pago por trabajo completado - QuickFixU",
      "currency_id": "ARS"
    }
  And MercadoPago responds 201 Created (success)
  And updates payment:
    {
      "payout_status": "completed",
      "payout_at": NOW()
    }
  And sends push to professional:
    {
      "title": "💸 Pago liberado",
      "body": "Recibiste ARS 4,500 por trabajo completado. Llegará a tu cuenta en 1-2 días hábiles."
    }
  And logs: "Payout successful for payment 550e8400..."

Scenario: Payout failure - retry
  Given MP Payout API returns 500 Internal Server Error
  When cronjob attempts payout
  Then catches error
  And retries after 1 minute (attempt 2/3)
  And if fails again, retries after 2 minutes (attempt 3/3)
  And if all 3 attempts fail:
    - Updates payout_status='failed'
    - Logs error to Sentry with payment details
    - Sends alert to admin email: "URGENT: Payout failed for payment 550e8400... - Manual intervention required"
  And professional does NOT receive payment (admin resolves manually)

Scenario: Payout to invalid account
  Given professional email is invalid or account suspended
  When MP rejects payout with 400 Bad Request: "Invalid recipient"
  Then updates payout_status='failed'
  And alerts admin: "Payout failed - Invalid account for professional {id}"
  And admin contacts professional to update account details

Scenario: Multiple payouts in one run
  Given 5 payments are ready for payout
  When cronjob runs
  Then processes all 5 sequentially (not parallel - avoid rate limits)
  And updates each independently
  And sends 5 push notifications
```

---

### FR-011: Cash Payments with Balance Tracking

**Description:**  
After the first year (commission-free period), professionals MUST be able to accept cash payments from clients. The system MUST track the commission owed in a balance table (negative balance = debt). At the end of each month, the system MUST charge the professional's registered credit card for the accumulated debt.

**Requirements:**
- System MUST allow POST /api/payments/create-cash-payment (only if professional has card)
- System MUST validate professional.credit_card_token is NOT NULL
- System MUST create payment with payment_method='cash', status='pending'
- System MUST create appointment immediately (no webhook wait)
- System MUST update balance when work is confirmed:
  - balance.balance -= commission_amount (becomes negative)
- System MUST run monthly cronjob on day 1 at 2:00 AM
- System MUST query balances WHERE balance < 0 (debts)
- System MUST charge professional's card via MercadoPago
- System MUST handle charge success: update balance=0, last_settlement_date=NOW()
- System MUST handle charge failure: notify professional, block new work acceptance
- System MUST enforce debt limit: max ARS 20,000 (block if exceeded)

**Scenarios:**

```gherkin
Scenario: Client selects cash payment
  Given proposal ID 15 accepted, price=3000.00
  And professional has credit_card_token="tok_xyz"
  When client sends POST /api/payments/create-cash-payment with { proposalId: 15 }
  Then system validates professional has card (success)
  And calculates commission:
    - commission_percentage: 10% (default, >1 year)
    - commission_amount: 300.00
    - net_amount: 2700.00
  And creates payment:
    {
      "payment_method": "cash",
      "status": "pending",
      "amount": 3000.00,
      "commission_amount": 300.00,
      "net_amount": 2700.00
    }
  And creates appointment immediately (status='scheduled')
  And sends push to professional:
    { "title": "💵 Trabajo agendado - Pago en efectivo", "body": "Cliente pagará en efectivo. Comisión 10% (ARS 300) se descontará de tu saldo." }

Scenario: Both parties confirm cash work - update balance
  Given cash payment with commission_amount=300.00
  And professional_id=5 balance=0 initially
  When both confirm work (mutual confirmation)
  Then system updates payment.status='completed'
  And updates balance:
    {
      "professional_id": 5,
      "balance": -300.00 // deuda comisión
    }
  And sends notification to professional:
    { "body": "Saldo actual: -ARS 300. Se cobrará automáticamente fin de mes." }

Scenario: Monthly settlement - charge card
  Given today is 2026-04-01 at 02:00 AM (day 1 of month)
  And professional ID 5 has balance=-1500.00 (debt from 5 cash jobs)
  And has credit_card_token="tok_xyz"
  When monthly settlement cronjob runs
  Then system finds balance=-1500 (debt)
  And charges card via MercadoPago:
    {
      "transaction_amount": 1500.00,
      "token": "tok_xyz",
      "description": "Cobro comisiones QuickFixU - Marzo 2026"
    }
  And MP responds 201 Created (approved)
  And updates balance:
    {
      "balance": 0.00,
      "last_settlement_date": NOW(),
      "last_settlement_amount": 1500.00
    }
  And sends push:
    { "title": "💳 Cobro comisiones", "body": "Se cobró ARS 1,500 de comisiones acumuladas. Saldo: ARS 0." }

Scenario: Monthly charge fails - block professional
  Given balance=-1500, card charge fails (insufficient funds)
  When settlement cronjob attempts charge
  Then MP returns 402 Payment Required
  And balance remains -1500.00
  And updates professional.blocked=true
  And sends push:
    {
      "title": "⚠️ Cobro rechazado",
      "body": "No pudimos cobrar ARS 1,500 de comisiones. Actualiza tu tarjeta para seguir aceptando trabajos."
    }
  And sends email with payment link
  And professional cannot accept new proposals until balance cleared

Scenario: Debt limit exceeded
  Given professional balance=-18000
  When new cash job adds commission=3000 (total would be -21000)
  Then system checks -18000 - 3000 = -21000 < -20000 (LIMIT EXCEEDED)
  And returns 400 Bad Request:
    {
      "error": "Debt limit exceeded. Current debt: ARS 18,000. Maximum allowed: ARS 20,000. Clear your balance before accepting more cash jobs."
    }

Scenario: Professional without card tries cash payment
  Given professional credit_card_token=NULL
  When client selects cash payment
  Then system returns 400 Bad Request:
    { "error": "Professional must register a credit card to accept cash payments." }
```

---

### FR-012: Disputes Reporting (Preparación Fase 6)

**Description:**  
Either party MUST be able to report a problem with an appointment within 48 hours after scheduled_date. The system MUST block automatic payout, create a dispute record, and notify admin for manual resolution. Full mediation UI is implemented in Fase 6.

**Requirements:**
- System MUST allow POST /api/appointments/{id}/report-problem within 48 hours
- System MUST accept: reason (text), evidence_urls (optional array of image URLs)
- System MUST validate reporter is client OR professional
- System MUST validate scheduled_date + 48 hours > NOW()
- System MUST update payment.status='disputed'
- System MUST block payout (even if both confirmed)
- System MUST create dispute record with status='open'
- System MUST send push to other party
- System MUST send alert to admin (Sentry + email with dispute details)
- System MUST disable "Confirmar trabajo" buttons (UI shows "En disputa")

**Scenarios:**

```gherkin
Scenario: Client reports problem within 48h
  Given appointment ID 12 has:
    - scheduled_date: '2026-03-20T14:00:00' (2 days ago)
    - status: 'scheduled'
    - professional confirmed, client has NOT confirmed yet
  And current time: '2026-03-22T10:00:00' (within 48h window)
  When client sends POST /api/appointments/12/report-problem with:
    {
      "reason": "El profesional no vino a la cita. No respondió llamadas.",
      "evidenceUrls": []
    }
  Then system validates scheduled_date + 48h = '2026-03-22T14:00:00' > NOW() (ALLOWED)
  And creates dispute:
    {
      "id": 1,
      "appointment_id": 12,
      "reporter_id": 1, // client
      "reason": "El profesional no vino...",
      "evidence_urls": [],
      "status": "open",
      "created_at": NOW()
    }
  And updates payment.status='disputed'
  And sends push to professional:
    {
      "title": "⚠️ Cliente reportó un problema",
      "body": "El trabajo está en disputa. Soporte se contactará en 48 horas.",
      "data": { "disputeId": 1 }
    }
  And sends alert to admin:
    - Sentry event: "New dispute #1 - Appointment 12"
    - Email to support@quickfixu.com: "Cliente reportó: El profesional no vino..."
  And returns 201 Created: { "disputeId": 1, "status": "open" }

Scenario: Professional reports problem with evidence
  Given appointment 13 completed
  When professional reports within 48h with:
    {
      "reason": "Cliente no pagó en efectivo como acordamos",
      "evidenceUrls": ["https://cloudinary.com/foto-chat.jpg"]
    }
  Then creates dispute with evidence_urls array
  And admin receives notification with link to evidence

Scenario: Report after 48h deadline
  Given scheduled_date: '2026-03-15T14:00:00'
  And current time: '2026-03-18T15:00:00' (3 days + 1 hour later, >48h)
  When client tries to report problem
  Then system validates scheduled_date + 48h = '2026-03-17T14:00:00' < NOW() (EXPIRED)
  And returns 400 Bad Request:
    {
      "error": "Reporting deadline expired (48 hours after scheduled date). Contact support directly."
    }

Scenario: Dispute blocks payout
  Given both parties confirmed work (payout_status='ready')
  When client reports problem
  Then payment.status changes to 'disputed'
  And payout cronjob skips this payment (WHERE status='completed' excludes disputed)
  And professional does NOT receive payout until dispute resolved

Scenario: Cannot confirm while disputed
  Given appointment has open dispute
  When client tries to send POST /api/appointments/{id}/confirm-client
  Then returns 400 Bad Request:
    { "error": "Cannot confirm. Appointment is under dispute." }
```

---

## 3. Non-Functional Requirements

### NFR-001: Security - PCI Compliance

**Description:**  
The system MUST comply with PCI-DSS Level 4 requirements (for transaction volumes <1M/year) by using MercadoPago Checkout Pro. The system MUST NOT store, process, or transmit raw credit card data.

**Requirements:**
- System MUST use Checkout Pro (redirect to MP webview) to avoid handling card data
- System MUST store only: mercadopago_payment_id, credit_card_token (MP-provided tokens)
- System MUST NEVER log or expose credit card numbers, CVV, expiration dates
- System MUST use HTTPS for all payment-related endpoints (TLS 1.2+)
- System MUST validate webhook signatures (HMAC-SHA256) to prevent unauthorized access
- System MUST use environment variables for MP credentials (NEVER hardcode keys)
- System MUST separate sandbox and production credentials (feature flag)

**Acceptance Criteria:**
- ✅ No raw card data stored in database (audit query confirms)
- ✅ All payment endpoints use HTTPS (test with HTTP request → 301 redirect)
- ✅ Webhook signature validation active (forged webhook test → 401 Unauthorized)
- ✅ MP credentials in .env (code review confirms no hardcoded keys)

---

### NFR-002: Performance - Webhook Latency

**Description:**  
Webhook processing MUST complete in <500ms (p95) to ensure MercadoPago does not timeout and retry excessively.

**Requirements:**
- System MUST respond 200 OK to webhook within 500ms (p95)
- System MUST use async processing for heavy operations (payout, notifications)
- System MUST index payments.mercadopago_payment_id for fast lookups
- System MUST use database connection pooling (max 20 connections)
- System MUST implement webhook queue if processing >100 webhooks/minute

**Acceptance Criteria:**
- ✅ p95 webhook latency <500ms (load test: 100 webhooks/min)
- ✅ No webhook timeouts in MP dashboard (0% retry rate)

---

### NFR-003: Reliability - Payout Success Rate

**Description:**  
Automatic payout success rate MUST be >98% to ensure professionals receive payments reliably.

**Requirements:**
- System MUST retry failed payouts 3 times (exponential backoff: 1min, 2min, 5min)
- System MUST alert admin after 3 failures (Sentry + email)
- System MUST log all payout attempts with timestamps, amounts, errors
- System MUST implement circuit breaker if MP API fails >10 times/hour
- System MUST provide admin UI to manually retry failed payouts (Fase 6)

**Acceptance Criteria:**
- ✅ Payout success rate >98% over 30 days (metrics dashboard)
- ✅ Failed payouts resolved within 24 hours (admin SLA)

---

### NFR-004: Data Integrity - AFIP Compliance Export

**Description:**  
The system MUST generate a monthly CSV export of all completed payments for AFIP (Argentina tax authority) compliance. The export MUST include all required fields for digital income declaration.

**Requirements:**
- System MUST generate CSV on day 1 of each month (cronjob)
- CSV MUST include columns:
  - fecha (date)
  - profesional_dni (professional tax ID)
  - monto_bruto (gross amount)
  - comision (commission amount)
  - monto_neto (net amount paid to professional)
  - metodo_pago (mercadopago | cash)
  - mercadopago_payment_id (if applicable)
- System MUST store soft-deleted payments for 10 years (legal requirement)
- System MUST upload CSV to secure S3 bucket (encrypted at rest)
- System MUST send download link to accounting team via email

**Acceptance Criteria:**
- ✅ CSV generated automatically first day of month
- ✅ All completed payments from previous month included (0% missing)
- ✅ Soft-deleted payments retained >10 years (database policy)

---

### NFR-005: Idempotency - Duplicate Webhook Handling

**Description:**  
The system MUST handle duplicate webhooks gracefully without creating duplicate payments, appointments, or payouts.

**Requirements:**
- System MUST use UNIQUE INDEX on payments.mercadopago_payment_id
- System MUST use upsert (INSERT ... ON CONFLICT DO UPDATE) for payment updates
- System MUST check if appointment exists before creating (WHERE payment_id)
- System MUST check if payout already completed (WHERE payout_at IS NOT NULL)
- System MUST use idempotent message IDs for push notifications (avoid duplicate alerts)

**Acceptance Criteria:**
- ✅ Send same webhook 5 times → only 1 payment record created
- ✅ Send payment completed webhook 3 times → only 1 appointment created
- ✅ No duplicate payouts (database constraint prevents)

---

### NFR-006: Auditability - Complete Transaction Log

**Description:**  
Every payment state transition MUST be logged with timestamp, user, reason, and old/new values for audit and dispute resolution.

**Requirements:**
- System MUST log to Winston (file + Sentry) for all payment operations:
  - Payment created
  - Webhook received
  - Status changed
  - Payout initiated
  - Refund processed
  - Dispute created
- System MUST include in logs:
  - timestamp (ISO 8601)
  - payment_id
  - user_id (if applicable)
  - action (created | updated | disputed | refunded | payout)
  - old_status → new_status
  - ip_address (for webhooks)
- System MUST retain logs for 2 years (compliance requirement)

**Acceptance Criteria:**
- ✅ All payment transitions logged (sample 100 payments → 100% coverage)
- ✅ Logs searchable by payment_id in Sentry (test query: payment_id=xxx)

---

## 4. Database Schema Changes

### New Tables

```sql
-- Migration: 20260322_create_payments_table
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id INTEGER NOT NULL REFERENCES proposals(id) ON DELETE RESTRICT,
  client_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  professional_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  
  amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
  commission_percentage DECIMAL(5,2) NOT NULL CHECK (commission_percentage >= 0 AND commission_percentage <= 100),
  commission_amount DECIMAL(10,2) NOT NULL CHECK (commission_amount >= 0),
  net_amount DECIMAL(10,2) NOT NULL CHECK (net_amount >= 0),
  penalty_amount DECIMAL(10,2) DEFAULT 0 CHECK (penalty_amount >= 0),
  penalty_reason VARCHAR(100),
  
  payment_method VARCHAR(20) NOT NULL CHECK (payment_method IN ('mercadopago', 'cash')),
  mercadopago_payment_id VARCHAR(100) UNIQUE,
  currency VARCHAR(3) DEFAULT 'ARS',
  
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'refunded', 'disputed')),
  payout_status VARCHAR(20) DEFAULT 'pending' CHECK (payout_status IN ('pending', 'ready', 'processing', 'completed', 'failed')),
  payout_at TIMESTAMP,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_payments_proposal_id ON payments(proposal_id);
CREATE INDEX idx_payments_mercadopago_payment_id ON payments(mercadopago_payment_id) WHERE mercadopago_payment_id IS NOT NULL;
CREATE INDEX idx_payments_payout_status ON payments(payout_status) WHERE payout_status IN ('ready', 'processing');

-- Migration: 20260322_create_appointments_table
CREATE TABLE appointments (
  id SERIAL PRIMARY KEY,
  proposal_id INTEGER UNIQUE NOT NULL REFERENCES proposals(id) ON DELETE RESTRICT,
  payment_id UUID UNIQUE NOT NULL REFERENCES payments(id) ON DELETE RESTRICT,
  
  scheduled_date DATE NOT NULL,
  scheduled_time TIME NOT NULL,
  
  status VARCHAR(30) NOT NULL DEFAULT 'scheduled' CHECK (
    status IN ('scheduled', 'in_progress', 'completed', 'cancelled_by_client', 'cancelled_by_professional')
  ),
  
  rescheduled_count INTEGER NOT NULL DEFAULT 0 CHECK (rescheduled_count <= 2),
  last_reschedule_reason TEXT,
  
  cancellation_reason TEXT,
  cancelled_by VARCHAR(20) CHECK (cancelled_by IN ('client', 'professional')),
  penalty_applied BOOLEAN DEFAULT FALSE,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_appointments_scheduled_date ON appointments(scheduled_date);

-- Migration: 20260322_create_appointment_confirmations_table
CREATE TABLE appointment_confirmations (
  id SERIAL PRIMARY KEY,
  appointment_id INTEGER UNIQUE NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  
  client_confirmed BOOLEAN DEFAULT FALSE,
  client_confirmed_at TIMESTAMP,
  professional_confirmed BOOLEAN DEFAULT FALSE,
  professional_confirmed_at TIMESTAMP,
  
  auto_release_date TIMESTAMP NOT NULL,
  auto_released BOOLEAN DEFAULT FALSE,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_appt_confirmations_auto_release ON appointment_confirmations(auto_release_date) WHERE client_confirmed = FALSE;

-- Trigger: Mutual confirmation → payout ready
CREATE OR REPLACE FUNCTION handle_mutual_confirmation()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.client_confirmed = TRUE AND NEW.professional_confirmed = TRUE THEN
    UPDATE payments
    SET payout_status = 'ready', updated_at = NOW()
    WHERE id = (SELECT payment_id FROM appointments WHERE id = NEW.appointment_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_mutual_confirmation
AFTER UPDATE ON appointment_confirmations
FOR EACH ROW
WHEN (NEW.client_confirmed = TRUE AND NEW.professional_confirmed = TRUE)
EXECUTE FUNCTION handle_mutual_confirmation();

-- Migration: 20260322_create_balances_table
CREATE TABLE balances (
  id SERIAL PRIMARY KEY,
  professional_id INTEGER UNIQUE NOT NULL REFERENCES professionals(id) ON DELETE RESTRICT,
  
  balance DECIMAL(10,2) NOT NULL DEFAULT 0,
  last_settlement_date TIMESTAMP,
  last_settlement_amount DECIMAL(10,2),
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_balances_balance ON balances(balance) WHERE balance < 0;

-- Migration: 20260322_create_disputes_table
CREATE TABLE disputes (
  id SERIAL PRIMARY KEY,
  appointment_id INTEGER NOT NULL REFERENCES appointments(id) ON DELETE RESTRICT,
  reporter_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  
  reason TEXT NOT NULL,
  evidence_urls TEXT[],
  
  status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'investigating', 'resolved_refund', 'resolved_payout', 'resolved_split', 'closed_no_action')),
  admin_notes TEXT,
  resolved_at TIMESTAMP,
  resolution_reason TEXT,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_disputes_status ON disputes(status) WHERE status IN ('open', 'investigating');

-- Migration: 20260322_create_refunds_table
CREATE TABLE refunds (
  id SERIAL PRIMARY KEY,
  payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE RESTRICT,
  
  amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
  reason VARCHAR(100) NOT NULL,
  mercadopago_refund_id VARCHAR(100) UNIQUE,
  
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
  
  created_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP
);

CREATE INDEX idx_refunds_payment_id ON refunds(payment_id);
```

---

## 5. API Endpoints Summary

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | /api/payments/create-preference | Create MP preference for proposal | Client |
| POST | /api/payments/create-cash-payment | Create cash payment (requires card) | Client |
| POST | /webhooks/mercadopago | Receive MP IPN webhooks | Public (signature verified) |
| POST | /api/appointments/:id/confirm-client | Client confirms work done | Client |
| POST | /api/appointments/:id/confirm-professional | Professional confirms work done | Professional |
| POST | /api/appointments/:id/request-reschedule | Request date/time change | Client/Professional |
| POST | /api/reschedule-requests/:id/accept | Accept reschedule request | Client/Professional |
| POST | /api/reschedule-requests/:id/reject | Reject reschedule request | Client/Professional |
| POST | /api/appointments/:id/cancel | Cancel appointment (penalty rules apply) | Client/Professional |
| POST | /api/appointments/:id/report-problem | Report dispute (block payout) | Client/Professional |
| GET | /api/payments/:id | Get payment details | Client/Professional |
| GET | /api/appointments/:id | Get appointment details | Client/Professional |
| POST | /admin/appointments/:id/extend-timeout | Extend auto-release deadline (admin only) | Admin |
| POST | /admin/payouts/:id/retry | Manually retry failed payout (admin only) | Admin |
| GET | /admin/afip-export/:month | Download monthly AFIP CSV | Admin |

---

## 6. Cronjobs

| Schedule | Description | Query |
|----------|-------------|-------|
| `0 * * * *` (hourly) | Process pending payouts | `WHERE payout_status='ready' AND status='completed'` |
| `0 3 * * *` (daily 3am) | Auto-release timeout confirmations | `WHERE auto_release_date <= NOW() AND client_confirmed=FALSE` |
| `0 2 1 * *` (monthly, day 1) | Settle balances (charge cards) | `WHERE balance < 0` |
| `0 8 * * *` (daily 8am) | Send preventive notifications (days 5,6,7) | `WHERE auto_release_date BETWEEN NOW() AND NOW() + 3 days` |
| `0 4 1 * *` (monthly, day 1) | Generate AFIP export CSV | `WHERE status='completed' AND created_at BETWEEN <last_month>` |

---

## 7. Testing Requirements

### Unit Tests
- Commission calculation logic (0%, 10%, 50% scenarios)
- HMAC-SHA256 signature verification
- Payment status mapping (MP status → our status)
- Penalty calculation (15% of amount)
- Balance update logic (cash payments)

### Integration Tests
- MercadoPago preference creation (sandbox)
- Webhook handler end-to-end (forged signature rejected, valid signature accepted)
- Appointment creation on payment completed
- Mutual confirmation trigger (payout_status='ready')
- Reschedule request flow (request → accept/reject)
- Cancellation with penalty (refund + payout calculation)
- Payout cronjob (sandbox money_request)

### E2E Tests
1. **Happy path:** Create preference → pay in sandbox → webhook → appointment created → both confirm → payout automated
2. **Reschedule:** Request reschedule → accept → date updated → rescheduled_count incremented
3. **Cancellation:** Third reschedule attempt → blocked → force cancel with penalty → refund partial
4. **Cash payment:** Create cash payment → confirm work → balance updated → monthly settlement
5. **Dispute:** Report problem → payout blocked → admin notified
6. **Auto-release:** Timeout expires → client auto-confirmed → payout ready

### Load Tests
- 100 concurrent webhooks/minute → p95 latency <500ms
- 1000 payments created in 1 hour → no database locks

---

## 8. Security Checklist

- [ ] HTTPS enforced on all payment endpoints (TLS 1.2+)
- [ ] MP credentials in environment variables (not hardcoded)
- [ ] Webhook signature verification active (HMAC-SHA256)
- [ ] No raw card data stored (only tokens)
- [ ] SQL injection prevention (parameterized queries)
- [ ] Rate limiting on payment creation (10 payments/hour/user)
- [ ] Admin endpoints require admin role (JWT validation)
- [ ] Logs do NOT contain sensitive data (card numbers, secrets)
- [ ] Sandbox/production credentials separated (feature flag)
- [ ] Database backups encrypted at rest

---

## 9. Rollout Plan

### Phase 1: Backend Core (Week 1-2)
- Implement payments table + migrations
- MercadoPago preference creation API
- Webhook handler with signature verification
- Appointment auto-creation logic
- Unit tests + integration tests (sandbox)

### Phase 2: Confirmations & Escrow (Week 3)
- Mutual confirmation endpoints
- Database trigger for payout_status='ready'
- Payout cronjob (hourly)
- Auto-release timeout cronjob (daily)
- Notification system integration

### Phase 3: Reprogramaciones & Cancelaciones (Week 4)
- Reschedule request flow
- Cancellation with penalty logic
- Refund API integration
- E2E tests

### Phase 4: Cash Payments & Balances (Week 5)
- Cash payment creation
- Balance tracking table
- Monthly settlement cronjob
- Debt limit enforcement

### Phase 5: Disputes & Admin Tools (Week 6)
- Dispute reporting endpoint
- Admin retry payout UI (basic)
- AFIP CSV export cronjob
- Security audit + penetration testing

### Phase 6: Production Deploy (Week 7)
- Sandbox → production credential switch (feature flag)
- Database migration in production (zero-downtime)
- Monitor Sentry for errors (first 48 hours)
- Gradual rollout (10% users → 50% → 100%)

---

## 10. Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Payment success rate | >95% | MP approved / total attempts |
| Webhook latency p95 | <500ms | CloudWatch logs |
| Payout success rate | >98% | Completed / total ready |
| Dispute rate | <5% | Disputes / total appointments |
| Auto-release rate | <20% | Auto-released / total confirmed |
| Commission collection | >90% | Monthly settlements / total owed |

---

**End of Specification**
