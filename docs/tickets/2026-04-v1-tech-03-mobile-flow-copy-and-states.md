# Ticket: Mobile UX copy and flow states aligned with marketplace-only V1

- **Date:** 2026-04-18
- **Status:** Implemented
- **Type:** Technical Alignment / Mobile UX

## Context

The mobile app already contains onboarding, auth, profile, discovery, professional detail, and request/post creation pieces. However, some visible copy and expectations still imply payment features that do not belong in V1.

Example already visible in the current codebase: `mobile/src/screens/ProfileScreen.tsx` includes menu entries for `Métodos de Pago` and `Ingresos`, which conflict with the new business definition.

## Goal

Align mobile navigation, labels, empty states, and service-flow expectations with the actual V1 promise: discovery, requests/problems, proposals, coordination, completion confirmation, reviews, and external payment.

## Scope

- Audit current screens for payment-oriented copy, menu items, icons, and assumptions.
- Replace or remove UI affordances that suggest platform-managed money.
- Align request/post terminology with living docs (`request/problem`, `proposal`, `coordination`, `completion confirmation`).
- Review screen/state naming that currently uses outdated workflow states.
- Identify which mobile screens are foundation-only, which are placeholders, and which require follow-up to support the real V1 loop.
- Define the minimal UX text for external payment disclosure without turning the app into a payment product.

## Out of Scope

- Visual redesign of the app.
- Implementing all missing workflow screens.
- Push notifications implementation.
- Subscription upsell UI.

## Suggested Files / Areas to Inspect

- `mobile/src/screens/ProfileScreen.tsx`
- `mobile/src/screens/CreatePostScreen.tsx`
- `mobile/src/screens/PostPreviewScreen.tsx`
- `mobile/src/screens/MessagesScreen.tsx`
- `mobile/src/navigation/MainNavigator.tsx`
- `mobile/src/types/index.ts`
- `mobile/src/services/posts.ts`
- `docs/PRD.md`
- `docs/FunctionalFlow.md`

## Acceptance Criteria

- All currently exposed mobile copy avoids implying cards, wallet, payouts, in-app collections, or professional earnings managed by the platform.
- The app’s visible flow language matches the living docs for V1.
- Mobile status labels and assumptions are mapped against the agreed backend/domain lifecycle.
- Placeholder or incomplete screens are clearly identified so future work does not ship misleading UX.
- External payment is communicated as an off-platform agreement between client and professional, only where relevant.

## Implementation Notes

### Completed in this ticket

- Removed profile copy that implied platform-managed money (`Métodos de Pago`, `Ingresos`) and replaced it with request/proposal/completion-oriented placeholders.
- Updated visible mobile copy in onboarding, home, request creation, request preview, messages, and professional detail to reflect the V1 loop: request/problem → proposals → coordination → completion confirmation → external payment.
- Standardized the mobile request status type to the canonical V1 lifecycle (`draft`, `published`, `receiving_proposals`, `in_coordination`, `closed`, `completed`, `expired`).
- Kept legacy internal `Post` / `postService` / `/api/posts` naming temporarily to avoid widening scope during this ticket.

### Explicit temporary legacy kept on purpose

- Route names `CreatePost` and `PostPreview` remain unchanged.
- Mobile service file `mobile/src/services/posts.ts` remains unchanged in filename and endpoint family.
- Type alias `Post` remains as a compatibility name, but now carries canonical request lifecycle states.

### Follow-up for tech-04 or later

- Rename mobile navigation, screen, service, and endpoint contracts from `post(s)` to `request(s)` once backend routes are aligned.
- Replace placeholder menu destinations for completion tracking and professional coordination with real screens.
- Add first-class mobile UI for proposal review, coordination threads, and bilateral completion confirmation.
- Verify backend compatibility for the new canonical request status values before wiring status updates in production flows.
