# QuickFixU Functional Flow

## Purpose

This document describes the active V1 workflow for QuickFixU after the business simplification pivot.

## V1 Workflow Summary

QuickFixU is a marketplace for connecting clients with professionals. The platform manages discovery, proposals, coordination, and completion confirmation. **Payment is external to the platform** and is not processed by QuickFixU in V1.

## Entry Point A: Client finds professionals from a list

1. Client signs in.
2. Client browses or filters the list of professionals.
3. Client reviews professional profiles, specialties, rating, and verification status.
4. Client starts contact/coordination through the platform.
5. Client and professional align scope, timing, and service details.
6. Professional performs the job.
7. Client confirms completion.
8. Professional confirms completion.
9. Payment happens externally.
10. Both sides can leave a review.

## Entry Point B: Client publishes a problem/request

1. Client creates a request/problem with description, category, location, and optional media.
2. Matching professionals can review the request.
3. Professionals send proposals.
4. Client compares proposals.
5. Client selects one professional/proposal.
6. Client and professional coordinate through the platform.
7. Professional performs the job.
8. Client confirms completion.
9. Professional confirms completion.
10. Payment happens externally.
11. Both sides can leave a review.

## Workflow States

### Request/problem
- Draft
- Published
- Receiving proposals
- In coordination
- Closed
- Completed

### Proposal
- Sent
- Viewed
- Accepted
- Rejected
- Expired

### Service / job
- Coordinating
- Scheduled
- In progress
- Pending completion confirmation
- Completed

## Trust Signals in V1

Because QuickFixU does not handle money in V1, trust must come from:
- professional verification,
- profile quality,
- ratings and reviews,
- structured proposal history,
- in-platform coordination,
- completion confirmation by both sides.

## Explicit V1 Payment Rule

QuickFixU must not imply that money is collected, retained, released, refunded, or commissioned by the platform in V1.

Approved wording:
- external payment
- cash or bank transfer
- payment agreed between client and professional

Avoid in V1 documentation:
- credit card payments
- payment gateway
- escrow
- retained funds
- commission per transaction
- stored payment methods

## Future Monetization Direction

Future monetization should focus on subscriptions for professionals, including:
- verified badge,
- ranking boost,
- higher visibility,
- better recommendations,
- premium profile exposure.

**Boundary note:** these are future monetization ideas only. They must not create V1 billing flows, entitlement checks, premium gating, or subscription UI.

**Trust naming note:** current V1 verification/certification remains separate from any future paid visibility or profile-presentation package.
