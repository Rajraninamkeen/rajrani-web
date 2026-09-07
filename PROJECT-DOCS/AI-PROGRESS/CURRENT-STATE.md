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
| Current session | Session 05 — Buy-now + payments (COD & online intent/capture) |
| Current phase | Buy-now + payment-intent/capture + COD OTP done; reviews/fulfilment/refunds deferred |
| Overall status | Backend (foundation, auth/RBAC, catalog, commerce cart/checkout/orders, buy-now + sandbox payments + COD) on Prisma 7; all verified |
| Completed sessions | 00–04, upgrade pass, 05 (buy-now, online payment intent/capture, COD OTP) |
| Next session | Reviews, or fulfilment/delivery / real payment-gateway provider |
| Active blockers | Owner to rotate GitHub token; keep `rajrani-web` canonical |
| Known technical debt | See `COMPLETION-MATRIX.md`; `src/generated/` gitignored; payments currently use the built-in **sandbox** gateway (pluggable provider) — real gateway provider deferred |
| Last verification | typecheck/build OK; `npm test` 41 passing (9 suites); migrate deploy clean (8); live buy-now + sandbox capture(→PAID, idempotent) + COD OTP verified (2026-09-07) |
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

### Absent (per spec) / deferred
- No reviews, returns/refunds, multi-seller split-checkout, fulfilment/delivery,
  real payment-gateway provider (razorpay/stripe) yet.
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
