# QuickFixU V1 Subscription Boundary

**Status:** Active technical alignment artifact  
**Date:** 2026-04-18  
**Purpose:** Keep future subscription monetization acknowledged without leaking into V1 product or implementation scope

---

## 1. Source of truth

This boundary follows the active V1 direction defined in:

- `docs/PRD.md`
- `docs/FunctionalFlow.md`
- `docs/BusinessCase.md`
- `docs/tickets/2026-04-v1-marketplace-pivot.md`
- `docs/backend/V1BackendContracts.md`
- `docs/backend/V1MarketplaceLifecycle.md`
- `docs/backend/V1NotificationEventBoundaries.md`

Historical docs may mention monetization ideas, but they are not authoritative for active V1.

---

## 2. Non-negotiable rule

QuickFixU V1 may acknowledge that **future monetization is expected to be subscription-based for professionals after V1 validation**.

QuickFixU V1 must **not** implement, depend on, or simulate a subscription product.

That means subscription can exist today only as:

- a business-direction note,
- a future architecture placeholder in docs,
- a naming guardrail so trust features are not confused with paid features.

---

## 3. Allowed future subscription concepts

These concepts may appear in current docs only as **future direction**, not as active scope:

- subscription-based monetization for professionals after V1 validation,
- future ranking boost,
- future higher listing visibility,
- future stronger recommendation placement,
- future premium profile presentation,
- future packaging of discovery/visibility features,
- future commercial exploration of monetizing professional reach rather than transaction commissions.

### Allowed documentation posture

Allowed phrasing:

- "future monetization"
- "after V1 validation"
- "not in current V1 scope"
- "future subscription direction"
- "possible future paid visibility/discovery features"

---

## 4. Explicitly banned for V1

Do **not** add any of the following to active V1 implementation, contracts, schema planning, mobile flows, or UI states:

- subscription tables,
- billing records,
- plan catalogs,
- plan IDs,
- billing cycles,
- invoices,
- receipts tied to platform billing,
- entitlements / entitlement checks,
- paywalls,
- trial periods,
- upgrade/downgrade/cancel subscription flows,
- app-store purchase flows,
- billing provider integrations,
- webhook handling for subscription state,
- premium gating middleware,
- monetized ranking logic,
- paid badge flags,
- DTOs or route families like `subscriptions`, `plans`, `billing`, `invoices`, `entitlements`.

### Also banned in V1 copy/state design

- subscription upsell screens,
- "unlock premium" CTAs,
- paid visibility labels mixed into current trust UX,
- review/ranking access conditioned on payment,
- verification granted because of payment.

---

## 5. Naming guardrails: trust vs paid visibility

This matters A LOT.

### V1 trust terms

These are valid in V1 right now:

- `verification`
- `certification`
- `verified professional`
- `review`
- `rating`
- `completion confirmation`

These signals are earned through trust/quality workflows, not payment.

### Future monetization terms

These may be referenced only as future commercial concepts:

- `premium visibility`
- `ranking boost`
- `featured placement`
- `subscription benefits`

### Hard rule

Do **not** use `verified badge` in active V1 implementation as shorthand for a paid feature.

If V1 shows verification, it must mean trust validation or certification status.

If future docs discuss monetized visibility, describe it as **premium visibility/presentation**, not as replacing or buying verification.

---

## 6. Practical hooks allowed now

For a two-developer team, the only safe hooks to keep now are:

- doc notes that monetization is deferred until after V1,
- separation between trust fields and any future paid-discovery concepts,
- ranking/recommendation discussions that explicitly say monetization is future-only,
- schema and API reviews that reject subscription/billing entities from current V1 work.

Do **not** add "for later" tables, enums, flags, or routes just to reserve space.

---

## 7. Two-developer implementation checklist

Before approving a V1 ticket, schema change, DTO, screen, or event, confirm:

- [ ] It does not require a subscription engine.
- [ ] It does not require a billing provider or purchase flow.
- [ ] It does not introduce `subscription`, `plan`, `billing`, `invoice`, or `entitlement` entities.
- [ ] It does not gate trust, reviews, or verification behind payment.
- [ ] It does not describe premium visibility as already active in V1.
- [ ] If future monetization is mentioned, the doc clearly says "after V1" or "out of current scope".

---

## 8. Current alignment decision

QuickFixU V1 should validate:

- marketplace liquidity,
- coordination workflow,
- trust signals,
- completion confirmation,
- review quality.

Only after that validation should the team design whether subscription monetization becomes:

- profile presentation,
- visibility/discovery boosts,
- recommendation placement,
- or another professional-facing package.

Until then, subscription remains a **documented future direction, not an implementation concern**.
