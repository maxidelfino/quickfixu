# QuickFixU V1 Notification and Event Boundaries

**Status:** Active technical alignment artifact  
**Date:** 2026-04-18  
**Purpose:** Canonical marketplace-only notification/event guidance for V1

---

## 1. Source of truth

This document operationalizes the active V1 scope from:

- `docs/PRD.md`
- `docs/FunctionalFlow.md`
- `docs/BusinessCase.md`
- `docs/tickets/2026-04-v1-marketplace-pivot.md`
- `docs/backend/V1BackendContracts.md`
- `docs/backend/V1MarketplaceLifecycle.md`
- `docs/database/DataModel.md`

---

## 2. Boundary rules

### Non-negotiable V1 rule

QuickFixU V1 notifications must reflect **marketplace coordination only**.

They may describe:

- discovery context,
- proposal activity,
- coordination/messages,
- appointment scheduling updates,
- completion confirmation,
- reviews,
- verification/certification outcomes.

They must **not** encode a payment lifecycle.

### Domain event vs notification delivery

- A **domain event** is the product/business trigger (`proposal created`, `appointment cancelled`, `completion confirmed`).
- A **notification** is only one possible delivery mechanism for that event.
- V1 should keep the event list clear even if push, cron jobs, email, and message brokers are deferred.
- For the current two-developer team, the safest default is: **define the event, optionally log an in-app notification, keep push/scheduled delivery optional.**

### Delivery posture for current V1

- **Now:** event naming, recipients, deep-link target, and optional in-app/log storage.
- **Later if needed:** FCM push, cron-driven reminders, batching, preference center, message broker fan-out.

---

## 3. Approved V1 event categories

### 3.1 Core now

These are the marketplace events worth supporting first because they mirror the active V1 workflow directly.

| Category | Event key | Trigger | Recipient(s) | Suggested deep link/state | Owner | V1 priority |
|---|---|---|---|---|---|---|
| Proposal activity | `proposal_received` | A professional sends a proposal to a client request | Client | request detail / proposal list | backend domain event + optional notifications log | Now |
| Proposal activity | `proposal_status_changed` | Client accepts or rejects a proposal | Professional | proposal detail / request detail | backend domain event + optional notifications log | Now |
| Coordination activity | `message_received` | A new chat/coordinating message is created | Other participant | chat thread | backend domain event + optional notifications log | Now |
| Coordination activity | `appointment_scheduled` | Coordination reaches an agreed schedule or appointment is first created | Client + professional | appointment detail | backend domain event + optional notifications log | Now |
| Coordination activity | `appointment_updated` | Schedule/location/instructions change materially | Counterpart participant | appointment detail | backend domain event + optional notifications log | Now |
| Coordination activity | `appointment_cancelled` | Appointment is cancelled | Counterpart participant, optionally both for audit | appointment detail / request state | backend domain event + optional notifications log | Now |
| Completion confirmation | `completion_confirmation_requested` | One participant marks work as done and the other still needs to confirm | Counterpart participant | appointment completion screen | backend domain event + optional notifications log | Now |
| Completion confirmation | `completion_confirmed` | Second confirmation arrives and appointment becomes completed | Client + professional | appointment detail / review CTA | backend domain event + optional notifications log | Now |
| Review follow-up | `review_received` | One participant publishes a review about the other | Reviewed participant | profile / review detail | backend domain event + optional notifications log | Now |
| Trust / verification | `certification_status_changed` | Certification is approved or rejected | Professional | verification/certification screen | admin action event + optional notifications log | Now |

### 3.2 Approved for V1, but later/optional

These remain compatible with the marketplace-only model, but they should not block the current implementation batch.

| Category | Event key | Why it is later |
|---|---|---|
| Reminder | `appointment_reminder_24h` | Requires scheduled delivery infrastructure; useful, but not core to alignment. |
| Reminder | `appointment_reminder_1h` | Same reason as above. |
| Review follow-up | `review_reminder` | Depends on delayed/scheduled delivery and review-gap checks. |
| Discovery nudge | `proposal_expiring` | Valid, but depends on expiry jobs and is not essential for first marketplace workflow alignment. |
| Discovery nudge | `request_expiring` | Same as above; keep out of the first implementation slice. |
| Discovery nudge | `new_request_match` | Requires matching/ranking rules that are still evolving. |
| Discovery nudge | `new_professional_in_area` | Valid marketplace alert, but currently closer to growth/marketing than core coordination. |

---

## 4. Explicitly excluded / superseded event categories

The following event families are **not valid for active V1** because they depend on payments, escrow, payouts, refunds, or transaction settlement.

- `payment_confirmed`
- `payment_failed`
- `payment_escrow_held`
- `payment_released`
- `payout_pending`
- `payout_released`
- `payout_forced`
- `refund_created`
- `refund_approved`
- `refund_completed`
- `dispute_resolved` when the resolution means refund/payout/settlement
- `commission_charged`
- `commission_settled`
- `wallet_balance_changed`
- `stored_payment_method_expiring`
- `invoice_due`

If a historical document references one of these, treat that event as **superseded** even if the surrounding notification architecture still looks reusable.

---

## 5. Practical implementation guidance for a two-developer team

### Minimal contract to keep now

If the team adds a notification/event layer in V1, keep each record lightweight:

- `type`
- `userId`
- `entityType`
- `entityId`
- `title`
- `body`
- `data` / deep-link payload
- `read`
- `createdAt`

Avoid introducing now:

- delivery-provider abstractions,
- retry queues,
- scheduled jobs only for notifications,
- separate payout/refund/dispute notification services,
- marketing campaign tooling.

### Recommended first-pass grouping

If type sprawl becomes expensive, group around these category families:

- `proposal_*`
- `message_*`
- `appointment_*`
- `completion_*`
- `review_*`
- `certification_*`

---

## 6. Historical mismatch inventory

The highest-risk historical mismatches found during tech-04 were:

| Historical artifact | Superseded examples |
|---|---|
| `docs/phases/fase-7/fase-7-spec.md` | `payment_released`, `dispute_resolved` tied to payouts/refunds, payout cron checks, payout deep links |
| `docs/phases/fase-7/fase-7-design.md` | `payment_escrow_held`, `payment_released`, `payout_released`, payout reminder jobs, payout/dispute entity deep links |
| `docs/phases/fase-6/*` | admin refund/payout/dispute-resolution notification assumptions |

Those artifacts remain useful only for generic implementation ideas like notification-center UX, read/unread handling, or lightweight log storage.

---

## 7. Immediate handoff after tech-04

The next implementation-oriented work should:

1. Use only the approved categories from Section 3.
2. Treat excluded categories from Section 4 as banned V1 event names.
3. Keep notification delivery optional; do not block marketplace implementation on push infrastructure.
4. If a notification table is added, align `type` values with this document instead of historical phase-7 enums.
5. If preferences are added later, start with only the Section 3 families and skip payment/dispute settings entirely.
