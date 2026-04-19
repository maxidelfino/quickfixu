# Ticket: V1 marketplace pivot without in-app payments

- **Date:** 2026-04-18
- **Status:** Accepted
- **Type:** Business / Product Scope

## Context

QuickFixU keeps its core idea: connecting clients with service professionals such as gasistas, electricistas, and plomeros.

The previous documentation mixed the marketplace workflow with payment processing, retained funds, commissions, and stored payment methods. That direction adds significant operational and product complexity for V1.

## Decision

QuickFixU V1 is redefined as a **marketplace and coordination platform**, not a payment intermediary.

### V1 includes
- professional discovery,
- client requests/problems,
- professional proposals,
- in-platform coordination,
- service tracking,
- completion confirmation by both sides,
- ratings and reviews,
- professional verification and trust signals.

### V1 excludes
- credit cards,
- payment gateways,
- escrow or retained funds,
- transaction commissions,
- storing payment methods,
- platform-managed refunds or payouts.

### Payment rule
Payment happens **outside the app**, for example by cash or bank transfer.

## Rationale

- Reduces V1 complexity.
- Removes financial intermediation from the first release.
- Lowers regulatory, support, and operational burden.
- Keeps the team focused on validating the core marketplace loop.

## Monetization Direction

Future monetization should be **subscription-based**, especially for professionals. Priority ideas:
- verified badge,
- ranking boost,
- higher visibility,
- better recommendations.

## Documentation Impact

The following living documents were updated to reflect this pivot:
- `README.md`
- `docs/BusinessCase.md`
- `docs/PRD.md`
- `docs/FunctionalFlow.md`
- `docs/tickets/README.md`

Historical phase documents under `docs/phases/` remain unchanged as historical planning artifacts.
