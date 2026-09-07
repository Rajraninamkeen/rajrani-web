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
| 07 | Customer Commerce | PARTIALLY_COMPLETE | cart (guest+auth, merge-on-login), checkout quote, order place/list/cancel, coupons done (server-authoritative, verified live). Remaining: discovery, multi-seller split-cart, buy-now, reviews |
| 08 | Payment + COD | NOT_STARTED | online payments, webhooks, COD verification |
| 09 | Fulfillment + Delivery | NOT_STARTED | orders, packaging, delivery pricing/partners/tracking |
| 10 | Returns + Support | NOT_STARTED | returns, refunds, tickets |
| 11 | Control Panel | NOT_STARTED | platform governance, audit, break-glass |
| 12 | Finance + Settlement | NOT_STARTED | settlements, reconciliation, financial integrity |
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
| Commerce: cart + checkout + orders + coupons (server-authoritative) | COMPLETE (schema+services/controllers+migrations seeded; unit tests 26 passing; live E2E order place/cancel verified). Reviews separate |
| `customer-web` full application | NOT_STARTED (only static landing prototype exists) |
| Data model / DB migrations (Identity + Catalog + Commerce tables) | COMPLETE (7 migrations recorded incl. `commerce_models`, `cart_status_merged`; migrate deploy clean) |
| Backend unit tests | COMPLETE (7 suites / 31 tests passing: exception filter, app, auth.service, roles.guard, catalog.service, cart.service, order.service) |
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
