# CURRENT-STATE — BILOKAT

> Authoritative AI snapshot. Update at the end of every session.
> Never mark anything COMPLETE without verification evidence.

| Field | Value |
|---|---|
| Project | BILOKAT — Multi-Seller Marketplace Platform |
| Canonical repo | `Rajraninamkeen/rajrani-web` (all work lives here; owner decision) |
| Remote | `origin https://github.com/Rajraninamkeen/rajrani-web.git` |
| Branch | `main` |
| Layout | `PROJECT-DOCS/` (specs + AI-PROGRESS) · `landing-page/` (frontend prototype) · backend at repo root (`src/`, `prisma/`) |
| Stack (final) | **NestJS 11.2.3 + TypeScript 5.9.3 + Prisma ORM 7.10.0** (driver adapter, prisma.config.ts) + PostgreSQL 17 |
| Current session | Session 08 — Item-level returns + full lifecycle (pickup/inspection/refunds) |
| Current phase | Item-level returns/refunds done; reviews/replacement/seller-ops/settlements remain |
| Overall status | Backend (foundation, auth/RBAC, catalog, commerce cart/checkout/orders, buy-now + sandbox payments + COD OTP, fulfilment/delivery, returns/refunds incl. item-level) on Prisma 7; all verified |
| Completed sessions | 00–04, upgrade pass, 05 (buy-now + payments + COD), 06 (fulfilment/delivery), 07 (returns/refunds), 08 (item-level returns + pickup/inspection lifecycle) |
| Next session | Reviews, replacement vs refund, seller-ops/split-checkout, or real payment-gateway provider / settlements |
| Active blockers | Owner to rotate GitHub token; keep `rajrani-web` canonical |
| Known technical debt | See `COMPLETION-MATRIX.md`; `src/generated/` gitignored; payments currently use the built-in **sandbox** gateway (pluggable provider) — real gateway + real refund execution deferred. Fulfilment/returns gated behind `OPERATOR`/`ADMIN`; no dedicated delivery/seller/finance role yet. Replacement (vs refund) & evidence upload not implemented; order-level status only goes REFUNDED on full aggregate refund. |
| Last verification | typecheck/build OK; `npm test` 66 passing (11 suites); migrate deploy clean (10); live item-level partial return → PASS → refunded half → second partial → order REFUNDED; pickup/inspection/refund_transactions/return_events verified (2026-09-07) |
| Repository health | pushed to GitHub (`main`); no committed secrets |

> ## IMPORTANT PRODUCT DECISION (owner)
> **`landing-page/` is a PROTOTYPE / UX reference only — NOT an exact pixel spec.**
> It shows the *feel* of user interactions and checkout the owner wants. It is
> NOT a strict "make it exactly this." Future customer experience should be
> enriched/built properly per the PROJECT-DOCS specs and later requirements, not
> slavishly copied from the prototype. The backend/DB remains the source of truth.

---

## What exists vs. what the specs require

The repository today is a **documentation + prototype container**, not the final
multi-app platform.

### Present
- `PROJECT-DOCS/` — all 13 specification documents + AI-PROGRESS control files.
- `landing-page/` — a **static single-page React marketing prototype** named
  "Bilokat" (namkeen/snacks D2C). All data is hardcoded. No API / backend calls.
