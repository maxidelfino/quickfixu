# QuickFixU V1 Backend Domain Contracts

**Status:** Active technical alignment artifact  
**Date:** 2026-04-18  
**Scope:** Backend naming, DTO vocabulary, and implementation guardrails for V1 marketplace work

---

## 1. Source of truth for current V1

This artifact aligns backend work with the active marketplace-only V1 defined in:

- `docs/PRD.md`
- `docs/FunctionalFlow.md`
- `docs/BusinessCase.md`
- `docs/tickets/2026-04-v1-marketplace-pivot.md`
- `docs/backend/V1SubscriptionBoundary.md`

### Non-negotiable V1 rule

QuickFixU V1 is a **marketplace and coordination platform**.  
QuickFixU V1 is **not** a payment intermediary.

Backend contracts must therefore avoid implying that the platform:

- collects money,
- holds money,
- releases money,
- refunds money,
- pays out professionals,
- stores payment methods,
- charges per-transaction commissions.

External payment may be mentioned only as an off-platform agreement between client and professional.

---

## 2. Audit result: confirmed mismatches to avoid

### Active backend codebase

The current backend code under:

- `backend/src/routes/`
- `backend/src/controllers/`
- `backend/src/services/`
- `backend/prisma/schema.prisma`

does **not** currently implement payment entities or payment lifecycle logic.

That is good news.

### Confirmed documentation mismatches

1. `docs/database/DataModel.md` still uses older domain wording that is broader than the current backend foundation and can leak wrong assumptions into future contracts.
   - Uses `posts` as a core entity while living docs use **request/problem** language.
   - Uses `appointments` as the service-work record, but no backend contract guidance existed for how completion confirmation should own trust instead of payment state.
   - Includes legacy-looking fields not present in `backend/prisma/schema.prisma`, such as `company_name`, `hourly_rate`, `available_schedule`, `fcm_token`, and `oauth_provider`.
   - Mentions future `payment_records`, which is correctly marked out of scope, but still needs a clearer backend guardrail so no one introduces `payments` back into active contracts by habit.

2. Historical docs under `docs/phases/fase-6/` and `docs/phases/fase-7/` still contain payment-oriented language such as escrow, payout, refund, payment release, and payment-confirmed notification flows.
   - These docs already contain superseded notes.
   - They remain unsafe as implementation references unless engineers intentionally ignore the old payment details.

3. `backend/README.md` described the existing API surface correctly, but it did not yet point developers to a backend-specific V1 vocabulary/contract guide for the next endpoints (`requests`, `proposals`, `appointments/services`, `reviews`).

---

## 3. Approved V1 backend vocabulary

Use these names in DTOs, route planning, service methods, Prisma model proposals, and internal discussions.

| Domain concern | Approved V1 term | Backend guidance |
|---|---|---|
| Client need published to marketplace | `request` | Preferred backend entity name. `problem` is allowed in UX copy, but backend contracts should standardize on `request`. |
| Professional response to a request | `proposal` | Contains pricing reference, scope notes, and timing proposal. Not a payment record. |
| Selected work that moves into execution | `appointment` | Preferred current technical term for the scheduled/active service record. `service` may appear in copy, but backend contracts should keep one canonical entity. |
| Conversation and scheduling activity | `coordination` | Use for workflow/state language, not as a separate money-related step. |
| Trust checkpoint after work is done | `completion confirmation` | First-class backend concern. Must be explicit on the appointment, not inferred from payment. |
| Reputation outcome | `review` | Allowed only after completion confirmation rules are satisfied. |
| Money exchange between client and professional | `external payment` | Informational only. Not a managed entity, status, ledger, or workflow owner in V1. |

### Canonical language rules

- Prefer **request** over `post` in new backend contracts.
- Prefer **appointment** over mixing `job`, `service`, and `booking` as separate entities.
- Treat **proposal price** as a commercial reference or estimate, not as a captured transaction.
- Treat **completion confirmation** as the trust anchor for reviews and workflow closure.
- Treat **external payment** as a disclosure, never as a lifecycle machine inside the backend.

---

## 4. Explicitly banned V1 contract terms

