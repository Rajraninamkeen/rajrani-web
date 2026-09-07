# SESSION-LOG — BILOKAT

Chronological record. Append new sessions at the bottom; do not rewrite history.

---

## Session 00 — Project Initialization (audit + control setup)
- **Date:** 2026-09-07
- **Objective:** Inspect repo(s), read specs, security-audit, map implementation
  state, create AI-PROGRESS control system. No feature coding.
- Findings: all 13 spec docs present; only a hardcoded static `landing-page`
  prototype existed; no backend/tests/infra; no committed secrets.
- Frontend prototype verified: `tsc --noEmit` exit 0, `npm run build` exit 0.
- Created `PROJECT-DOCS/AI-PROGRESS/` (CURRENT-STATE, COMPLETION-MATRIX,
  SESSION-LOG, HANDOFF, BLOCKERS, VERIFICATION).
- Owner decisions (2026-09-07): customer-commerce vertical slice; NestJS +
  Prisma; docker-compose infra. Repo later consolidated to `rajrani-web`
  (owner chose a single all-in-one repo).

---

## Session 01 — Backend Foundation (bilokat-api)

- **Date:** 2026-09-07
- **Objective:** Stand up the customer-commerce backend foundation as a separate
  repo (owner decisions: customer vertical slice, NestJS + Prisma, separate repo,
  docker-compose). Foundation only — no feature modules in this session.

### What was delivered
- New standalone repo `bilokat-api` (path `/home/user/bilokat-api`), **outside**
  the `concept` container (honors NO-MONOREPO). 1 commit, 28 tracked files.
- NestJS 11 + Prisma 6 + PostgreSQL 17 wiring.
- Env config module (typed), global `/api/v1` prefix + CORS + ValidationPipe.
- Standard response envelope + global exception filter + error codes +
  request-id/correlation middleware.
- Terminus `/api/v1/health` (postgres + app).
- Prisma data model (Identity + Catalog): users, addresses, categories,
  products, product_variants, product_media, product_reviews, coupons + enums.
  2 migrations applied: `20260907114155_init`, `20260907114205_map_users_snakecase`.
- `docker-compose.yml` (Postgres 17 + Redis 7), `.gitignore`, `.dockerignore`,
  `.env.example`, `.env` (gitignored), README.
- Jest unit tests: `all-exceptions.filter.spec.ts`, `app.controller.spec.ts`.

### Environment notes
- Sandbox has no Docker; installed PostgreSQL 17 directly (role `bilokat`,
  db `bilokat`). Redis not required for foundation. docker-compose file authored
  for real environments.

### Verification (actually executed)
- `prisma validate` → valid; `prisma generate` → OK.
- `prisma migrate dev` → 2 migrations created & applied; tables verified via psql.
- `npm run build` → exit 0.
- `tsc --noEmit` → exit 0.
- `npm test` → 2 suites / 4 tests PASS.
- Server started; `GET /api/v1/health` → `{success:true, postgres:up, app:up}`;
  `X-Request-Id` echoed; 404 → error envelope.

### Security / known issues
- No real secrets committed; `.env` gitignored.
- `npm audit`: 3 high findings, all one transitive advisory (`deepmerge-ts <8`
  in the **Prisma CLI dev tool**, `@prisma/config`), stack-exhaustion DoS on
  recursive config merge. Not runtime. **Deferred** — do not force-downgrade
  Prisma (would be breaking); re-check next security pass.
- Decision/open item: owner must create GitHub repo `bilokat-api` and grant push
  (B-001 remains actionable).

- **Date:** 2026-09-07
- **Objective:** Inspect repo, read specs, security-audit, map implementation
  state, and create the AI-PROGRESS development control system. No feature coding.

### Repository findings
- Repo `Rajraninamkeen/concept`, default branch `main`, remote `origin`.
- Single commit `da32542` ("Initial project structure"); working tree clean.
- 45 tracked files; 13 spec docs + `landing-page/` prototype.
- Structure: `PROJECT-DOCS/` (13 docs) and `landing-page/` (React 19 + Vite +
  Tailwind CSS v4, single-page, uses `vite-plugin-singlefile`).
- No `.gitignore`, no `.env*`, no Docker, no CI, no tests anywhere.

### Documents inspected
- Read TOCs and key prose across all 13 docs (00–12). Read in depth:
  00-MASTER-SPEC, 01-ARCHITECTURE, 03-DATABASE-DESIGN, 04-API-SPECIFICATION,
  05-AUTH-RBAC-ABAC, 06-EVENT-ARCHITECTURE, 09-SECURITY-SPEC, 10-ANALYTICS-SPEC.
- No expected document is missing (all 13 present).

### Architecture findings (spec-intended)
- **NO MONOREPO** is mandated; independent, deployable apps/repos with shared
  versioned packages (e.g. `@bilokat/types`, `@bilokat/api-client`, `@bilokat/ui`).
- 9 frontends (`customer-web`, `seller-web`, `catalog-publishing-web`,
  `support-web`, `delivery-web`, `finance-web`, `control-web`, `analytics-web`)
  + a modular **Central Backend** (`bilokat-api`) + AI Intelligence layer.
- Backend: modular (≈28 modules), layered Controller→Service→Domain→Repository.
- Data: PostgreSQL authoritative; Redis cache/queue; object storage; outbox
  event pattern; modular `prisma/` layout referenced in architecture.
- Landing `landing-page/` = customer-facing marketing prototype only.

