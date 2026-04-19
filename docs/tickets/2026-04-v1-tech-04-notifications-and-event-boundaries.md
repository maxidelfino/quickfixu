# Ticket: Notifications and event boundaries for marketplace-only V1

- **Date:** 2026-04-18
- **Status:** Aligned
- **Type:** Technical Alignment / Data Flow / Notifications

## Context

Historical phase docs, especially under phases 6 and 7, still contain notification/event models centered on payment confirmation, escrow release, payouts, refunds, and dispute outcomes. Those flows are now wrong for active V1, but they are detailed enough that they could accidentally drive implementation.

At the same time, V1 still needs meaningful notifications and event triggers for discovery, proposals, coordination, completion confirmation, and reviews.

## Goal

Redefine the notification/event surface around marketplace coordination events only, so future backend/mobile work has a clean source of truth for non-payment triggers.

## Scope

- Inventory payment-driven notification/event assumptions in historical docs.
- Define the marketplace-only event set that is actually relevant to V1.
- Clarify which events are product-critical now versus deferrable.
- Map each approved event to likely owners (backend domain event, notification preference, mobile deep link/state).
- Identify any status transitions that need explicit notification support.

## Out of Scope

- Implementing push notifications, cron jobs, or message brokers.
- Designing admin moderation event systems.
- Reworking historical phases beyond superseded notes and alignment guidance.

## Suggested Files / Areas to Inspect

- `docs/phases/fase-6/fase-6-spec.md`
- `docs/phases/fase-6/fase-6-design.md`
- `docs/phases/fase-7/fase-7-spec.md`
- `docs/phases/fase-7/fase-7-design.md`
- `docs/FunctionalFlow.md`
- `docs/database/DataModel.md`
- `mobile/src/navigation/`
- `mobile/src/screens/MessagesScreen.tsx`

## Acceptance Criteria

- A V1-approved notification/event list exists without payment, escrow, payout, refund, or commission triggers.
- The approved list covers at least proposal activity, coordination activity, completion confirmation, review prompts, and trust/verification signals when relevant.
- Payment-oriented historical triggers are explicitly marked as non-authoritative for current V1.
- Future implementation has a clear boundary between domain events and optional notification delivery.
- The alignment output is small enough for a two-developer team to use directly.

## Alignment Result

### Active alignment artifacts

- `docs/backend/V1NotificationEventBoundaries.md`
- `docs/database/DataModel.md` (notifications section aligned to marketplace-only V1)

### Approved V1 notification/event categories

**Core now**

- Proposal activity: `proposal_received`, `proposal_status_changed`
- Coordination activity: `message_received`, `appointment_scheduled`, `appointment_updated`, `appointment_cancelled`
- Completion flow: `completion_confirmation_requested`, `completion_confirmed`
- Review/trust: `review_received`, `certification_status_changed`

**Valid for V1 but later/optional**

- `appointment_reminder_24h`
- `appointment_reminder_1h`
- `review_reminder`
- `proposal_expiring`
- `request_expiring`
- `new_request_match`
- `new_professional_in_area`

### Explicitly excluded / superseded categories

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
- `dispute_resolved` when it represents refund/payout/settlement outcomes
- `commission_charged`
- `commission_settled`
- `wallet_balance_changed`
- `stored_payment_method_expiring`
- `invoice_due`

### Historical mismatch summary

- `docs/phases/fase-7/fase-7-spec.md` and `docs/phases/fase-7/fase-7-design.md` still contain payout/payment-oriented notification enums and cron assumptions.
- `docs/phases/fase-6/*` still contains admin notifications tied to refund/payout/dispute-payment flows.
- Those flows remain historical only and must not drive active V1 event names or delivery planning.

### Handoff after tech-04

1. Use `docs/backend/V1NotificationEventBoundaries.md` as the canonical event list for any backend/mobile notification work.
2. If a notifications table or API is implemented, keep it lightweight and aligned to marketplace event families only.
3. Defer push transport, cron reminders, and notification preferences until the core request/proposal/appointment/review loop exists.
4. Reject any new V1 ticket that reintroduces payment, escrow, payout, refund, or settlement notification types.
