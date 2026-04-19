# QuickFixU V1 Marketplace Lifecycle Reference

**Status:** Active technical alignment artifact  
**Date:** 2026-04-18  
**Purpose:** Canonical naming, lifecycle states, and schema-alignment handoff for marketplace-only V1

---

## 1. Source of truth

This document operationalizes the living V1 marketplace scope from:

- `docs/PRD.md`
- `docs/FunctionalFlow.md`
- `docs/BusinessCase.md`
- `docs/tickets/2026-04-v1-marketplace-pivot.md`
- `docs/backend/V1BackendContracts.md`
- `docs/backend/V1NotificationEventBoundaries.md`
- `docs/database/DataModel.md`

---

## 2. Canonical naming decisions

| Concern | Canonical term | Transitional / historical alias | Rule |
|---|---|---|---|
| Client-published marketplace need | `request` | `post`, `problem` | Use `request` in schema, DTOs, routes, and status docs. `problem` is allowed only in UX copy. |
| Professional offer/response | `proposal` | none | Keep as-is. |
| Selected work record | `appointment` | `service`, `job`, `booking` | Use `appointment` as the single technical entity. |
| Work completion trust checkpoint | `completion confirmation` | none | Must be explicit on `appointment`, never inferred from payment. |

---

## 3. Current Prisma foundation vs target V1 marketplace delta

### Already present in `backend/prisma/schema.prisma`

- `users`
- `professionals`
- `categories`
- `professional_categories`
- `certifications`
- `refresh_tokens`

### Missing next-core marketplace entities

- `requests`
- `request_categories`
- `request_media`
- `proposals`
- `appointments`
- `chats`
- `messages`
- `reviews`
- optional `notifications` log if the team wants delivery/audit support later

### Explicitly out of target V1 schema

- `payments`
- `payment_records`
- `escrow`
- `payouts`
- `refunds`
- `wallets`
- commission / settlement ledgers

---

## 4. Canonical lifecycle model

### 4.1 Request lifecycle

| Status | Meaning | Allowed next states |
|---|---|---|
| `draft` | Request exists but is not visible yet | `published`, `closed` |
| `published` | Visible and open, no active proposals yet | `receiving_proposals`, `closed`, `expired` |
| `receiving_proposals` | Visible and has at least one active proposal | `in_coordination`, `closed`, `expired` |
| `in_coordination` | A proposal was accepted and an appointment exists | `completed`, `closed` |
| `closed` | Client/system closed the request without completed work | terminal |
| `completed` | Linked appointment reached confirmed completion | terminal |
| `expired` | Proposal window ended without a selected outcome | terminal |

**Notes**
- `completed` should be treated as a business outcome of the linked appointment reaching confirmed completion.
- `closed` is the non-success terminal state for a request; do not overload it with payment outcomes.

### 4.2 Proposal lifecycle

| Status | Meaning | Allowed next states |
|---|---|---|
| `sent` | Proposal was created and delivered | `viewed`, `accepted`, `rejected`, `expired`, `withdrawn` |
| `viewed` | Client opened/read it | `accepted`, `rejected`, `expired`, `withdrawn` |
| `accepted` | Selected proposal; should create appointment | terminal |
| `rejected` | Client explicitly declined it | terminal |
| `expired` | Validity window ended | terminal |
| `withdrawn` | Professional retracted before decision | terminal |

**Notes**
- Proposal monetary data is reference-only. Prefer field names like `priceReference` / `estimatedPrice` in future contracts.
- A proposal is not a payment artifact, invoice, or receivable.

### 4.3 Appointment lifecycle

| Status | Meaning | Allowed next states |
|---|---|---|
| `coordinating` | Proposal accepted; details still being aligned | `scheduled`, `cancelled` |
| `scheduled` | Date/time agreed | `in_progress`, `cancelled` |
| `in_progress` | Work has started | `pending_completion_confirmation`, `cancelled` |
| `pending_completion_confirmation` | Work was performed; waiting for bilateral confirmation | `completed`, `cancelled` |
| `completed` | Both sides confirmed completion | terminal |
| `cancelled` | Appointment was cancelled before completion | terminal |

**Notes**
- `cancelled` uses metadata fields like `cancelledBy` and `cancellationReason`; avoid multiplying terminal statuses by actor.
- Review eligibility opens only after `completed`.

---

## 5. Completion confirmation as first-class concern

### Stored fields

Keep these on `appointments`:

- `client_confirmed_completion_at`
- `professional_confirmed_completion_at`
- `completed_at`

### Derived rules

- `appointment.status = completed` only when both participant confirmation timestamps are non-null.
- `completed_at` is set when the second confirmation arrives.
- `request.status = completed` only when the linked appointment is completed.
- `review` creation is allowed only after `appointments.completed_at` exists.

### Explicit non-rules

Do **not** derive completion from:

- payment received,
- payout released,
- refund absent,
- commission settled,
- any external money event.

---

## 6. Naming/status mismatches identified during tech-02

| Area | Current mismatch | Canonical resolution |
|---|---|---|
| `docs/database/DataModel.md` | Uses `posts` as the core entity | Renamed target concept to `requests` and left `posts` as historical alias only |
| `docs/database/DataModel.md` | Proposal statuses used `pending/cancelled` | Standardized to `sent/viewed/accepted/rejected/expired/withdrawn` |
| `docs/database/DataModel.md` | Appointment cancellation split by status name | Collapsed to one `cancelled` status plus cancellation metadata |
| `docs/database/DataModel.md` | Completion was present but not explicit in stored fields | Added bilateral confirmation timestamps plus `completed_at` |
| Mobile legacy types | `Post` status uses `pending/assigned/completed/cancelled` | Must be aligned later to `Request` vocabulary and lifecycle in tech-03+ |

---

## 7. Immediate handoff for tech-03

Tech-03 should implement the schema/API planning using this exact order:

1. **Schema proposal/migration design**
   - Add `requests`, `request_categories`, `request_media`.
   - Add `proposals` using reference-only pricing fields.
   - Add `appointments` with bilateral completion confirmation fields.

2. **Enum and contract alignment**
   - Encode the canonical statuses from Section 4.
   - Prevent payment-oriented fields from entering Prisma models and DTOs.
   - Align route naming to `/requests`, `/proposals`, `/appointments`, `/reviews`.

3. **Review gating rule**
   - Ensure reviews depend on `appointments.completed_at` / completed state, not on any money event.

4. **Legacy alias cleanup plan**
   - Map legacy frontend/backend `post` references to `request`.
   - Identify where mobile types and service names still require rename or compatibility adapters.

5. **Notification/event alignment**
   - Use `docs/backend/V1NotificationEventBoundaries.md` for any event names tied to proposals, coordination, completion, reviews, or verification.
   - Do not revive payment-driven notification enums from `docs/phases/fase-6/` or `docs/phases/fase-7/`.

### Recommended implementation guardrails

- Do not add payment tables “for later”.
- Do not encode `cancelled_by_client` / `cancelled_by_professional` as separate appointment statuses.
- Do not mark a request as `completed` directly from proposal acceptance.
- Do not allow review creation from `pending_completion_confirmation`.
