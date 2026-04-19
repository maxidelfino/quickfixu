# Documentation Tickets

This folder records important product, scope, and technical-alignment decisions that affect the living documentation and the next implementation steps.

Use tickets here to:
- record business pivots,
- clarify scope decisions,
- translate product changes into concrete technical follow-up,
- preserve rationale without rewriting historical artifacts,
- keep both developers aligned on active direction.

## Business / Product Tickets

- `2026-04-v1-marketplace-pivot.md` - Simplifies V1 to a marketplace workflow without in-app payments.

## Technical Alignment Tickets

- `2026-04-v1-tech-01-backend-contracts-external-payment.md` - Remove or neutralize payment-intermediary assumptions in backend contracts and active technical docs.
- `2026-04-v1-tech-02-marketplace-data-model-statuses.md` - Align schema targets, workflow states, and lifecycle ownership with the marketplace-only V1 loop.
- `2026-04-v1-tech-03-mobile-flow-copy-and-states.md` - Update mobile copy, navigation expectations, and screen states to match external payment plus dual completion confirmation.
- `2026-04-v1-tech-04-notifications-and-event-boundaries.md` - Reframe notifications and event triggers around marketplace coordination instead of payment events.
- `2026-04-v1-tech-05-subscription-boundary-not-in-v1.md` - Define guardrails so future subscription monetization stays deferred and does not leak into V1 implementation.
