# Ticket: Request/proposal flow completion — feed, media, and parity gaps

- **Date:** 2026-04-19
- **Status:** Ready
- **Type:** Implementation / Backend + Mobile
- **Priority:** P0 — highest-value follow-up after the core loop already landed

## Context

The core V1 marketplace loop already exists in the backend and mobile foundation:

- requests / proposals / appointments / reviews are already modeled in Prisma,
- backend routes and services already cover the main lifecycle,
- mobile already consumes part of the flow.

However, important parity gaps still remain before the request/proposal experience feels complete and consistent.

## Goal

Close the remaining high-value request/proposal gaps so the implemented V1 loop becomes more complete, consistent, and usable:
1. Improve professional request feed behavior
2. Finish request media handling expectations
3. Close backend/mobile contract parity gaps around requests/proposals
4. Reduce remaining legacy `posts` assumptions that still block clean request flow wiring

## Scope

### Request feed completion

- Professional request feed should honor category matching and location/radius behavior consistent with the V1 product promise.
- Open requests should be presented in a way that reflects the professional's specialties.

### Request media completion

- `request_media` already exists in schema direction, but actual upload/signature/consumption behavior still needs closure.
- Text-first behavior may remain primary, but the media path should no longer feel half-defined.

### API / mobile parity

- Mobile should be able to consume the active backend request/proposal flow without depending on dead `/api/posts` assumptions.
- Request/proposal DTOs should be consistent with the canonical `request` vocabulary.

### Optional lightweight notifications

- If this ticket touches proposal-feed UX deeply, it may leave explicit hooks for `proposal_received` / `proposal_status_changed`, but no push transport is required.

## Out of Scope

- WebSocket / real-time chat
- Admin moderation UI
- OCR certification validation
- Push notification transport (FCM)
- Subscription monetization
- Full notification preference system
- Rebuilding already-implemented appointment/review core from scratch

## Suggested Files / Areas

### Backend
- `backend/src/routes/` — verify request/proposal feed/listing parity
- `backend/src/services/` — feed/query behavior, media handling stubs, parity fixes
- `backend/src/controllers/` — request/proposal handlers that still need closure
- `backend/prisma/schema.prisma` — only if media/feed support needs additional refinement

### Mobile
- `mobile/src/services/` — adapter layer for legacy `postService` → new `requestService` naming
- `mobile/src/screens/` — wire new request/proposal/appointment screens to real endpoints
- `mobile/src/types/index.ts` — align mobile types to canonical lifecycle states

### Docs (do not rewrite)
- `docs/database/DataModel.md` — already has the target schema
- `docs/backend/V1MarketplaceLifecycle.md` — canonical status states
- `docs/backend/V1BackendContracts.md` — banned payment terms

## Acceptance Criteria

1. Professional request feed is category-aware and location-aware enough to support V1 discovery.
2. Mobile can consume the active request/proposal backend without relying on dead `/api/posts` routes.
3. Request media behavior is explicitly supported, stubbed cleanly, or documented so it is no longer ambiguous.
4. No active API contract or Prisma model introduces payment, escrow, payout, refund, wallet, or commission concepts.
5. The implemented request/proposal loop feels like one coherent system instead of a partly migrated backend/mobile split.

## Implementation Notes

### Important current-reality note

- Do NOT reopen already-finished core appointment/review work inside this ticket.
- This ticket is now about closure/parity gaps, not re-implementing the whole marketplace loop.

## Handoff

After this ticket:
- tech-07 should address appointment lifecycle hardening
- tech-08 should address chat/coordination baseline
- tech-10 should finish the remaining naming cleanup