Do **not** introduce these as active V1 entities, statuses, DTO fields, events, or endpoint families:

- `payment`
- `payments`
- `paymentStatus`
- `escrow`
- `escrowStatus`
- `payout`
- `payoutStatus`
- `refund`
- `wallet`
- `balance`
- `commission`
- `transactionFee`
- `releaseFunds`
- `capturePayment`
- `storedPaymentMethod`
- `subscription`
- `subscriptionPlan`
- `planId`
- `billingCycle`
- `invoice`
- `entitlement`
- `paywall`

If one of these appears in historical docs, treat it as **superseded** for current V1.

---

## 5. Contract guidance for upcoming backend entities

### 5.1 Request

Represents the client's published need.

Recommended contract intent:

- owned by client,
- category-driven,
- location-aware,
- open to receive proposals,
- closable without any payment state.

Suggested status family:

- `draft`
- `published`
- `receiving_proposals`
- `in_coordination`
- `closed`
- `completed`
- `expired`

### 5.2 Proposal

Represents a professional's commercial/operational response.

Allowed contents:

- price reference,
- scope notes,
- proposed timing,
- optional validity/expiration.

Suggested status family:

- `sent`
- `viewed`
- `accepted`
- `rejected`
- `expired`
- `withdrawn` (optional if the team wants explicit recall behavior)

### 5.3 Appointment

Represents the selected proposal moving into real service execution.

This is where V1 trust and closure should live.

Suggested status family:

- `coordinating`
- `scheduled`
- `in_progress`
- `pending_completion_confirmation`
- `completed`
- `cancelled`

### 5.4 Completion confirmation

This must be modeled explicitly on the appointment/service record.

Recommended shape direction for tech-02:

- `clientConfirmedCompletionAt` or equivalent,
- `professionalConfirmedCompletionAt` or equivalent,
- derived `completed` state only when both confirmations satisfy the agreed rule.

Do **not** derive completion from:

- payment confirmation,
- payout release,
- refund absence,
- commission settlement.

### 5.5 Review

Review creation should depend on completion confirmation, not payment.

Minimum rule:

- review eligibility opens after the appointment reaches confirmed completion.

---

## 6. Two-developer implementation checklist

Before building request/proposal/appointment/review endpoints, confirm ALL of the following:

- [ ] New route names use `requests`, `proposals`, `appointments`, `reviews`.
- [ ] No planned DTO contains `paymentStatus`, `payoutStatus`, `refundStatus`, `walletBalance`, or `commissionAmount`.
- [ ] No planned DTO, route, or Prisma proposal introduces `subscription`, `plan`, `billing`, `invoice`, or `entitlement` concepts for V1.
- [ ] Proposal pricing fields are described as `priceReference`, `estimatedPrice`, or equivalent non-transactional language.
- [ ] Appointment/service states include explicit completion confirmation handling.
- [ ] Review eligibility depends on completion confirmation, not money movement.
- [ ] Any external-payment text is informational only and does not create backend state transitions.
- [ ] `docs/database/DataModel.md` changes for tech-02 use the approved vocabulary from this document.
- [ ] Any future monetization mention stays as a doc note and follows `docs/backend/V1SubscriptionBoundary.md`.
- [ ] Historical `docs/phases/` artifacts are not used as contract sources unless their payment assumptions are explicitly ignored.

---

## 7. Immediate handoff to tech-02

`tech-02` should use this vocabulary to produce the schema/status delta between:

- current Prisma foundation in `backend/prisma/schema.prisma`, and
- target V1 marketplace entities in `docs/database/DataModel.md`.

Priority decisions for tech-02:

1. Standardize **request** vs legacy `post` naming in the technical data model.
2. Lock the canonical **appointment** status machine around completion confirmation.
3. Define which completion fields are stored vs derived.
4. Keep proposal pricing as reference-only and exclude every payment lifecycle field.

---

## 8. Historical artifact rule

For backend implementation, the following are **non-authoritative for active V1** whenever they mention payment flows:

- `docs/phases/fase-6/*`
- `docs/phases/fase-7/*`

They remain historical context only.
