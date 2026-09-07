# COMPLETION-MATRIX — BILOKAT

> Status legend:
> `NOT_STARTED` `DISCOVERED` `IN_PROGRESS` `PARTIALLY_COMPLETE` `BLOCKED`
> `COMPLETE` `VERIFIED`
>
> A workflow is only COMPLETE after: Implementation + Integration + Validation +
> Tests + Type Check + Build + Security Verification + Edge Case Verification +
> Documentation.

## Session / Workstream matrix

> Cross-cutting: Prisma 6→7.10 (stable) completed as a tech-upgrade pass
> (NestJS stays 11, TS stays 5.9) — see SESSION-LOG. `landing-page/` is a
> PROTOTYPE/UX reference, not an exact spec (owner).

| # | Session | Status | Notes |
|---|---|---|---|
| 00 | Project Initialization | COMPLETE | Repo/docs inspected, security audited, AI-PROGRESS created |
| 01 | Backend Foundation | PARTIALLY_COMPLETE | `bilokat-api` scaffolded (NestJS+Prisma): config, PostgreSQL wiring + 2 migrations, health, response/error envelope, request-id, Identity+Catalog data model, unit tests — typecheck/build/migrate/tests all PASS. Remaining: feature modules in later sessions |
| 02 | Authentication + Authorization | PARTIALLY_COMPLETE | Auth+RBAC foundation done (register/login/logout/me, JWT + rotating refresh in DB sessions, JwtAuthGuard, RolesGuard, @Roles/@CurrentUserId). ABAC/org/tenant/step-up deferred. Live API + unit tests passing |
| 03 | Seller Onboarding | NOT_STARTED | (Catalog API built early out-of-order to serve landing page; see Catalog row) |
| 04 | Catalog | PARTIALLY_COMPLETE | Public catalog read API live (/api/v1/catalog: categories, products w/ filters, detail) + seed (5 cats/8 prods) + display-field migration + tests. Attribute/variant/media mgmt & publishing UI deferred |
| 05 | Catalog Publishing | NOT_STARTED | listings, approval/review, visibility, lifecycle |
| 06 | Seller Platform | NOT_STARTED | seller apps for products/orders/inventory/returns |
| 07 | Customer Commerce | PARTIALLY_COMPLETE | cart (guest+auth, merge-on-login), checkout quote, order place/list/cancel/history-timeline, coupons, buy-now done (server-authoritative, verified live). Remaining: discovery, multi-seller split-cart, reviews |
| 08 | Payment + COD | PARTIALLY_COMPLETE | provider-agnostic Payment intent + sandbox gateway capture (signature+idempotency), payment ledger/webhook audit, buy-now, COD OTP verification, COD cash-collection at delivery (COD_PAID flip), refund ledger (payment_transactions REFUND) — verified live. Remaining: real gateway (razorpay/stripe) with live refund execution |
| 09 | Fulfillment + Delivery | PARTIALLY_COMPLETE | internal operator advance workflow (CONFIRMED→PACKED→SHIPPED→OUT_FOR_DELIVERY→DELIVERED, guarded + audited, deliveredAt + COD_PAID on delivery) verified live. Remaining: delivery pricing/partners/tracking, dedicated delivery role/courier handoff |
| 10 | Returns + Support | PARTIALLY_COMPLETE | whole-order returns + refunds backend (customer request within delivery window, operator approve/reject, refund initiate/complete with REFUND ledger) verified live + 14 tests. Remaining: item-level partial returns/pickup/inspection, replacement, support tickets/CRM, refund_transactions ledger table |
| 11 | Control Panel | NOT_STARTED | platform governance, audit, break-glass |
| 12 | Finance + Settlement | PARTIALLY_COMPLETE | seller payables + settlements ledger (Session 12): per-seller commissionRateBps; SellerPayable auto-earned per accepted slice at DELIVERED (goods−commission; Bilokat 0%, partner 10%); net+comm+tax+delivery == slice grandTotal; EARNED/IN_SETTLEMENT/SETTLED; operator /finance payables list/adjustments + settlements create/advance APPROVED→PROCESSING→PAID→RECONCILED (FAILED→retry) with settlement_events audit; each payable in ≤1 settlement; seller reads own payables/settlements — verified live. Remaining: real payout execution (external transfer; PAID is a ledger mark), automatic return-debit of an earned payable (now a manual operator adjustment), reconciliation engine vs external provider, finance reports/dashboards, financial-integrity job |
| 13 | Analytics | NOT_STARTED | events, analytics storage, dashboards |
| 14 | AI Intelligence | NOT_STARTED | gateway, RAG, recommendations, intelligence |
| 15 | Security Hardening | NOT_STARTED | pen-spec checklist pass, secrets, threat model review |
| 16 | Testing + Production Verification | NOT_STARTED | full automated + verification gate |

## Workstream detail (primary)

| Workstream | Status |
|---|---|
| Landing-page static prototype | DISCOVERED → builds cleanly; **owner: UX reference only, not exact spec** |
| ORM layer | COMPLETE (Prisma 7.10 + adapter-pg + prisma.config.ts, verified) |
| `bilokat-api` backend foundation | COMPLETE (scaffold/config/DB/envelope/health/unit tests — verified) |
| Auth + RBAC foundation | PARTIALLY_COMPLETE (register/login/logout/me, refresh rotation + reuse detection, guards — verified live + tests) |
| Catalog API endpoints (products/categories serving landing page) | COMPLETE (public read API verified live + seeded + tested) |
| Commerce: cart + checkout + orders + coupons (server-authoritative) | COMPLETE (unit tests pass; live order place/cancel verified). Reviews separate |
| Buy-now + online payment (intent/capture, sandbox) + COD OTP | COMPLETE (verified live + payment.service/cod.service tests) |
| `customer-web` full application | NOT_STARTED (only static landing prototype exists) |
| Data model / DB migrations (Identity + Catalog + Commerce tables) | COMPLETE (7 migrations recorded incl. `commerce_models`, `cart_status_merged`; migrate deploy clean) |
| Backend unit tests | COMPLETE (9 suites / 41 tests passing: exception filter, app, auth.service, roles.guard, catalog.service, cart.service, order.service, payment.service, cod.service) |
| AuthN (sessions/tokens) | NOT_STARTED |
| AuthZ (RBAC/ABAC, org/tenant isolation) | NOT_STARTED |
| Event/outbox infrastructure | NOT_STARTED |
| Automated tests (any layer) | NOT_STARTED |
| CI/CD | NOT_STARTED |
| Docker / deployment config | NOT_STARTED |

## Existence ≠ completion
- `landing-page/` exists but is **hardcoded** → does NOT satisfy customer-web
  spec or SOURCE-OF-TRUTH rule. Marked DISCOVERED only.
- Every feature in specs is unbuilt until a backend/app with tests and a clean
  build proves otherwise.