- Backend (`src/`, `prisma/`) — NestJS + Prisma:
  - Session 01: config, health, envelope, request-id, Identity + Catalog data
    model + 3 migrations.
  - Session 02: **Auth + RBAC foundation** — register/login/logout/me,
    refresh-token rotation + reuse detection, `user_sessions` registry,
    JwtAuthGuard + RolesGuard, `@Roles`/`@CurrentUserId` decorators.
    Auth API live under `/api/v1/auth`.
  - Session 03: **Catalog API** (public) under `/api/v1/catalog` — categories,
    product list (filters: category/bestseller/new/search/price, sort, pagination),
    product detail by id/slug. Seed populates 5 categories + 8 products mirroring
    the landing-page catalog. Product schema gained display fields
    (originalPrice, weightLabel, ratingAvg, reviewCount, pairingSuggestion,
    customerFavTag). Migration `20260907120621_product_catalog_display_fields`.
  - Session 04: **Commerce — cart, checkout, orders** (server-authoritative):
    guest + authenticated carts with merge-on-login (`OptionalJwtAuthGuard` +
    `x-guest-session-id`), cart add/update/remove/clear under `/api/v1/cart`;
    checkout quote/preview that always re-derives price from DB product
    `basePrice` + asserts stock; transactional order placement (stock reserve via
    atomic decrement, coupon validate+usage++, address snapshot, order items,
    status history, cart → CONVERTED); list/get/cancel orders (cancel restores
    stock). Dev coupons seeded (`BILOKAT20`, `FLAT50`, `SAVE10`). Commerce tables
    via 2 migrations (`commerce_models`, `cart_status_merged`).
  - Session 05: **Buy-now + payments (COD & online intent/capture)**:
    `POST /buy-now` (direct no-cart order, same server-authoritative pricing);
    provider-agnostic `Payment` intent (`payments`/`payment_transactions`/
    `payment_webhooks`) created for PREPAID orders; signed **sandbox gateway**
    webhook `POST /payments/webhook/sandbox` (HMAC signature, idempotent via
    UNIQUE(provider, provider_event_id), amount match, capture → order `PAID`,
    transaction ledger, audit webhook log); COD secondary-mobile **OTP** flow
    (`/orders/:id/cod` otp/verify — only the OTP hash is stored, expires, attempt
    cap → REJECTED). Migration `payment_cod_models`.
  - Session 06: **Fulfilment/delivery state machine**: operator-only
    `POST /orders/:id/fulfilment/advance` (`@Roles(OPERATOR, ADMIN)` — customers
    cannot self-set delivery). Advance transitions PLACED→CONFIRMED→PACKED→SHIPPED→
    OUT_FOR_DELIVERY→DELIVERED with a confirmation gate (PREPAID must be PAID; COD
    must have passed OTP verification), legal-transition map + concurrency-safe
    guarded `updateMany(where status)`, an audited `order_status_history` row per
    transition (actor CONTROL + operator id + reason), and on DELIVERED sets
    `deliveredAt` + flips COD `COD_PENDING`→`COD_PAID` (cash collected at door).
    Customer timeline `GET /orders/:id/history`.
  - Sessions 07→08: **Returns & refunds** (DB-Design §§85-92). Session 07 built a
    whole-order flow (order → RETURN_REQUESTED/RETURNED/REFUND_PENDING/REFUNDED,
    `payment_transactions` REFUND); Session 08 **reworked it to item-level + full
    lifecycle** (the whole-order flow was superseded, not kept in parallel):
    customer `POST|GET /orders/:id/returns` now selects specific order items +
    quantities (customer order items expose `orderItemId`); proportional refund
    allocation by line value (full return of every line sums exactly to grand
    total). Lifecycle: request → operator decision (approve/reject, rejection
    reason mandatory) → schedulePickup → pickedUp → per-line inspection
    (PASS / PARTIAL_PASS 50% / FAIL 0, `return_inspections`) → auto
    `APPROVED_FOR_REFUND` (server-amounted per-item refund) → initiate refund
    (`GATEWAY` for PREPAID / `COD` for cash; never exceeds grand across partials)
    → sandbox complete → ReturnRequest `COMPLETED` + `refund_transactions` ledger
    + order only goes `REFUNDED`/`paymentStatus REFUNDED` once the aggregate of
    refunds covers the whole grand total (partial returns keep order `DELIVERED`).
    `return_events` record every step (customer + operator actors). Requests/
    decisions are operator-gated (`@Roles(OPERATOR,ADMIN)`).

### Absent (per spec) / deferred
- No reviews, multi-seller split-checkout, real payment-gateway provider
  (razorpay/stripe) with live refund execution, or real delivery-courier
  integration yet.
- Fulfilment/delivery/returns/refunds exist as internal operator flows
  (`OPERATOR`/`ADMIN`); no dedicated delivery/seller/finance role or real courier
  handoff yet.
- Return **replacement** (exchange) vs refund is not yet offered; no customer
  photo/evidence upload for returns yet (inspection is textual PASS/FAIL only).
  Item-level partial returns, pickup scheduling, per-line inspection and the
  `return_items`/`return_events`/`return_inspections`/`refund_transactions`
  ledger are all modelled and working (Session 08).
- No ABAC/organization/tenant isolation, step-up auth (deferred to later auth work).
- No `customer-web` full application (multi-page with account, orders, etc.).
- No `seller-web`, `catalog-publishing-web`, `support-web`, `delivery-web`,
  `finance-web`, `control-web`, `analytics-web` applications.
- No Redis-backed caching/jobs, no event bus / outbox yet.
- No real payment-gateway integration (sandbox gateway + pluggable interface
  implemented), no COD cash-collection at delivery, no returns/refunds,
  settlements, AI, analytics, or audit beyond payment webhook logging.
- No integration/E2E/security tests yet (only backend unit tests exist).
- No CI/CD, no Docker runtime available in sandbox (docker-compose file is
  written; Postgres 17 + Redis used locally).

---

## Document priority (when specs conflict)
Per `00-MASTER-SPEC.md` §Document priority:
1. Explicit latest project decision
2. `00-MASTER-SPEC.md`
3. `01-ARCHITECTURE.md`
4. `02-BUSINESS-WORKFLOWS.md`
5. Database / API / Security specs
6. Feature-specific specs
7. Existing implementation

Existing code is **not** automatically correct.
