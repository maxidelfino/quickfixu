# Ticket: Marketplace data model and status lifecycle alignment

- **Date:** 2026-04-18
- **Status:** Done
- **Type:** Technical Alignment / Data Model / Backend

## Context

The living docs and `docs/database/DataModel.md` describe a marketplace loop with posts, proposals, appointments, chats, messages, and reviews. The current Prisma schema in `backend/prisma/schema.prisma` still reflects an earlier foundation slice focused on users, professionals, categories, certifications, and refresh tokens.

There is now a gap between the documented V1 workflow and the actual backend schema foundation. That gap needs to be turned into an implementation-alignment plan before new backend work starts.

## Goal

Define the minimum schema/domain alignment needed so V1 workflow entities and statuses reflect the marketplace-only product model and do not reintroduce payment-state logic.

## Scope

- Compare `docs/database/DataModel.md` against `backend/prisma/schema.prisma`.
- Confirm the core V1 entities needed next: requests/posts, proposals, appointments/services, chats/messages, reviews, and related status transitions.
- Normalize status vocabulary across docs, future schema, and mobile types.
- Identify where completion confirmation must live and which entity owns that state.
- Identify derived vs stored concepts that matter now (for example role derivation, review counts, verification flags, proposal price as reference only).
- Produce a phased implementation order for schema work that keeps V1 lean.

## Out of Scope

- Writing Prisma migrations.
- Building notifications transport.
- Subscription tables or billing records.
- Admin/payments/disputes from historical phase artifacts.

## Suggested Files / Areas to Inspect

- `backend/prisma/schema.prisma`
- `docs/database/DataModel.md`
- `docs/FunctionalFlow.md`
- `mobile/src/types/index.ts`
- `mobile/src/services/posts.ts`
- `backend/src/types/`

## Acceptance Criteria

- A clear delta exists between current Prisma schema and target V1 marketplace entities.
- The team has an agreed status map for request/problem, proposal, and appointment/service lifecycles.
- Completion confirmation is modeled as a first-class V1 concern, not as a side effect of payment.
- No target schema element assumes payment records, escrow release, payout release, or transaction commissions.
- The output is actionable as the basis for the next backend schema/API tickets or implementation batch.

## Resolution Summary

This ticket is resolved by the following alignment artifacts:

- `docs/database/DataModel.md`
- `docs/backend/V1MarketplaceLifecycle.md`

### Confirmed alignment decisions

1. **Canonical naming**
   - `request` is the canonical marketplace entity.
   - `post` remains only as a legacy/historical alias.
   - `appointment` is the canonical service-work entity.

2. **Canonical lifecycle model**
   - `request.status`: `draft`, `published`, `receiving_proposals`, `in_coordination`, `closed`, `completed`, `expired`
   - `proposal.status`: `sent`, `viewed`, `accepted`, `rejected`, `expired`, `withdrawn`
   - `appointment.status`: `coordinating`, `scheduled`, `in_progress`, `pending_completion_confirmation`, `completed`, `cancelled`

3. **Completion confirmation**
   - Explicitly modeled on `appointment` with bilateral confirmation timestamps.
   - `completed` is valid only after both parties confirm.
   - Review eligibility depends on confirmed completion, not payment.

4. **Payment exclusion guardrail**
   - Target V1 model explicitly bans payment lifecycle entities/fields from the active schema scope.

## Prisma delta captured for next ticket

Current Prisma foundation still only includes:

- users / professionals / categories / professional_categories / certifications / refresh_tokens

Target V1 schema work still needs:

- requests
- request_categories
- request_media
- proposals
- appointments
- chats
- messages
- reviews

## Handoff to tech-03

Tech-03 should now use `docs/backend/V1MarketplaceLifecycle.md` plus the updated `docs/database/DataModel.md` to:

1. design the Prisma schema additions for `requests`, `proposals`, and `appointments`,
2. encode the approved status enums/state transitions,
3. add explicit appointment completion-confirmation fields,
4. keep proposal pricing reference-only,
5. plan route/DTO naming around `requests` instead of `posts`,
6. keep every payment-oriented field/entity out of the V1 schema proposal.
