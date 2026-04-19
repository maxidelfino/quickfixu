# Ticket: Appointment lifecycle hardening — invalid transition handling

- **Date:** 2026-04-19
- **Status:** Ready
- **Type:** Implementation / Backend
- **Priority:** P1 — depends on tech-06 schema being present

## Context

After the basic appointment entity is added in tech-06, the state machine transitions need explicit guards to prevent invalid states. Without these guards, the appointment lifecycle described in `docs/backend/V1MarketplaceLifecycle.md` can be violated by buggy clients or race conditions.

## Goal

Ensure the appointment state machine is self-consistent and handles edge cases explicitly, so bad transitions are rejected rather than creating inconsistent state.

## Scope

### Required guards

1. **Invalid transition rejection**
   - `cancelled` is terminal — cannot transition to any other state
   - `completed` is terminal — cannot transition to any other state
   - Cannot go backwards (e.g., `in_progress` → `scheduled` is not allowed)
   - Cannot skip states (e.g., `coordinating` → `completed` without going through `pending_completion_confirmation`)

2. **Cancellation metadata enforcement**
   - When transitioning to `cancelled`, both `cancelled_by` (enum: `client` | `professional` | `system`) and `cancellation_reason` (text) must be provided
   - `cancelled_by` must match the authenticated user making the transition

3. **Dual confirmation enforcement**
   - `client_confirmed_completion_at` can only be set by the client participant
   - `professional_confirmed_completion_at` can only be set by the professional participant
   - `completed_at` is set automatically when the second confirmation arrives (if both are set and `status` is not yet `completed`)
   - Cannot confirm twice (idempotent — setting same confirmation again is a no-op, not an error)

4. **Authorization per transition**
   - Only the client can accept a proposal (creates appointment)
   - Only the assigned professional can update appointment timing/details during `coordinating`
   - Both parties can confirm completion
   - Either party can cancel (with reason)

5. **Reschedule limit stub**
   - Appointment has `rescheduled_count` field (integer, default 0)
   - When a reschedule is requested, increment the count
   - If count >= 2, reject with message that max reschedules are reached
   - This can be stubbed with a comment noting full reschedule-request flow is separate

### Status transitions allowed

| From | Allowed to |
|------|-----------|
| `coordinating` | `scheduled`, `cancelled` |
| `scheduled` | `in_progress`, `cancelled` |
| `in_progress` | `pending_completion_confirmation`, `cancelled` |
| `pending_completion_confirmation` | `completed`, `cancelled` |
| `completed` | (terminal — no transitions) |
| `cancelled` | (terminal — no transitions) |

## Out of Scope

- Full reschedule-request flow (accept/reject of reschedule proposals) — stub the limit check only
- Push notifications on state change — those come after the basic loop exists
- Chat/coupling with the appointment state — chat is separate (tech-08)

## Suggested Files / Areas

- `backend/src/services/appointmentService.ts` — all transition logic centralized here
- `backend/src/routes/appointments.ts` — route handlers call service methods
- `backend/prisma/schema.prisma` — `appointments` model from tech-06

## Acceptance Criteria

1. Attempting an invalid transition returns 400 with a message like "Cannot transition from {current_status} to {requested_status}"
2. Cancelling an appointment without `cancellation_reason` returns 400
3. Client confirming their own completion twice is idempotent (200 on second attempt, no duplicate timestamp)
4. Professional attempting to set `client_confirmed_completion_at` returns 403
5. Transitioning `cancelled` → `completed` returns 400
6. `completed_at` is set automatically when the second confirmation arrives and both timestamps are non-null
7. The appointment state machine is tested with unit tests covering all valid transitions and at least the most critical invalid ones

## Reference

- `docs/backend/V1MarketplaceLifecycle.md` — Section 5 (completion confirmation) and Section 4.3 (appointment lifecycle)
- `docs/database/DataModel.md` — Section 3.10 (appointments table with constraints)
