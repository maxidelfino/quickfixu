# Product Requirements Document (PRD)
# QuickFixU - V1 Marketplace

**Version:** 2.0  
**Date:** April 2026  
**Author:** QuickFixU Team  
**Status:** Active living document

---

## 1. Product Direction

QuickFixU is a marketplace that connects clients with service professionals such as electricians, plumbers, and gas technicians.

V1 is intentionally focused on the marketplace workflow only:
- discovery,
- requests/problems,
- proposals,
- coordination,
- completion confirmation,
- reviews.

**V1 does not process payments.** Payment happens externally between client and professional, typically in cash or by bank transfer.

---

## 2. Product Goal

Help clients quickly find reliable professionals and help professionals receive qualified work opportunities through a simple, trustworthy workflow inside the platform.

---

## 3. Core User Roles

### Client
- Search professionals from a list.
- Publish a problem/request.
- Review proposals.
- Coordinate details through the platform.
- Confirm work completion.
- Leave a review.

### Professional
- Create and manage a profile.
- Appear in search results.
- Review client requests/problems.
- Send proposals.
- Coordinate details through the platform.
- Confirm work completion.
- Leave a review.

### Admin (operational support)
- Review professional verification requests.
- Moderate abuse/report issues.
- Support platform quality and trust.

---

## 4. V1 Functional Scope

### 4.1 Must-have capabilities

#### A. Onboarding and profiles
- Client registration and login.
- Professional registration and login.
- Professional specialties/categories.
- Basic profile information.
- Availability / service area.
- Verification status for professionals.

#### B. Search and discovery
- Search professionals by category.
- Filter by location/radius.
- View professional profile, rating, and verification status.

#### C. Requests/problems
- Client can publish a problem/request.
- Request includes title, description, category, location, and optional media.
- Request remains open to receive proposals until closed or expired.

#### D. Proposals
- Professionals can send proposals against a request/problem.
- Proposal includes price reference, scope notes, and proposed timing.
- Client can review and accept one proposal for coordination.

#### E. Coordination
- In-app chat between client and professional.
- Basic visit/work scheduling or agreed timing.
- Status updates for active work.

#### F. Completion and trust
- Both sides confirm completion.
- Both sides can leave ratings/reviews.
- Professional verification and history act as trust signals.

---

## 5. V1 Out of Scope

The following are explicitly excluded from V1:

- Credit cards.
- Payment gateways.
- Escrow / retained funds.
- In-app transaction commissions.
- Wallets, balances, or payouts.
- Storing payment methods.
- Refund processing by the platform.
- Financial dispute flows tied to platform-managed money.

---

## 6. Functional Principles

1. **Marketplace first**: the product wins by matching supply and demand effectively.
2. **Trust without fintech**: verification, reviews, and completion confirmation replace payment intermediation in V1.
3. **Structured coordination**: important service steps stay inside the app even if payment happens externally.
4. **Keep V1 simple**: avoid operational and legal complexity that does not help validate the core marketplace loop.

---

## 7. High-Level User Flows

### Flow A: Client searches professionals
1. Client opens professional list.
2. Client filters by category/location.
3. Client reviews profiles.
4. Client starts coordination with a selected professional.
5. Both sides agree on the service.
6. Professional performs the work.
7. Client and professional confirm completion.
8. Payment occurs externally.
9. Both sides can leave a review.

### Flow B: Client publishes a problem/request
1. Client creates a request/problem.
2. Professionals review the request.
3. Professionals send proposals.
4. Client compares and selects a proposal.
5. Both sides coordinate through the platform.
6. Professional performs the work.
7. Client and professional confirm completion.
8. Payment occurs externally.
9. Both sides can leave a review.

---

## 8. Success Criteria for V1

- Clients can discover professionals or publish requests without friction.
- Professionals can reliably receive and answer opportunities.
- Proposal-to-coordination flow is clear and traceable.
- Completion confirmation works from both sides.
- Trust signals are strong enough to support external payment.

---

## 9. Future Monetization

After validating V1, QuickFixU should monetize primarily through **subscriptions for professionals**, such as:
- verified badge,
- ranking boost,
- higher listing visibility,
- stronger recommendation placement,
- premium profile features.

This monetization path should be treated as the preferred commercial direction over transaction commissions.

**Boundary note:** this section is future direction only. Current V1 must not introduce subscription plans, billing cycles, invoices, entitlement checks, paywalls, purchase flows, or provider integrations.

**Naming rule:** V1 verification/trust signals remain operational quality markers. They must not be implemented as paid access or mixed with premium visibility logic.

---

## 10. Related Docs

- `docs/BusinessCase.md`
- `docs/FunctionalFlow.md`
- `docs/tickets/2026-04-v1-marketplace-pivot.md`