### Security findings
- Scanned for secrets/keys/tokens across all non-lock files.
- No high-confidence secrets (no `sk-`, `AKIA`, JWT tokens, private keys, creds).
  Only generic uses of the word "secret" (e.g. marketing copy "secret discount
  codes") and placeholder discussion inside specs.
- No `.env*` committed; no `node_modules` committed.
- **Still required:** root `.gitignore`, `.env.example`, and secret handling
  before any backend/env work (deferred to Session 01).

### Missing / incomplete implementation
- No backend, no DB migrations, no auth, no commerce/order flows, no tests,
  no CI/CD, no infra config, no full customer app. Everything in specs is unbuilt.
- Landing-page data is fully hardcoded (products, prices, reviews, FAQs,
  bundles) — must not become production source of truth.

### Decisions
- Session 0 = audit only; do not implement Session 1+ features.
- Backend repo naming per spec: `bilokat-api`.
- Framework selection deferred to Session 01 with current stable-version check
  (spec does not hard-bind; NestJS referenced, Prisma layout suggested).
- Keep all existing docs/code intact; no git history rewrite.

### Verification results (actually executed)
- `git status` → clean; `git branch` → main; `git remote -v` → origin https.
- `git ls-files` → 45 files.
- `node -v` v20.20.2; `npm -v` 10.8.2; `npm ci` OK.
- `npx tsc --noEmit` → exit 0 (typecheck PASS).
- `npm run build` (vite) → exit 0, single-file `dist/index.html` 409.04 kB.
- Secret grep → no real secrets.

---

## Session 02 — Authentication + Authorization (foundation)

- **Date:** 2026-09-07
- **Objective:** Add auth + RBAC foundation to the backend in `rajrani-web`.
- **Repo note:** Owner consolidated everything into one repo `rajrani-web`
  (docs + landing-page + backend at root), with continuous-push after each
  meaningful change.

### Delivered
- Prisma `user_sessions` model for refresh-token registry + 2 migrations
  (`20260907115442_add_user_sessions`, `20260907115613_sessions_unique_refresh`;
  both recorded in DB — total 4 migrations).
- `src/auth/`: register, login, refresh (rotation + reuse detection), logout,
  me. Access tokens are JWTs (short TTL); refresh tokens are opaque random,
  stored hashed (sha256) in DB.
- `JwtAuthGuard` (Bearer access-token verification → `req.auth`),
  `RolesGuard` + `@Roles(...)`, `@CurrentUserId`.
- Auth API live: `/api/v1/auth/{register,login,refresh,logout,me}`.
- Unit tests added for auth.service + roles.guard.

### Verification (executed)
- `npm run typecheck` → exit 0; `npm run build` → exit 0.
- `npm test` → 4 suites / 12 tests PASS.
- Live E2E curl: register ✓; me with token ✓; me without token → 401 ✓;
  refresh rotation (new token differs) ✓; refresh-token reuse → UNAUTHORIZED ✓
  and post-reuse new token also revoked ✓.
- Pushed to GitHub `rajrani-web` → commit `fcc6682`.

### Notes / debt
- bcryptjs (pure JS) used for password hashing.
- ABAC / org–tenant isolation / step-up auth deferred to later work.
- `.env` local only (gitignored); GitHub token must be rotated by owner.

---

## Session 03 — Catalog API

- **Date:** 2026-09-07
- **Objective:** Add public catalog read API so the backend/DB becomes the source
  of truth for product data the landing page currently hardcodes. Owner asked for
  research before implementation and preference for current/"latest" tech.

### Research outcome (recorded)
- Registry: @nestjs/core 12.0.1 (we on 11.2.3), @prisma/client 7.10.0 (we on
  6.19.3), typescript 7.0.2, @nestjs/cli 12.
- NestJS 12 released 28 Aug 2026 (1 week old): ESM-first, drops CommonJS,
  Vitest/oxlint/Rspack. Sources: NestJS v12 release + Trilon + InfoQ. Production
  ecosystem still on 11.2.x per research.
- Prisma 7 (Nov 2025, now 7.6.0 stable): Rust-free, mandatory driver adapters,
  prisma.config.ts, no auto env loading, generator output path change.
- DECISION: stay on NestJS 11 + Prisma 6 for Session 03 (stable, non-breaking;
  project already verified on it). A NestJS-12 upgrade on a 1-week-old major is
  not advisable mid-project. Optional stack upgrades documented for owner.

### Delivered
- Prisma migration `20260907120621_product_catalog_display_fields` (added
  originalPrice, weightLabel, ratingAvg, reviewCount, pairingSuggestion,
  customerFavTag to products). Applied + recorded (DB now 5 migrations).
- `prisma/catalog-seed.ts` + `prisma/seed.ts`: upsert 5 categories + 8 products
  mirroring landing-page products.ts (idempotent).
- `src/catalog/`: catalog.service, catalog.controller, catalog.module,
  catalog.types, dto/list-products.query.
- Public endpoints under /api/v1/catalog:
  - GET /catalog/categories
  - GET /catalog/products  (filters: category, bestseller, isNew, q search,
    min/max price; sort: price_asc/price_desc/rating/newest/popular; pagination)
  - GET /catalog/products/:identifier (id or slug) — only APPROVED+LIVE, non-deleted.
- Public response shape aligned with the landing-page Product model
  (price/originalPrice/discountPercent/weight/rating/spiceLevel numeric 1-4/etc.)
  so frontend can later drop-in replace hardcoded data.
- Catalog unit tests (mapping, no field leak, 404).

### Verification (executed)
- `prisma generate` OK; `npm run typecheck` exit 0; `npm run build` exit 0.
- Seed run twice (idempotent): 5 categories, 8 products.
- Live curl: categories (5) ✓; products list (8) ✓; bestseller filter (5) ✓;
  category=healthy (2) ✓; search q=makhana (1) ✓; sort price_asc ✓; detail by
  slug (price 189/orig 240/disc 21) ✓; unknown product → HTTP 404 ✓.
- `npm test` → 5 suites / 15 tests PASS.
- Pushed to GitHub `rajrani-web` → commit `ebd9ce0`.

---

## Session: Tech Stack Upgrade (Prisma 6 -> 7.10 stable)

- **Date:** 2026-09-07
- **Owner instruction:** adopt latest technology; research then implement.
- **Owner clarification (recorded):** `landing-page/` is a PROTOTYPE/UX reference,
  not an exact spec. Future customer experience should be built properly per
  specs + later requirements, not slavishly copied from the prototype.

### Research & decision (executed)
- NestJS latest = 12.0.1 (28 Aug 2026, ~1 wk old). NestJS 12 ships ESM packages.
  Tested upgrade: runtime Nest packages 12 installed cleanly (typecheck/build
  passed on TS 5.9), BUT Jest failed loading ESM packages
  ("Cannot use import statement outside a module"). NestJS 12 recommends Vitest
  for ESM. We did NOT want to migrate the whole test toolchain now.
- DECISION (owner chose): revert NestJS to 11.2.3, keep TypeScript 5.9.3, and
  upgrade Prisma 6 -> **7.10.0 (stable)** — the clean, isolated modernization.
  @nestjs/cli@12 + schematics@12 also require root TS >= 6; staying on 11 avoids
  that cascade.
- Prisma npm "latest" dist-tag points at 8.0.0-rc.13 (an RC) — explicitly pinned
  prisma@7.10.0 + @prisma/client@7.10.0 (stable).

### Prisma 7 changes applied
- schema.prisma generator: `prisma-client` + explicit `output = ../src/generated/prisma`;
  removed datasource `url` (no longer supported in schema in v7).
- New `prisma.config.ts` (defineConfig): schema, migrations.path + seed,
  datasource.url from env (CLI + dotenv). Removed deprecated `prisma` key from
  package.json; seed runs via `prisma db seed`.
- PrismaClient now requires a driver adapter -> added `@prisma/adapter-pg` + `pg`;
  PrismaService + seed.ts construct `new PrismaClient({ adapter: new PrismaPg({...}) })`.
- All `@prisma/client` imports changed to the generated client path.
- `src/generated/` added to .gitignore (generated at build time).

### DB migration history reconcile
- Earlier Session 03 manual apply left a stray + a 0-step record for one migration.
  Removed the stray record, fixed applied_steps_count/checksum, ran
  `prisma migrate resolve --applied`, then `prisma migrate deploy` -> clean
  ("No pending migrations to apply", 5 migrations).

### Verification (executed)
- `prisma validate` PASS (config loaded). `prisma migrate deploy` PASS.
- `npm run typecheck` exit 0; `npm run build` exit 0.
- `npm test` -> 5 suites / 15 tests PASS.
- `prisma db seed` -> 5 categories / 8 products.
- Live server started on Prisma 7: health postgres up; catalog list/detail OK;
  auth register + login (DB read AND write via adapter) OK.
- Pushed to GitHub `rajrani-web` -> commit `06bfecd`.

### Notes
- `src/generated/` not committed; run `npx prisma generate` before `npm run build`.
- Runtime Node require(esm) fine; Jest issue only affected a NestJS-12 path that
  was reverted.

## Session 04 — Commerce (cart, checkout, orders) — 2026-09-07, `/home/user/rajrani-web`

- **Objective:** Server-authoritative cart (guest + authenticated with
  merge-on-login), checkout quote, and order creation/cancel with state history.
  Backend never trusts frontend prices — always re-derives from product
  `basePrice` and asserts stock.

### What was delivered
- **Schema/migrations:** commerce enums (`CartStatus` incl. `MERGED`,
  `PaymentMethod`, `PaymentStatus`, `OrderStatus`, `OrderActor`) + models
  `Cart`, `CartItem`, `Order`, `OrderItem`, `OrderStatusHistory`; `User`/`Product`
  back-relations. 2 migrations applied+recorded: `commerce_models`,
  `cart_status_merged` (total recorded = 7).
- **Cart** (`/api/v1/cart`): guest (via `x-guest-session-id`) + authenticated
  carts, `OptionalJwtAuthGuard` allows tokenless guest; merge guest→user on first
  login marking old cart `MERGED`; add/update/remove/clear/get; only
  APPROVED+LIVE products purchasable; stock asserted; reads always pull fresh
  product price/media.
- **Checkout/orders** (`/api/v1/checkout/preview`, `/checkout`,
  `/orders`, `/orders/:id`, `/orders/:id/cancel`): preview quote computes
  subtotal/discount/tax(5%)/delivery(flat ₹49, free ≥ ₹499)/coupon; coupon folds
  into `grandTotal`; transactional checkout reserves stock via atomic decrement
  (`updateMany where stockOnHand gte`), validates + increments coupon usage,
  snapshots address, writes order + items + status history, marks cart
  `CONVERTED`. Cancel only from PLACED/CONFIRMED, restores stock, records history.
- **Coupons:** dev coupons seeded/upserted (`BILOKAT20`, `FLAT50`, `SAVE10`).
- **Tests:** `cart.service.spec.ts`, `order.service.spec.ts` (price math, stock
  guard, coupon → grandTotal). 26 tests passing across 7 suites.

### Verification (executed)
See VERIFICATION Session 04 table. Live E2E run: user register/login → add cart
items → checkout preview (coupon reflected) → place COD order (stock decremented,
coupon usage 1, cart CONVERTED, status PLACED) → list/get order → cancel (status
CANCELLED, stock restored). Guest over-stock rejected; guest→login merge OK.

### Decisions / fixes during session
- Cart ids are cuid strings (DB `@default(cuid())`), so checkout `cartId` relaxed
  from `@IsUUID()` to string — carts are not UUIDs.
- Coupon fields consolidated into `PriceBreakdown` so preview/order `grandTotal`
  reflects the coupon; removed duplicate top-level coupon fields.
- NestJS 12 ESM + Jest remains unsuitable (reverted in prior pass); still on
  NestJS 11/Jest CJS.


### Session 04 follow-up — Core correctness hardening (2026-09-07)
- `GET /orders` now paginated (`page`/`limit`) + optional `status` filter and
  returns `{ orders, total, page, limit, totalPages }` (empty-state friendly).
- Checkout now atomically claims the cart (ACTIVE→CONVERTED via guarded
  `updateMany`) inside the transaction to prevent a double-checkout race on the
  same cart; distinct `409 CONFLICT` for an already-converted/inactive cart
  (replacing a generic 404).
- Order cancel uses a guarded `PLACED/CONFIRMED → CANCELLED` transition so a
  concurrent double-cancel cannot double-restore stock; lost race → 409.
- Added 6 tests (cart-not-active conflict, in-transaction claim conflict,
  pagination + status filter, non-cancellable order, cancel race guard).
  Commerce specs 10→16; full suite 26→31 tests PASS.
- Live verified: reuse of a CONVERTED cart → 409; orders pagination shape;
  `?status=CANCELLED` filter; invalid status → 400.
- Pushed `dfb27f7`.

## Session 05 — Buy-now + payments (COD & online intent/capture) — 2026-09-07

- **Objective:** Extend checkout with direct buy-now ordering plus an online
  payment-intent/capture flow and a pragmatic COD verification workflow.
  Owner scope: buy-now = direct single-product checkout; online payment =
  provider-agnostic interface + built-in no-keys **sandbox** gateway modeling
  signature + idempotency; COD = secondary-mobile simulated OTP (no support-queue).

### What was delivered
- Schema/migration `20260907125816_payment_cod_models`: `Payment` (payments),
  `PaymentTransaction` (ledger), `PaymentWebhook` (idempotency+signature audit,
  UNIQUE provider+event), `CodVerification`; enums PaymentState,
  PaymentTransactionType, CodVerificationStatus. Order/User back-relations.
  Migration ledger reconciled (fixed a pre-existing truncated `cart_status_merged`
  name + stray duplicate) so `prisma migrate deploy` is clean (8 migrations).
- **Buy-now**: `POST /buy-now/preview` + `POST /buy-now` (JWT) — no cart; product
  validated purchasable/stock inside a transaction; reuses the same
  server-authoritative quote + order-persistence core as cart checkout.
- **Online payment**: PREPAID orders (cart checkout or buy-now) create a `Payment`
  intent. `POST /payments/webhook/sandbox` (public, but HMAC-signed) verifies
  signature, amount match, and is idempotent (UNIQUE provider+event); on
  `payment.captured` marks Payment CONFIRMED + order `PAID`, writes a
  `payment_transactions` CAPTURE + webhook audit row. Failed/bad-signature events
  are logged. `GET /orders/:id/payment` returns the intent.
- **COD**: `POST /orders/:id/cod/otp` (secondary mobile; sandbox returns the
  simulated OTP in the response, only its hash is stored + 10-min expiry),
  `POST /orders/:id/cod/verify`, `GET /orders/:id/cod`. Success → verification
  CONFIRMED and order `CONFIRMED` (paymentStatus stays COD_PENDING until
  delivery); attempt cap (5) → REJECTED + COD_FAILED.
- **Tests**: payment.service.spec (signature round-trip/tamper, bad-signature
  403, amount mismatch, unknown payment 404, idempotency), cod.service.spec
  (initiate hash-not-raw, non-COD reject, success confirms, wrong-OTP attempt cap,
  404). Full suite now 9 suites / 41 tests.

### Verification
Live E2E run — see VERIFICATION Session 05 table.

---

## Session 06 — Fulfilment + delivery state machine
- **Date:** 2026-09-07
- **Objective:** Internal operator workflow advancing paid/verified orders through
  fulfilment and delivery with guarded, audited transitions and correct COD
  settlement at delivery.
- **Delivered**
  - `FulfilmentService.advance(operatorId, orderId, toStatus, reason?)` +
    `FulfilmentController` `POST /orders/:id/fulfilment/advance`. Access is
    operator-only (`@Roles('OPERATOR','ADMIN')` via existing RolesGuard) so a
    customer can never self-set delivery status.
  - Legal-transition map: PLACED→CONFIRMED→PACKED→SHIPPED→
    {OUT_FOR_DELIVERY|DELIVERED}→DELIVERED; every other state is terminal
    (CANCELLED/RETURN*/REFUND* reachable only via future flows).
  - Confirmation gate: advancing to CONFIRMED requires PREPAID order to be `PAID`
    (payment captured) or a COD order whose `CodVerification` is `CONFIRMED`.
  - Concurrency safety: guarded `updateMany(where { id, status: current })`
    inside a `$transaction` (0 rows → 409), then an audited
    `order_status_history` row per transition (actor CONTROL, actorId = operator
    user id, fromStatus/toStatus, reason, metadata) and a re-read return.
  - Delivery semantics: advancing to DELIVERED sets `deliveredAt` and, for COD,
    flips `paymentStatus` `COD_PENDING`→`COD_PAID` (cash collected at door);
    PREPAID `PAID` is left untouched.
  - Customer-facing timeline `GET /orders/:id/history` (OrderService.orderHistory)
    returning ordered from/to/actor/reason/createdAt.
  - Fulfilment unit spec (8 tests): illegal transition, confirmation gate
    (PREPAID-not-PAID, COD-not-verified), legal CONFIRMED→PACKED with audited
    row, DELIVERED sets deliveredAt + COD_PAID, PREPAID untouched on delivery,
    default reason. Suite now 10 suites / 49 tests.
- **Verification:** typecheck + `nest build` clean; `npm test` 49/10; live E2E —
  PREPAID buy-now captured (→PAID, still PLACED) then driven CONFIRMED→PACKED→
  SHIPPED→OUT_FOR_DELIVERY→DELIVERED; COD order OTP-verified (→CONFIRMED /
  COD_PENDING) then driven to DELIVERED → `COD_PAID` + deliveredAt; audited
  history rows (actor CONTROL = operator id) confirmed in DB; customer
  `GET /orders/:id/history` timeline verified; FORBIDDEN for a CUSTOMER token;
  illegal jump and post-terminal advances → 409. See VERIFICATION Session 06.

---

## Session 07 — Returns + refunds
> **SUPERSEDED by Session 08:** Session 07 implemented a whole-order
> (RequestRequest-wide) return/refund model. Session 08 reworked returns to be
> item-level (select specific order items + quantities) with a full
> pickup/scheduling + per-line inspection + per-item refund + `return_events`
> audit lifecycle, and an order only becomes `REFUNDED` once the aggregate of its
> refunds equals its grand total. Treat Session 08's flow as canonical; this whole-
> order shape is superseded and is kept below only as an historical record.
- **Date:** 2026-09-07
- **Objective:** Open the exception transitions out of DELIVERED/RETURNED per the
  order state machine (§39/§40) and implement a backend-authoritative return &
  refund flow (DB-Design §§85-92).
- **Schema/migration `20260907133000_return_refund_models`:** enums `ReturnStatus`
  (REQUESTED/APPROVED/REJECTED/COMPLETED), `ReturnReasonCode`,
  `RefundMethod` (GATEWAY/COD), `RefundState` (PENDING/PROCESSING/COMPLETED/FAILED);
  models `ReturnRequest` (return_requests) and `Refund` (refunds) with FK to
  Order/ReturnRequest/optional Payment; `prisma migrate deploy` clean (9). Ledger
  was reconciled after a psql apply (schema applied, failed-deploy placeholder row
  corrected) — migrate deploy now reports no pending.
- **ReturnsService:** customer `request` (ownership + must be DELIVERED + within
  `RETURN_WINDOW_DAYS=7` delivery window + no existing non-rejected return; guarded
  order move + `order_status_history` CUSTOMER row) → `RETURN_REQUESTED`;
  operator `decide` approve (→`RETURNED`) or reject (→back to `DELIVERED`;
  rejection reason mandatory) with CONTROL audit; operator `initiateRefund`
  (defaults to full grand total, allows ≤ grand total, GATEWAY for PREPAID /
  COD for cash, links original Payment, order → `REFUND_PENDING`) and
  `completeRefund` sandbox (order `REFUNDED` + `paymentStatus REFUNDED`,
  `Refund` COMPLETED, appends a `payment_transactions` REFUND ledger row on the
  original payment, `ReturnRequest` COMPLETED); double-complete guarded.
- **Controllers/RBAC:** `ReturnsController` (`POST|GET /orders/:id/returns`,
  JWT, order-owner enforced in service); `ReturnOpsController`
  (`POST /return-requests/:id/decision|/refund|/refund/complete`, `@Roles
  (OPERATOR,ADMIN)`). Centralized `returns.policy.ts` (return window constant).
- **Tests:** returns.service.spec (14) — ownership 404, non-DELIVERED, closed
  window, create+moving to RETURN_REQUESTED with audited CUSTOMER row,
  duplicate conflict, reject-mandatory-reason, approve→RETURNED, reject→DELIVERED,
  block-unless-approved, amount>grandTotal reject, full refund GATEWAY +
  REFUND_PENDING, COD method, complete→REFUNDED + ledger REFUND + no-double.
  Full suite now 11 suites / 63 tests.
- **Verification:** typecheck + build clean; live E2E PREPAID order captured →
  delivered → requested return (operator-token request correctly 404s as not the
  owner) → reject-without-reason 400 → reject returns to DELIVERED → re-request →
  approve → initiate full 1887.90 GATEWAY refund → complete → order REFUNDED /
  paymentStatus REFUNDED / ledger shows CAPTURE + REFUND SUCCESS / ReturnRequest
  COMPLETED; double-complete 409; customer calling decision 403. See VERIFICATION
  Session 07 table.

## Session 08 — Item-level returns + full pickup/inspection lifecycle
- **Date:** 2026-09-07
- **Objective:** Replace the whole-order return (Session 07) with item-level,
  partial returns under the two Session 08 design decisions: (1) refunds are the
  **proportional share of the order's grand total** allocated by line value and
  server-authoritative (a full return of every line sums exactly to grandTotal);
  (2) the full pickup + inspection + events lifecycle (DB-Design §§85-92 maps).
- **Design decisions confirmed by owner (custom answers, not defaults):** refund
  model = proportional share of grand total; workflow depth = full lifecycle
  (events + pickup + inspection), over reviews / split-checkout / real gateway.
- **Schema/migration `20260907134000_return_item_lifecycle`:** `ReturnStatus`
  expanded to 9 states (…PICKUP_SCHEDULED/PICKED_UP/INSPECTION/
  APPROVED_FOR_REFUND/CANCELLED); enums `InspectionVerdict`(PASS/PARTIAL_PASS/FAIL),
  `ReturnEventType`, `ReturnItemStatus`, `RefundState` gained PROCESSING/SUCCESS/
  FAILED; models `ReturnItem`(return_items), `ReturnEvent`(return_events),
  `ReturnInspection`(return_inspections), `RefundTransaction`
  (refund_transactions); `OrderItem.returnItems` rel and
  `@@unique([returnRequestId, orderItemId])`. 10 migrations total; `migrate
  deploy` clean.
- **ReturnsService (canonical flow):** customer `request` selects order items +
  quantities (ownership + DELIVERED + window + per-order-item already-in-flight
  guards; `ReturnRequest` idempotency). Operator: `decision` approve/reject
  (reject-reason mandatory) → `schedulePickup`/confirm → `markPickedUp` →
  `inspect` per line PASS/PARTIAL_PASS(50%)/FAIL → auto
  `APPROVED_FOR_REFUND` with server-amounted per-item refund
  (`INSPECTION_PARTIAL_PASS_RATE = 0.5`; a PASS line refunds its share; a FAIL
  line is removed from refundable) → `initiateRefund` (GATEWAY for PREPAID / COD
  for cash; guard so cumulative never exceeds grand across partials) → sandbox
  `completeRefund` writes `refund_transactions` SUCCESS and, only when the sum of
  COMPLETED refunds reaches grandTotal, flips the order to
  `REFUNDED`/`paymentStatus REFUNDED` + ReturnRequest `COMPLETED`. Partial
  returns leave the order `DELIVERED`. `return_events` audit every transition
  (REQUESTED→APPROVED→PICKUP_SCHEDULED→PICKED_UP→APPROVED_FOR_REFUND
  →REFUND_INITIATED→REFUND_COMPLETED; sentinel `APPROVED_FOR_REFUND` reason
  "Inspection complete"). Audit fix this session: in a fully-passing inspection
  the redundant `INSPECTION` event was removed so `APPROVED_FOR_REFUND` is the
  single recorded sentinel.
- **Public API additions:** customer order items now expose `orderItemId` (the DB
  order-item id) so customers can issue item-scoped returns; item-level
  `CreateReturnDto`/`ReturnDecisionDto`/`InspectionDto`; `ReturnItemPublic`,
  extended `ReturnRequestPublic`. RBAC: requests/decisions operator-gated; a
  non-operator customer hitting the inspection endpoint is `403 FORBIDDEN`.
- **Tests:** returns.service.spec rebuilt to item-level (17 cases): create scoped
  to an order item+quantity, duplicate-in-flight, decision approve/reject, pickup
  state guards, per-line inspect PASS/PARTIAL_PASS(50%)/FAIL, proportional refund
  amount, aggregate full-return == grandTotal, initiate never exceeding grand
  across partials, complete refund → order REFUNDED only when aggregate covers
  grand. Full suite now 11 suites / 66 tests; typecheck + build clean.
- **Live E2E:** product `khatta-meetha-delight` (2-unit PREPAID order grand ₹403.90
  incl. delivery): Return #1 qty1 PASS → refund ₹201.95 COMPLETED, order stayed
  DELIVERED/PAID; Return #2 remaining qty PASS → ₹201.95; cumulative 403.90 ==
  grand → order auto-flipped to REFUNDED/REFUNDED. `refund_transactions` each
  SUCCESS; customer-facing RBAC 403 verified. See VERIFICATION Session 08 table.

## Session 09 — Seller orgs + multi-seller catalog + split-checkout (seller_orders) core
- **Date:** 2026-09-07
- **Objective (owner-selected scope "B"):** introduce a `SELLER`-role + Seller org
  model, make the catalog multi-seller (`Product.sellerId`), and split a single
  customer order into per-seller `seller_orders` at checkout with a seller-order
  status lifecycle (accept/reject) — while leaving order-level money/payment/
  returns/refunds/fulfilment untouched so the proven flows keep working. Seller
  onboarding/KYC, per-seller delivery + fulfilment-gating, and payables/
  settlements are deferred.
- **Schema/migration `20260907142140_seller_split_checkout`:** enums `SellerStatus`,
  `SellerOrderStatus`; models `Seller` (sellers) and `SellerOrder` (seller_orders);
  `Product.sellerId` (required); `OrderItem.sellerOrderId` + `sellerNameSnapshot`;
  `User.sellerId` (SELLER-role operator binding). Migration backfills a DB that
  already held data: creates legacy + partner sellers, assigns existing products to
  the legacy seller (then moves `shahi-kaju-mixture` & `roasted-peri-makhana` to the
  partner), creates one seller_order per existing order (single-seller historical)
  and links all existing order_items. 11 migrations total; `migrate deploy` clean.
- **Order capture (checkout + buy-now) is now split-aware:** each line carries its
  seller; `sellerAllocation` groups by seller and gives each seller_order its real
  subtotal + a proportional (line-value) share of order tax/discount/delivery/grand,
  with the last seller absorbing rounding so **Σ seller_order.grandTotal ===
  order.grandTotal exactly**. The customer `Order` remains the single authoritative
  money/payment/refund entity; seller_amount = grandTotal (settlement placeholder).
  Order items now live on their seller_order with a seller-name snapshot. Order
  cancellation cascades open seller_orders → CANCELLED. Customer order view and
  create responses expose `sellerOrders` + per-item `sellerName`.
- **Seller-ops surface (`@Roles(SELLER)`, scoped to the caller's seller):**
  `/seller/me`, `/seller/products` (own catalog), `/seller/orders` (+ `/:id` list
  the seller's slices with order context), and `accept` / `reject`(reason) driving
  PLACED→ACCEPTED/REJECTED. Cross-seller access is 404 (scoped); empty reject reason
  400; non-seller 403; re-accept/transition-from-wrong-state 400.
- **Seed:** sellers upserted (Bilokat Kitchens `SELL-BILOKAT` = legacy, Rajrani
  Select `SELL-RAJRANI` = partner); products assigned by id; two SELLER-role
  operators (`seller1@example.com`/`seller2@example.com`, dev pwd `Seller@123`)
  bound to each seller. Idempotent upserts.
- **Tests:** order.service.spec gained a multi-seller split + reconciliation case
  and its mocks were updated for seller_order/order_item creation (now 12); new
  seller-ops.service.spec (9: role/binding/active guards, scoping, accept, reject
  reason-mandatory + transition, non-PLACED 400, not-own 404). Full suite 12
  suites / **76 tests**; typecheck + build clean.
- **Live E2E:** buyer cart with `ratlami-sev`×2 (Bilokat) + `shahi-kaju-mixture`
  (Rajrani) → COD checkout grand ₹710.85 split into seller_orders ₹396.90
  (Bilokat, 1 item) + ₹313.95 (Rajrani, 1 item); Σ == grand; per-item sellerName
  present. seller1 accept → ACCEPTED; seller2 reject (reason) → REJECTED;
  seller2 touching Bilokat slice 404; empty reject 400; buyer 403; re-accept 400.
  Order cancel → seller_orders CANCELLED (ACCEPTED slice), REJECTED slice stays.
  buy-now (single seller) → exactly 1 seller_order. Returns/refunds/fulfilment
  regression green. See VERIFICATION Session 09.

## Session 10 — Per-seller fulfilment gating + delivery markers
- **Date:** 2026-09-07
- **Objective (owner-selected):** connect the existing order-level fulfilment/delivery
  machine to sellers — require every non-cancelled seller slice to be ACCEPTED
  before an order ships/delivers, and record a per-seller shipment/delivery
  point-in-time.
- **Schema/migration `20260907143713_seller_fulfilment_markers`:** adds
  `shippedAt`/`deliveredAt` (nullable) to `seller_orders`. 12 migrations total;
  `migrate deploy` clean.
- **FulfilmentService gate:** `SHIPMENT_STAGES` = {SHIPPED, OUT_FOR_DELIVERY,
  DELIVERED}. On any advance into those stages the service reads the order's
  seller_orders and requires every non-CANCELLED slice to be `ACCEPTED`; a still-
  `PLACED` or `REJECTED` slice throws BadRequest naming the sellers (`…Not ready:
  <seller> (PLACED/REJECTED)`). On SHIPPED it stamps `shippedAt` on accepted slices;
  on DELIVERED it stamps `deliveredAt`. Existing confirmation (payment/OTP) gate and
  guarded `updateMany` transitions are unchanged.
- **Projections:** order view and seller-ops order projections now expose
  `shippedAt`/`deliveredAt` (and acceptedAt/rejectedAt/rejectionReason) per slice.
- **Tests:** fulfilment.service.spec extended (5 new: blocks SHIPPED when a slice is
  REJECTED naming it; blocks when still PLACED; allows SHIPPED when all accepted and
  stamps shippedAt; ignores CANCELLED slices; stamps deliveredAt at DELIVERED). Full
  suite 12 suites / **81 tests**; typecheck + build clean.
- **Live E2E:** multi-seller PREPAID order (Bilokat + Rajrani) driven to PACKED;
  operator SHIPPED → 400 naming both PLACED sellers; seller1 + seller2 ACCEPT →
  both ACCEPTED; operator SHIPPED → 200; operator DELIVERED → 200; both slices have
  shippedAt + deliveredAt set; seller-ops order projection shows them. See
  VERIFICATION Session 10.

## Session 11 — Partial fulfilment resolution of rejected seller slices
- **Date:** 2026-09-07
- **Objective (owner-selected):** choose the rule for a seller slice REJECTED before
  shipping. Owner picked **partial fulfilment**: the rejected slice is cancelled and
  removed, the remaining accepted sellers ship together as one order-level delivery,
  and for a PREPAID order the buyer is refunded that slice's share. (Rejected
  alternatives: auto-cancel-all and reassign/retry. No onboarding/KYC,
  payables/settlements, per-seller delivery part-items, replacement, or reviews were
  widened into this session.)
- **Schema/migration `20260907232834_partial_fulfilment_resolution`:** adds nullable
  `refunds.sellerOrderId` (FK → seller_orders) + index, drops NOT NULL on
  `refunds.returnRequestId` (PG unique permits many NULLs), adds
  `seller_orders.cancelledAt` + `cancellationReason`. 13 migrations total;
  `migrate deploy` clean. Prisma schema gained `SellerOrder↔Refund` relations.
- **`OrderService.resolveRejectedSlice(actorUserId, orderId, sellerOrderId, reason?)`:**
  preconditions — order status PLACED/CONFIRMED/PACKED (must be pre-shipment) and the
  slice `REJECTED`; for PREPAID, `paymentStatus=PAID` is required before a partial
  refund is permitted. In one transaction it: marks the slice `CANCELLED` (with
  cancelledAt + reason); releases **only that slice's** items' stock; for PREPAID
  creates one **COMPLETED** `Refund` (method GATEWAY, sandbox gatewayRef + SUCCESS
  `RefundTransaction`) for the slice's `grandTotal`, guarding cumulative refunds
  against the order grand total; and appends an `order_status_history` row (actor
  CONTROL, metadata `seller-slice-resolution`).
- **Hardened `cancelOrder`:** no longer releases stock for items of already-CANCELLED
  slices (prevents double release via a prior partial resolution); bulk-cancels only
  non-CANCELLED slices with cancelledAt + reason.
- **Endpoint:** `POST /orders/:orderId/slices/:sellerOrderId/resolve-reject`
  `@Roles('OPERATOR','ADMIN')` in `order-resolution.controller.ts`; DTO reason added in
  `src/commerce/dto/seller.dto.ts`.
- **Projections:** order view and seller-ops projections expose
  `cancelledAt`/`cancellationReason` per slice.
- **Tests:** order.service.spec extended (5 new: happy PREPAID path completes one
  GATEWAY refund for slice grandTotal + releases only that slice's stock + CANCELLED;
  non-REJECTED slice refuses; post-shipment refuses; PREPAID pre-PAID refuses;
  unknown order/slice → NotFound). Full suite 12 suites / **86 tests**; typecheck +
  build clean.
- **Live E2E:** multi-seller PREPAID order `BK-MTRVM3QQ` (Bilokat ₹396.90 + Rajrani
  ₹313.95; grand ₹710.85) captured PAID → CONFIRMED → PACKED; seller1 ACCEPTED
  (Bilokat), seller2 REJECTED (Rajrani, "out of stock"); operator
  `resolve-reject` on the Rajrani slice → slice CANCELLED (cancelledAt + reason
  "Rajrani cannot fulfil - cancelled for partial delivery"), kaju `stockOnHand`
  released back to 8 (seeded value), one **COMPLETED** refund `RFD-…` GATEWAY
  ₹313.95 with `sellerOrderId` bound and **no** `returnRequestId`; operator SHIPPED →
  200 and DELIVERED → 200 shipping only the ACCEPTED Bilokat slice (its shippedAt +
  deliveredAt stamped; Rajrani slice untouched); customer order view exposes the
  cancelled slice's cancelledAt/cancellationReason. See VERIFICATION Session 11.

## Session 12 — Seller payables & settlements
- **Date:** 2026-09-07
- **Objective (owner-selected):** close the seller money loop opened in Session 09
  (split seller_orders with money attribution) and Session 11 (rejected slices cancel
  + refund) by defining exactly how much each seller is owed per fulfilled order and
  rolling those amounts into an audited settlement/payout ledger. Owner decisions:
  money rule = **seller earns goods value minus commission** (Bilokat retains the tax
  it remits and the delivery charge); commission is **per-seller
  `commissionRateBps`** (Bilokat platform seller 0, partner Rajrani 1000 bps = 10%);
  a payable is **auto-earned at DELIVERED** for each accepted slice (a cancelled/
  rejected Session-11 slice earns nothing).
- **Schema/migration `20260907234906_seller_payables_settlements`:** adds
  `Seller.commissionRateBps`; new tables `seller_payables`,
  `seller_payable_adjustments`, `settlements`, `settlement_items`,
  `settlement_events`; enums `PayableStatus` (EARNED/IN_SETTLEMENT/SETTLED) and
  `SettlementStatus` (PENDING/APPROVED/PROCESSING/PAID/RECONCILED/FAILED).
  `seller_payables.sellerOrderId` is unique (a delivered slice earns at most one
  payable); `settlement_items.sellerPayableId` is unique (a payable can be in only
  one settlement). 14 migrations total; `migrate deploy` clean.
- **Money rule:** for each slice, `goodsValue = subtotal − discountTotal`;
  `commissionAmount = round(goodsValuePaise·bps/10000)` (paise-safe); `netPayable =
  goodsValue − commission − refunds − adjustments`; Bilokat retains `taxAmount` +
  `deliveryAmount`. Invariant `net + commission + tax + delivery == slice.grandTotal`
  (asserted in live E2E and tests).
- **Auto-earn at DELIVERED:** the operator `fulfilment/advance` (already the step
  that stamps `deliveredAt` on accepted slices) now calls
  `SettlementService.earnDeliveredSlices` inside the same transaction, creating an
  EARNED `SellerPayable` for each ACCEPTED slice of the just-delivered order. Idempotent
  via the unique sellerOrderId; CANCELLED/REJECTED slices never earn.
- **Finance ops (`@Roles(OPERATOR,ADMIN)`), `/api/v1/finance`:** payables list/detail;
  `POST /payables/:id/adjustments` (signed, reason+actor required, append-only, only on
  EARNED, never below zero); settlements list/detail/create (guards: all payables belong
  to the seller, all still EARNED — else 409); `POST /settlements/:id/advance` through
  PENDING→APPROVED→PROCESSING→PAID→RECONCILED (PROCESSING→FAILED→PROCESSING retry),
  each step an audited `settlement_events` row; reaching PAID marks the included
  payables SETTLED. No financial value is rewritten (adjustments are additive).
- **Seller-facing reads (`@Roles(SELLER)`), `/api/v1/seller`:** payables + settlements
  (scoped to the caller's own seller org via `users.sellerId`).
- **Tests:** new `settlement.service.spec.ts` (15: money-rule maths incl. paise
  rounding + exact reconciliation, earn-only-accepted + idempotency, adjustment net
  reduction / below-zero rejection / not-EARNED rejection, settlement create sum +
  IN_SETTLEMENT marking, double-inclusion 409, cross-seller 400, illegal-jump 409,
  PROCESSING→FAILED→retry, getPayable 404). `fulfilment.service.spec` updated for the
  injected `SettlementService`. Full suite 13 suites / **101 tests**; typecheck +
  build clean.
- **Live E2E:** fresh PREPAID multi-seller order `BK-MTRWEGUT` (Bilokat ₹396.90 +
  Rajrani ₹313.95) captured PAID, accepted, shipped, delivered → payables auto-earned
  and reconciling exactly (Bilokat net ₹378.00 @0%; Rajrani net ₹269.10 = 299 − 29.90
  @10%); operator -₹10 adjustment → ₹259.10; settlement STL-445969B3 PENDING → net
  ₹259.10, advanced APPROVED→PROCESSING→PAID→RECONCILED; Rajrani payable SETTLED,
  Bilokat EARNED; RECONCILED→PAID and second-inclusion both rejected; Rajrani seller
  sees own payable+settlement. Second order `BK-MTRWFK4Z`: Rajrani slice REJECTED then
  resolve-reject (Session 11), delivered → only the accepted Bilokat slice earned
  ₹189.00, the CANCELLED Rajrani slice earned **₹0**. See VERIFICATION Session 12.
