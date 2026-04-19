# Ticket: Backend contracts aligned with external-payment V1

- **Date:** 2026-04-18
- **Status:** Done
- **Type:** Technical Alignment / Backend / API

## Context

The living docs now define QuickFixU V1 as a marketplace and coordination platform. Payment happens outside the app, so backend APIs, DTOs, naming, examples, and technical references must stop implying platform-managed money.

Today the repository has active backend foundations for auth, profiles, certifications, categories, and professional search, but the docs/history still contain payment-oriented assumptions in several technical artifacts. If backend implementation continues from those assumptions, we will encode the wrong domain.

## Goal

Audit and align backend-facing contracts so the active V1 model is explicitly marketplace-only and uses completion confirmation instead of payment lifecycle as the trust anchor.

## Scope

- Review backend-facing living docs and active technical references for payment-intermediary language.
- Identify current or planned API contracts that imply collected, held, released, refunded, or commissioned money.
- Define approved V1 terminology for backend responses/events, especially around proposals, appointments/services, completion confirmation, and reviews.
- Produce a concrete implementation checklist for contract updates before posts/proposals/appointments endpoints are built.
- Mark historical payment artifacts as superseded where needed instead of silently reusing them.

## Out of Scope

- Implementing new endpoints.
- Designing subscription billing APIs.
- Rewriting all historical phase documents from scratch.
- Payment provider integration of any kind.

## Suggested Files / Areas to Inspect

- `backend/src/routes/`
- `backend/src/controllers/`
- `backend/src/services/`
- `backend/README.md`
- `docs/PRD.md`
- `docs/FunctionalFlow.md`
- `docs/database/DataModel.md`
- `docs/phases/fase-6/`
- `docs/phases/fase-7/`

## Acceptance Criteria

- A backend-domain vocabulary list exists for active V1 terms (`request/problem`, `proposal`, `coordination`, `completion confirmation`, `review`, `external payment`).
- Any active contract/example that implies in-app payment handling is identified for removal, rename, or superseded treatment.
- No active backend contract requires entities such as payment, escrow, payout, refund, wallet, or commission.
- The resulting checklist is specific enough that backend implementation can proceed without reinterpreting the business pivot.
- Historical payment artifacts that remain in `docs/phases/` are explicitly treated as non-authoritative for current V1.

## Findings

### Confirmed current-state findings

1. `backend/src/routes/`, `backend/src/controllers/`, `backend/src/services/`, and `backend/prisma/schema.prisma` do not currently encode payment-intermediary entities or payment lifecycle logic.
2. `docs/database/DataModel.md` is directionally aligned with the marketplace pivot, but it still mixes legacy naming (`posts`) and schema examples that do not match the current Prisma foundation. Without backend-specific contract guidance, those sections are easy to misread when implementing the next endpoints.
3. Historical artifacts in `docs/phases/fase-6/` and `docs/phases/fase-7/` still contain escrow, payout, refund, and payment-release assumptions. They already include historical notes, but they must remain non-authoritative for active V1 backend work.
4. `backend/README.md` needed an explicit pointer to the V1 backend-domain guidance so the next backend implementation tickets do not default to old payment assumptions.

## Artifacts produced

- `docs/backend/V1BackendContracts.md` — active backend vocabulary, banned payment terms, status guidance, and implementation checklist for the next endpoints.
- `backend/README.md` — now points future backend work to the alignment artifact.
- `docs/README.md` — now indexes the backend contract artifact as a current technical reference.

## Recommended handoff to tech-02

Use `docs/backend/V1BackendContracts.md` as the naming/contract baseline while `tech-02` defines the schema delta and lifecycle statuses for `request`, `proposal`, `appointment`, completion confirmation, and `review`.
