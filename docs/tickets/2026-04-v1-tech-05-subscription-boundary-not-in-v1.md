# Ticket: Subscription monetization boundary kept out of V1 implementation

- **Date:** 2026-04-18
- **Status:** Completed
- **Type:** Technical Alignment / Architecture Boundary

## Context

The living docs now state that future monetization should be subscription-based for professionals, but that model is explicitly deferred until after V1 validation. Without a boundary ticket, there is a risk that developers replace old payment assumptions with premature subscription logic during current implementation work.

## Goal

Create an explicit not-in-v1 boundary so future subscription monetization is acknowledged architecturally without contaminating the current marketplace implementation scope.

## Scope

- Define what subscription-related concepts may appear today only as notes, placeholders, or deferred architecture references.
- Define what must not appear in V1 implementation work yet (plans, billing cycles, invoices, entitlement checks, paywalls, payment providers).
- Identify the few places where future monetization may need a boundary note now, such as docs, ranking discussions, or trust/visibility features.
- Provide naming guidance so premium/discovery ideas are not confused with current verification/trust signals.

## Out of Scope

- Designing the subscription product.
- Choosing a billing provider.
- Creating subscription schema, endpoints, or mobile purchase flows.
- Implementing ranking monetization.

## Suggested Files / Areas to Inspect

- `docs/PRD.md`
- `docs/BusinessCase.md`
- `docs/FunctionalFlow.md`
- `docs/database/DataModel.md`
- `README.md`
- `mobile/src/screens/ProfileScreen.tsx`

## Acceptance Criteria

- The team has a written rule set for what subscription-related work is deferred from V1.
- V1 tickets and implementation work can reference future subscriptions without introducing active billing scope.
- Trust signals in V1 remain distinct from future paid visibility features.
- No current implementation ticket depends on a subscription engine, billing provider, or monetization schema.

## Resolution

Completed through the following lightweight alignment changes:

- Created `docs/backend/V1SubscriptionBoundary.md` as the canonical boundary artifact.
- Added boundary annotations to `docs/PRD.md`, `docs/BusinessCase.md`, `docs/FunctionalFlow.md`, and `docs/database/DataModel.md`.
- Added subscription guardrails to `docs/backend/V1BackendContracts.md`.
- Added docs-index guidance in `docs/README.md` so future contributors read the boundary before changing V1 scope.

## Guardrails adopted after tech-05

### Allowed now

- Mention future subscription monetization only as post-V1 direction.
- Keep future ideas limited to visibility/discovery/profile-presentation discussion.
- Preserve separation between trust signals (`verification`, `certification`, `reviews`, `ratings`) and future paid features.

### Not allowed in V1

- Subscription schema or billing tables.
- Billing providers, App Store / Play Store purchase flows, or subscription webhooks.
- Plans, invoices, billing cycles, entitlements, paywalls, or premium gating.
- Paid ranking logic or any feature that lets payment substitute for trust verification.

## Handoff

From this point on, any V1 implementation ticket that mentions monetization should reference `docs/backend/V1SubscriptionBoundary.md` and treat subscription as future-only unless a new post-V1 decision explicitly changes scope.
