# Ticket: Request/proposal naming cleanup — backend-to-mobile alignment

- **Date:** 2026-04-19
- **Status:** Ready
- **Type:** Implementation / Backend + Mobile
- **Priority:** P2 — can run parallel with tech-06 or after

## Context

During tech-03, mobile copy was updated to reflect the canonical `request/proposal/coordination/completion` vocabulary, but the mobile service layer and internal types still use `Post` / `postService` / `/api/posts` naming as a legacy adapter layer. The backend also has no `/requests` routes yet — tech-06 adds them.

This ticket addresses the naming synchronization so the backend uses canonical names and the mobile adapter layer is updated (or removed) accordingly.

## Goal

Ensure consistent naming across backend routes, mobile service layer, and mobile types, so future developers are not confused by mixed `request`/`post` terminology.

## Scope

### Backend

- New routes under `/requests` (from tech-06) should be the canonical routes
- If any old `/posts` routes still exist in the backend, deprecate them (return 404 or redirect)
- Mobile should not be pointed to `/posts` routes

### Mobile

- `mobile/src/services/posts.ts` → rename to `requests.ts` (or keep adapter that calls `/requests`)
- `mobile/src/types/index.ts` — `Post` type alias should be replaced with `Request` or at minimum documented as an adapter alias
- Mobile screens that still reference `Post` or `postService` should be updated or annotated
- Any hardcoded `/api/posts` in mobile should be updated to `/api/requests` (or routed through the adapter)

### API contracts

- DTOs should use `request` naming (not `post`)
- Response shapes should match what `docs/database/DataModel.md` defines for `requests`

## Out of Scope

- Renaming the actual database tables if they were already named `posts` (tech-06 handles that)
- Changing mobile copy / UX labels — tech-03 already did that
- Implementing new features beyond naming alignment

## Suggested Files / Areas

- `backend/src/routes/` — verify `/requests` vs `/posts` route situation after tech-06
- `mobile/src/services/posts.ts` — rename or document as adapter
- `mobile/src/services/requests.ts` (new or updated)
- `mobile/src/types/index.ts` — `Post` type
- `mobile/src/screens/` — any remaining `Post`-specific imports

## Acceptance Criteria

1. Backend has no active `/posts` routes pointing to active handlers — they either return 404 or redirect to `/requests`
2. Mobile service file is either named `requests.ts` or documented as a named adapter from `Post` → `Request`
3. Mobile types use canonical `Request` lifecycle states (not old `pending/assigned/completed` states)
4. No active mobile code imports from `postService` expecting it to behave differently from `requestService`
5. Any remaining `Post` references in mobile are explicitly documented as legacy adapter aliases

## Dependency

This ticket depends on tech-06 completing the `/requests` route additions to the backend. Without those routes existing, the mobile adapter cannot be wired or verified.

## Note

If the team prefers to keep the mobile adapter layer temporarily (to avoid widening the change surface during tech-06), this ticket can document the adapter approach and set a target cleanup date. The key is that the **intention** is clear and no one误会 that `Post` is the canonical name going forward.
