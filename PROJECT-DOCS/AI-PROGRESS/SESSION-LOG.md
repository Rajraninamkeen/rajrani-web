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

## Session 13 — Finance reconciliation + reporting (auto return-debit)
- **Date:** 2026-09-08
- **Objective (owner-selected):** put read-only integrity checks and finance reporting
  on top of the Session 12 seller-payables/settlements ledger, and close the last
  finance loop — a **completed customer refund now automatically debits the delivered
  seller's earned payable** for the returned goods. Owner decision (sub-rule):
  **net-zero on full return** — the seller keeps nothing for returned goods, so the
  debit = `returnedGoodsValue × (1 − sellerCommissionRate)`, floored at the payable's
  remaining net (never driven below zero), recorded as an audited append-only
  `seller_payable_adjustments` row with `actorType: SYSTEM` (actor = returnRequestId).
- **No schema/migration in this session** (14 migrations still applied; `migrate
  deploy` clean). All changes are service/controller/DTO/test logic.
- **Auto return-debit (`SettlementService.debitReturnedGoodsForRefund`, called from
  `ReturnsService.completeRefund` inside the refund's own `$transaction`):** the
  completed-refund step maps each refunded return item back to its delivered slice via
  `orderItem.sellerOrderId` and passes the returned **goods** value
  (`unitPrice × quantity`) to the debit. The debit applies only to an **EARNED**
  payable (a payable already IN_SETTLEMENT/SETTLED is intentionally left alone and
  surfaced by reconciliation); updates the payable's `refundAmount` and `netPayable`
  and keeps the stored signed `adjustmentAmount` aggregate consistent with the ledger
  (matching the manual `addAdjustment` semantics). A full return drives that slice's
  payable to ₹0.
- **Reconciliation (`GET /finance/reconciliation/summary`, OPERATOR/ADMIN; read-only):**
  `SettlementService.runReconciliation` checks over DELIVERED/REFUNDED orders —
  order-split invariant (Σ `seller_orders.grandTotal == order.grandTotal`), refund cap
  (completed refunds ≤ order grand), every ACCEPTED+delivered slice has a payable and
  no CANCELLED slice has one, no negative payable, and each payable's net is recomputed
  from its append-only adjustment ledger (`net == goodsValue − commission +
  Σ adjustments`). Returns `{ checked, discrepancies[], discrepancyCount, ok,
  generatedAt }`. On the live DB it correctly flags exactly one **pre-existing
  historical** discrepancy (`delivered_slice_missing_payable` in the pre-settlement
  E2E order `cmtrvm3r9…`) and none from the auto-debit.
- **Reporting (`GET /finance/report/totals`, OPERATOR/ADMIN):**
  `SettlementService.reportTotals` groupBy seller over payables with optional `from`/
  `to` (earnedAt) + `sellerId` filters (DTO-whitelisted), returning per-seller and
  grand totals for gross/discount/goods/commission/tax/delivery/refund/adjustment/net +
  payable count.
- **Controller/DTO:** new routes on `settlement-ops.controller.ts` (`reconciliation/
  summary`, `report/totals`); `ReconciliationReportQuery` gains optional
  `sellerId`/`from`/`to`. ReturnsService now injects SettlementService (wiring added,
  spec mock updated). RBAC unchanged — no new FINANCE role (OPERATOR/ADMIN read; seller
  self-service reads unchanged).
- **Tests:** settlement spec +9 (debit maths incl. commission, floor-at-remaining-net
  clamp, skip non-EARNED/settled + missing payable, 0% seller full-goods debit,
  stored-adjustment-aggregate update; reconciliation clean/order-split/missing-payable/
  ledger-mismatch; reportTotals grouping) and returns spec +1 asserting
  `completeRefund` calls the debit with the refunded slice grouped by goods. Full suite
  **13 suites / 110 tests** (was 101); typecheck + build clean.
- **Live E2E (`:4000`):** customer full item-level return on the delivered Bilokat slice
  of `BK-MTRWFK4Z` (₹189 EARNED payable `cmtrwfv3…`) → approve → pickup → picked-up →
  inspection PASS → initiate `RFD-MTRX0MTT-PB39` ₹217.43 → complete → payable auto-
  debited to **net ₹0** (refund ₹189) with audited SYSTEM `−189` adjustment; the
  reconciliation endpoint returns the checks (only the one pre-existing historical
  discrepancy), and the report totals return per-seller + grand totals (Bilokat net
  ₹378 / refund ₹189 / adj −₹189; Rajrani adj −₹10 net ₹259.10; grand net ₹637.10);
  `?sellerId=` and date filters verified; CUSTOMER→403 / no-token→401 on the finance
  routes; seller self-service `/seller/payables` scoped to own org. See VERIFICATION
  Session 13.

## Session 14 — Seller onboarding/KYC + Organizations + REVIEWER role
- **Date:** 2026-09-08
- **Objective (owner-selected via ask_user):** (1) additive **full Organization /
  OrganizationMember** model for seller orgs; (2) onboarding application origin =
  **BOTH self-service and operator-managed**; (3) a **separate REVIEWER role** with
  onboarding-only scope. This closes the "no seller onboarding/KYC" gap and gives the
  SELLER lifecycle an explicit approval-state machine on top of the existing
  ACTIVE/SUSPENDED/DEACTIVATED operational values.
- **Schema/migration `20260908100000_orgs_onboarding_kyc`** (15th, applied to the live
  DB via `psql -f` + manual `_prisma_migrations` insert using a plain `INSERT ...
  WHERE NOT EXISTS` — `ON CONFLICT` fails because `_prisma_migrations` has no unique
  constraint on `migration_name`; do not re-apply). Adds: `Organization` +
  `OrganizationMember` (SELLER-type org per seller; the seller operator is bound as an
  **OWNER** member via `organization_members`); `SellerStatus` expanded with
  `REGISTERED/PENDING/UNDER_REVIEW/APPROVED/REJECTED` (ACTIVE/SUSPENDED/DEACTIVATED
  retained as the operational gate values all commerce code already checks);
  `Seller.organizationId` (FK → organizations) + `activatedAt`; tables
  `seller_applications` / `seller_documents` / `seller_reviews` /
  `seller_status_history`. `Seller.operators` (`users.sellerId`) is **retained** as a
  denormalized convenience so Session 09-13 commerce/seller-ops/settlement code is
  untouched (additive strategy).
- **Auth:** `ROLES` gains `REVIEWER`. New public `POST /auth/seller-register`
  (`SellerRegisterDto`; `AuthService.sellerRegister()`): one `$transaction` creating a
  SELLER org (slug `org-<slugified-name>-<hex>`), a PENDING seller with a random
  `SELL-XXXXXXXX` sellerCode, a DRAFT `SellerApplication`, an ACTIVE SELLER user and an
  OWNER `OrganizationMember`; returns `{ user, tokens, seller }` (duplicate email 409).
- **New `src/seller/` module (`SellerModule`)** with `SellerOnboardingService` +
  owner/staff controllers. Lifecycle/state machine (audited each transition in
  `seller_status_history`):
  `REGISTERED → PENDING → UNDER_REVIEW →(approve)→ APPROVED →(activate)→ ACTIVE`;
  reviewer CORRECTION_REQUIRED / ADDITIONAL_INFORMATION_REQUIRED returns the seller to
  PENDING for a resubmit loop; REJECT → REJECTED; OPERATOR/ADMIN sets ACTIVE /
  SUSPENDED / DEACTIVATED operationally.
  - **Owner surface** `/api/v1/seller/onboarding/*` (`@Roles(SELLER)`, resolved to the
    caller's own seller via `users.sellerId`): `GET me`, `PATCH profile`, `POST
    documents` (records **storage-intent only** — storageObjectId/fileName/mimeType/
    sizeBytes, PENDING; no real object store), `POST submit`. Owner editing/submit is
    allowed only while seller is REGISTERED/PENDING/UNDER_REVIEW; once ACTIVE it is
    409 ("not editable").
  - **Staff surface** `/api/v1/seller-onboarding/*`:
    `POST sellers` (**OPERATOR/ADMIN**; creates an already-ACTIVE seller org, optional
    operatorEmail → OWNER member; regression: status-history is written on the `tx`
    client inside the transaction — an earlier build wrote it via `this.prisma`,
    which is invisible to the open transaction and caused an FK 500, now unit-tested);
    `GET applications` + `GET applications/:id` (**REVIEWER/ADMIN**); `POST
    applications/:id/review` (**REVIEWER/ADMIN**; APPROVE/REJECT/
    CORRECTION_REQUIRED/ADDITIONAL_INFORMATION_REQUIRED, closed apps 409);
    `POST documents/:id/verify` (**REVIEWER/ADMIN**); `POST sellers/:id/activate`
    (**REVIEWER/ADMIN/OPERATOR**; APPROVED→ACTIVE only); `POST sellers/:id/status`
    (**OPERATOR/ADMIN** operational).
  - **REVIEWER RBAC:** onboarding-only — 403 on `/finance/**`, `/fulfilment/**`,
    `/return-requests/**`, `/seller/orders/**`, and the OP/ADMIN seller-create/status
    routes. `seed.ts` backfills each seeded seller's org + OWNER membership.
- **Tests:** `seller-onboarding.service.spec.ts` +12 (me/profile/submit transitions,
  terms gate, review APPROVE/REJECT/CORRECTION, closed-app guard, activate APPROVED→
  ACTIVE + non-APPROVED 409, addDocument + block-when-ACTIVE, verifyDocument,
  adminSetSellerStatus, adminCreateSeller tx-history regression, OWNER-member bind);
  `auth.seller-register.spec.ts` +2. Full suite **15 suites / 124 tests** (was 110);
  typecheck + build clean.
- **Live E2E (`:4000`):** created a REVIEWER fixture; REVIEWER → 403 on owner/finance/
  settlement/seller-order routes and on admin-create; seller self-register → me →
  profile → upload doc → submit (SUBMITTED) → reviewer list/detail → review APPROVE →
  activate (ACTIVE, activatedAt set) → 409 on re-review of a closed app + 409 on owner
  editing once ACTIVE; OPERATOR `adminCreateSeller` returns an ACTIVE seller + OWNER
  member (the FK 500 bug fixed in this pass). See VERIFICATION Session 14.
## Session 15 — Per-slice delivery / courier handoff (DELIVERY role)
- **Date:** 2026-09-08
- **Objective (owner-selected via ask_user):** move the delivery last-mile from the generic
  order-level operator advance onto a **per-slice courier model** with a dedicated
  **DELIVERY** role, running as an additive layer **on top of** the existing order-level
  delivery + money trigger. Owner decision: **seller payables still auto-earn at order
  DELIVERED** (Session 12/13 net-zero money + reconciliation unchanged) — per-slice courier
  delivery finalizes the order only when every non-cancelled slice is delivered.
- **Schema/migration `20260908150000_seller_slice_delivery_courier`** (16th, applied to the
  live DB via `psql -f` + `_prisma_migrations` insert; `migrate status` up to date). Adds
  `delivery_partners`, `delivery_assignments` (keyed to a `seller_orders` slice, with
  denormalized `orderId` + assignment audit timeline), `delivery_events`, and enums
  `DeliveryPartnerStatus` + `DeliveryAssignmentStatus`
  (ASSIGNED→ACCEPTED→PICKED_UP→OUT_FOR_DELIVERY→DELIVERED, plus REJECTED/FAILED/CANCELLED).
  No ALTERs to existing money/order tables — fully additive. Back-relations added on
  `Order`/`SellerOrder`/`User`.
- **Auth:** `ROLES` gains `DELIVERY` (courier/delivery partner). Partner profiles bind a
  DELIVERY-role user one-to-one (`delivery_partners.userId` unique).
- **New `src/commerce/delivery.service.ts` + controllers (registered in CommerceModule):**
  - OPERATOR/ADMIN `/delivery`: `POST /partners` (register a DELIVERY user as an ACTIVE
    partner), `GET /partners`, `PATCH /partners/:id/status`, `GET /assignments`,
    `GET /assignments/:id` (detail + events), `POST /slices/:sellerOrderId/assign` and
    `/reassign`, `POST /assignments/:id/cancel`.
  - DELIVERY `/delivery/tasks`: `GET` (my active tasks), and `accept`, `reject` (reason),
    `pickup`, `out-for-delivery`, `deliver`, `fail` (reason) per assignment.
  - Guards: assign requires the slice ACCEPTED + not delivered + order SHIPPED/OUT_FOR_DELIVERY
    + an ACTIVE partner + no existing active assignment; a partner can only act on its own
    assignment; steps are ordered (ASSIGNED→ACCEPTED→PICKED_UP→OUT_FOR_DELIVERY→DELIVERED).
  - **`deliver`** sets the slice's `deliveredAt` and the assignment DELIVERED; when no
    non-cancelled slice of the order remains undelivered it finalizes the order to DELIVERED
    in the same transaction (order `deliveredAt`, COD_PAID for COD, an `order_status_history`
    CONTROL row) and calls `SettlementService.earnDeliveredSlices(tx, orderId)` — reusing the
    Session 12/13 earn path unchanged. Delivery events audit every step.
  - RBAC: DELIVERY is courier-scoped — 403 on finance/fulfilment/seller/onboarding/op-create
    routes; OPERATOR/REVIEWER are 403 on the DELIVERY-only task surface.
- **Tests:** `delivery.service.spec.ts` +12 (registerPartner role/dup, assign guards, courier
  step ordering, own-assignment authorization, reject/fail, non-last-slice vs last-slice
  deliver → earn only on the last slice). Full suite **16 suites / 136 tests** (was 124);
  typecheck + build clean.
- **Live E2E (`:4000`):** created a DELIVERY fixture; OPERATOR registered its ACTIVE partner
  profile (`DLV-…`); DELIVERY → 403 on `/delivery/partners`, `/delivery/assignments`, and
  `/finance/settlements`; OPERATOR → 403 on `/delivery/tasks` and REVIEWER → 403 on
  `/delivery/partners`; DELIVERY `GET /delivery/tasks` 200 (empty); OPERATOR assignment list
  200 (0); `assign` on a bogus slice → 404. Full slice→DELIVERED+earn courier delivery was
  **unit-tested**, not re-run live (no courier-stage order existed in the live DB). See
  VERIFICATION Session 15.

## Session 16 — Return replacement (exchange) vs refund + evidence upload

- **Date:** 2026-09-08
- **Owner decision (feature picker):** "Add an exchange/replacement path and customer
  photo/evidence upload to the existing item-level returns flow (Session 08), keeping the
  refund/auto-debit money logic intact." Scope locked: a return request declares a
  `REFUND` (default) or `REPLACEMENT` resolution; evidence upload is supported; a
  REPLACEMENT-resolved return goes terminal `REPLACEMENT_ISSUED` with **no Refund and no
  seller-payable auto-debit**; REFUND-resolved requests keep the exact existing money path.
- **Schema (additive; migration `20260908160000_return_replacement_evidence` + follow-up
  `20260908161000_return_evidence_enum` — 18 migrations total):**
  - `ReturnRequest.resolution ReturnResolution?` + auto `evidenceRequired` (true when a
    request is REPLACEMENT). Existing `ReturnItem.replacementRequested` (previously unused)
    is now set true on REPLACEMENT-resolution items — the natural Session 16 hook.
  - `enum ReturnResolution { REFUND | REPLACEMENT }`; `ReturnStatus` += `REPLACEMENT_ISSUED`;
    `ReturnEventType` += `REPLACEMENT_ISSUED`, `EVIDENCE_UPLOADED`.
  - New `ReturnEvidence` (`return_evidence`) — storage-intent object reference
    (`storageObjectId`, fileName/mime/size/kind IMAGE|VIDEO, uploadedBy/At), never raw binary.
  - New `Replacement` (`replacements`) + `enum ReplacementStatus`
    (PENDING_DISPATCH/DISPATCHED/COMPLETED/CANCELLED): one replacement per return
    (`returnRequestId @unique`), captures order/sellerOrder/qty, `replacementReference RPL-…`.
  - Applied via `psql -f` + manual `_prisma_migrations` insert (`WHERE NOT EXISTS`, short
    varchar(36) ids), then `prisma generate`; `migrate status` up to date.
- **Service/DTO/controller (`src/commerce/returns.service.ts`, `dto/returns.dto.ts`,
  `returns.controller.ts`, `return-ops.controller.ts`, `commerce.types.ts`):**
  - `CreateReturnDto` += optional `resolution` and nested `evidence[]`; new `EvidenceUploadDto`.
  - `ReturnsService.request` stores the resolution + evidence and stamps per-item
    `replacementRequested`.
  - Evidence methods: customer `POST /orders/:orderId/returns/:returnRequestId/evidence`
    (ownership-enforced) and OPERATOR `POST /return-requests/:returnRequestId/evidence`;
    both append a `return_evidence` row + an audited `EVIDENCE_UPLOADED` event; blocked on a
    terminal request (REPLACEMENT_ISSUED/COMPLETED/CANCELLED).
  - `inspect`: when inspection completes and `resolution == REPLACEMENT`, the request goes
    **terminal `REPLACEMENT_ISSUED`**, creates a `replacement` (qty = non-FAIL units,
    PENDING_DISPATCH) and a `REPLACEMENT_ISSUED` event — **no refundAmount allocation, no
    Refund, no `debitReturnedGoodsForRefund`**. If no unit passed (all FAIL) → 400. For
    `REFUND`/null resolution the existing APPROVED_FOR_REFUND + refund path is unchanged.
  - A `REPLACEMENT_ISSUED` request cannot be refunded (initiateRefund requires
    APPROVED_FOR_REFUND → 409), so the money path can never be triggered on a replacement.
  - Public shapes += `resolution`, `evidenceRequired`, `evidence[]`, `replacement`; REFUND
    default.
- **Tests:** `returns.service.spec.ts` +9 (REPLACEMENT resolution storage + evidenceRequired
  + items `replacementRequested`, REFUND default, terminal replacement issuance w/o refund/
  auto-debit, all-FAIL guard, refund blocked on REPLACEMENT_ISSUED, customer & operator
  evidence uploads with correct actor events, evidence blocked on terminal, cross-owner 404).
  Full suite **16 suites / 145 tests** (was 136); typecheck + build clean.
- **Live E2E (`:4000`) on delivered order `BK-MTRWEGUT` (s12@example.com):** see
  VERIFICATION Session 16. Replacement path (→ `REPLACEMENT_ISSUED` + `RPL-…`, refund 409)
  and REFUND path (→ APPROVED_FOR_REFUND → refund → COMPLETED, money intact) both confirmed;
  CUSTOMER → 403 on OPERATOR evidence route.

## Session 17 — Outbound replacement dispatch (finish the ReplacementStatus lifecycle)

- **Date:** 2026-09-08
- **Owner decision:** "Drive outbound replacement dispatch" — finish the Session 16 modelled
  `ReplacementStatus` lifecycle by adding the OPERATOR API to dispatch a PENDING_DISPATCH
  replacement (`DISPATCHED → COMPLETED/CANCELLED`) with audit events. Replacement stays a
  **non-money** leg (no ledger, no seller-payable debit); the refund/auto-debit money path is
  untouched.
- **Schema (additive; migration `20260908170000_replacement_dispatch` — 19 migrations total):**
  - `ReturnEventType` += `REPLACEMENT_DISPATCHED`, `REPLACEMENT_COMPLETED`, `REPLACEMENT_CANCELLED`.
  - `Replacement` += nullable `dispatchReference`, `dispatchNote`, `dispatchBy`, `cancellationReason`.
  - Applied via `psql -f` + manual `_prisma_migrations` insert; `prisma generate`; `migrate status` up to date.
- **Service/DTO/controller (`returns.service.ts`, `dto/returns.dto.ts`, `return-ops.controller.ts`,
  `commerce.types.ts`):**
  - New OPERATOR/ADMIN endpoints under the existing return-ops surface (one replacement per return,
    addressed by `returnRequestId`):
    - `POST /return-requests/:returnRequestId/replacement/dispatch` `{ dispatchReference?, dispatchNote? }`
      → `PENDING_DISPATCH → DISPATCHED` (sets dispatchedAt/dispatchBy/ref/note).
    - `POST /return-requests/:returnRequestId/replacement/complete` → `DISPATCHED → COMPLETED`.
    - `POST /return-requests/:returnRequestId/replacement/cancel` `{ reason }` →
      `PENDING_DISPATCH | DISPATCHED → CANCELLED` (reason required).
  - Guards: the return request must be terminal `REPLACEMENT_ISSUED` with a replacement in the expected
    `ReplacementStatus` (else 409); cancel requires a reason; completed replacements can't be cancelled.
  - Each step writes an audited `ReturnEvent` (REPLACEMENT_DISPATCHED/COMPLETED/CANCELLED, OPERATOR actor).
  - Public `ReplacementPublic` += dispatchReference/dispatchNote/dispatchBy/cancelledAt/cancellationReason.
- **Tests:** `returns.service.spec.ts` +8 (dispatch PENDING→DISPATCHED audited + no money, block dispatch
  unless PENDING or unless return is REPLACEMENT_ISSUED, complete DISPATCHED→COMPLETED, block completing
  non-dispatched, cancel with required reason, block cancel without reason, block cancel of a completed
  replacement). Full suite **16 suites / 153 tests** (was 145); typecheck + build clean.
- **Live E2E (`:4000`):** see VERIFICATION Session 17. Drove Session 16's `PENDING_DISPATCH` replacement
  to DISPATCHED then COMPLETED (with guards), and a fresh replacement return on `BK-MTRVM3QQ` to CANCELLED;
  CUSTOMER → 403 on the operator dispatch route; refund on a replacement still 409.

## Session 18 — Real payment gateway (Razorpay) behind the pluggable payment seam + LIVE refund execution

- **Date:** 2026-09-08
- **Owner decision:** "Integrate a real Razorpay gateway behind the existing pluggable payment seam, with live refund
  execution replacing the sandbox/legacy fabricated capture/refund path." Constraints honoured: **sandbox stays the
  default provider** and every prior behaviour stays green; the real gateway must not break the historical unit-test
  seam (`new PaymentService(prisma)` / `new ReturnsService(prisma, settlement)`); gateway intent must be idempotent
  (never duplicate an external order when retried inside a tx) and an external call must never leak out of / roll back
  with a DB transaction. Because no real external credentials exist in this environment, "live" is verified against a
  **local Razorpay-protocol HTTP mock** (`scripts/razorpay-mock.mjs`) that speaks the actual REST wire protocol; the
  implementation targets `api.razorpay.com` by default and is flipped to live by env base-URL/keys only (no code change).
- **Config (`src/config/configuration.ts`, `.env.example`):** new `payments` block — `provider`
  (`PAYMENT_GATEWAY_PROVIDER`, default `sandbox`), `razorpay.keyId/keySecret/webhookSecret/baseUrl`
  (`RAZORPAY_KEY_ID/KEY_SECRET/WEBHOOK_SECRET/BASE_URL`; baseUrl defaults `https://api.razorpay.com`, overridable to
  point at the local mock). `main.ts` bootstrap adds `rawBody: true` so the gateway webhook endpoint receives the exact
  request bytes needed for HMAC verification.
- **Gateway seam (`src/commerce/gateway/`, NEW):** `payment-gateway.interface.ts` defines `PaymentGateway`
  (`provider`, `createGatewayIntent`, `parseWebhook`, `refund`) + typed `GatewayIntent*/GatewayPaymentEvent/
  GatewayWebhookRequest/GatewayRefundInput|Result`. It is intentionally narrow — it owns ONLY provider-specific external
  I/O + signature/normalisation; the money ledger (Payment / PaymentTransaction / PaymentWebhook idempotency, order
  payment status, Refund + refund_transactions) stays in PaymentService/ReturnsService (provider-agnostic).
  - `gateway.provider.ts` — `PAYMENT_GATEWAY_PROVIDER` factory selects the provider from config (razorpay when set,
    else sandbox) and registers it behind the `PAYMENT_GATEWAY` token in `CommerceModule` (also exported).
  - `sandbox.gateway.ts` — DEFAULT provider; reproduces the historical local sandbox behaviour exactly (no external I/O,
    fabricated `sndbox-refund-…` references), so an unset `PAYMENT_GATEWAY_PROVIDER` is byte-for-byte unchanged.
  - `razorpay.gateway.ts` (`RazorpayGateway`, `@Injectable`) — speaks real Razorpay REST over Node's global `fetch`:
    Basic auth from `keyId:keySecret`; **`POST /v1/orders`** (amount in **paise**, `payment_capture:1`, unique `receipt`
    = internal idempotency key so a retry never duplicates the external order); webhook **`x-razorpay-signature` =
    HMAC-SHA256 hex over the RAW body bytes** (constant-time compare, secret = `webhookSecret`, distinct from the API
    secret), normalising `payment.captured`/`order.paid` → `payment.captured` and `payment.failed`; **`POST
    /v1/payments/:id/refund`** executes a real refund (amount paise, `speed: normal`, `receipt`), returning the real
    `rfnd_…` id mapped to COMPLETED (processed/captured) / PROCESSING (pending) / FAILED.
- **PaymentService (`src/commerce/payment.service.ts`):** constructor becomes `(prisma, @Optional() @Inject
  (PAYMENT_GATEWAY) gateway?)` — when no gateway is injected it falls back to `new SandboxGateway()`, so the historical
  `new PaymentService(prisma)` spec and the sandbox default are unchanged. Added: `createIntentTx` still creates the
  Payment inside the order `$transaction`, but for a non-sandbox provider it first calls `gateway.createGatewayIntent`
  idempotently (receipt = order idempotencyKey) and persists the real gateway order id into `Payment.providerPaymentId`
  (provider `razorpay`) within the same tx. New `confirmFromGatewayEvent(event)` mirrors the sandbox confirm path but is
  provider-agnostic: idempotent via the same `PaymentWebhook` `UNIQUE(provider, providerEventId)` claim, amount-match
  guard, `payment.captured` → Payment `CONFIRMED` + `providerCaptureId`/`providerPaymentId` + order `PAID` +
  `payment_transactions` CAPTURE SUCCESS + PROCESSED webhook audit, `payment.failed` → FAILED + CHARGE FAILED. New
  `parseGatewayWebhook`, `refundForGateway` surface the active gateway to the controller/ReturnsService.
  - `src/commerce/payment.gateway.service.spec.ts` (NEW, +6): default sandbox when none injected; razorpay when a
    razorpay gateway is injected; locate-by-gateway-order-id capture → order PAID; amount-mismatch rejected; missing
    payment → 404 (failed webhook recorded); already-processed event idempotent.
- **PaymentController (`payment.controller.ts`):** new **`POST /api/v1/payments/webhook/razorpay`** — NOT JWT-protected
  (authenticity is the x-razorpay-signature HMAC over the raw body); reads `req.rawBody` (rawBody capture enabled) +
  `x-razorpay-signature` header → `parseGatewayWebhook` → `confirmFromGatewayEvent`. Legacy sandbox signed-body webhook
  route is unchanged.
- **ReturnsService (`returns.service.ts`) — LIVE refund execution:** constructor gains an optional injected gateway
  (default `new SandboxGateway()`, so `new ReturnsService(prisma, settlement)` spec and COD/sandbox behaviour are
  unchanged). `completeRefund` for a **GATEWAY** method refund now executes the money movement against the **active**
  gateway BEFORE the DB transaction (an external call can never roll back with it): it resolves the captured gateway
  payment id (`Payment.providerCaptureId`/`providerPaymentId`; throws a conflict if absent for a real gateway), calls
  `gateway.refund({gatewayPaymentId, amount, currency, receipt: refundReference})` idempotently, then in the tx records
  the **real `gatewayRef`** + resolved provider (`refund.gatewayProvider = razorpay`) on the Refund and a
  `refund_transactions` row (SUCCESS + completedAt). A synchronously-processed refund → Refund COMPLETED + return
  request COMPLETED + audited `REFUND_COMPLETED` event + the Session 13 seller-payable auto-debit (net-zero) still runs;
  a gateway `PROCESSING` (in-flight) refund → Refund **PROCESSING** (new enum `REFUND_PROCESSING` event, no completedAt,
  no request COMPLETED, no auto-debit) to be reconciled later when the gateway reports terminal. COD refunds never hit
  the gateway. `returns.service.spec.ts` +2 (live gateway refund records real gatewayRef+provider; throws + no settle
  when the gateway has no captured payment reference).
- **Schema (additive; migration `20260908171500_return_refund_processing_enum` — 20 migrations total):** adds
  `ReturnEventType.REFUND_PROCESSING`. Applied via `psql -f` + manual `_prisma_migrations` insert; `prisma generate`;
  `migrate status` up to date; DB enum verified via psql.
- **Gateway unit spec (`gateway/razorpay.gateway.spec.ts`, NEW, +7 incl. sandbox default):** provider razorpay + order
  amount in paise with idempotent receipt; gateway error propagated as request failure; raw-body webhook verified
  (HMAC over exact bytes) + `payment.captured` normalised; invalid signature rejected; real refund executed
  (POST /v1/payments/:id/refund → rfnd id); sandbox default creates no external order + fabricates refund refs (no
  network).
- **Tests:** full suite **18 suites / 167 tests** (was 153); typecheck (`tsc --noEmit`) clean; `npm run build` clean.
- **Live E2E (`:4000` in razorpay mode against local mock `:3911`; driver `scripts/e2e-razorpay.mjs` → 21 ok steps):**
  fresh run order `BK-MTS18BPF` (DB order `cmts18bpg0021khnznff3abja`): buy-now PREPAID placed a **razorpay order
  `order_48bps`** through the mock (only one create; stored as `Payment.providerPaymentId`, provider `razorpay`,
  ₹194.95) → raw-body-HMAC `payment.captured` webhook → order PAID (duplicate idempotent, bad signature 403) → operator
  CONFIRMED/PACKED, seller accepted slice, SHIPPED/DELIVERED → customer return → operator decision/pickup/inspection
  PASS → refund `RFD-MTS18BWI-7LJE` initiate → complete **executed a live razorpay refund on the mock** recording real
  `gatewayRef rfnd_mts18bx35tzu` with `gatewayProvider=razorpay` and a `refund_transactions` SUCCESS row → return request
  COMPLETED → order `REFUNDED`/`REFUNDED`. Ledger confirmed via psql; mock also exposes `GET /__orders` to assert only
  one order create per run.

## Session 19 — Razorpay async refund reconciliation (drive in-flight PROCESSING refunds to terminal)

- **Date:** 2026-09-08
- **Owner decision:** "Razorpay refund reconciliation" — finish Session 18's in-flight refund path: when a GATEWAY
  refund that `ReturnsService.completeRefund` left in-flight (`PROCESSING`, gateway returned `pending`) later reports
  terminal via the async `refund.processed` / `refund.failed` webhook, finalise the local Refund accordingly. Session
  18 proved the synchronous terminal path; Session 19 adds the async completion so a real (asynchronous) gateway refund
  is never left dangling. No new roles; money stays operator/system-gated; sandbox default unchanged.
- **Schema (additive; migration `20260908172000_return_refund_failed_enum` — 21 migrations total):** adds
  `ReturnEventType.REFUND_FAILED` (for the failed-refund audit event). Applied via `psql -f` + a manual
  `_prisma_migrations` insert (id `20260908172000_refund_failed`); `prisma generate`; `migrate status` up to date; DB
  enum verified via psql.
- **Gateway interface/events (`src/commerce/gateway/payment-gateway.interface.ts`, `razorpay.gateway.ts`):**
  `GatewayPaymentEvent` now carries `category: 'payment'`; a new `GatewayRefundEvent` (`category: 'refund'`) carries the
  terminal refund fields (`eventType refund.processed|refund.failed`, `gatewayRefundId`, `gatewayPaymentId`,
  `terminalStatus COMPLETED|FAILED`, `failureReason`, amount in rupees). `PaymentGateway.parseWebhook` now returns
  `Promise<GatewayWebhookEvent>` (union). `RazorpayGateway.parseWebhook` recognises `refund.processed`/`refund.failed`
  (entity under `payload.refund.entity`, id = `rfnd_…`, `error_description` → failureReason) alongside the existing
  payment events. Sandbox still has no parseWebhook.
- **PaymentService:** `parseGatewayWebhook` returns the union; `isPaymentEvent()` narrows it. `confirmFromGatewayEvent`
  (payment only) unchanged.
- **PaymentController (`/api/v1/payments/webhook/razorpay`):** now injects `ReturnsService` and dispatches by event
  category — payment events → `PaymentService.confirmFromGatewayEvent`, refund events →
  `ReturnsService.reconcileRefundFromEvent` (same signature-authenticated raw-body endpoint).
- **ReturnsService.reconcileRefundFromEvent (Session 19):** finds the local Refund by `gatewayRef ==
  gatewayRefundId`. Idempotent by Refund status: only a `PROCESSING` refund is acted on; already-`COMPLETED`/`FAILED`
  (or not-in-flight) → idempotent no-op replay; unknown rfnd → `matched:false`. Requires the refund's stored
  `gatewayProvider` to match the event provider.
  - `refund.processed` → in one tx: Refund `COMPLETED` (+ `completedAt`), its PENDING `refund_transactions` row
    updated to SUCCESS (+ `completedAt`; a safety-net SUCCESS row is created if none was pending), then the shared
    `applyRefundTerminalEffects` completes the return request (`COMPLETED` + `REFUND_COMPLETED` SYSTEM event) and runs
    the Session-13 seller-payable net-zero auto-debit + aggregate order `REFUNDED`. Returns the completed public request.
  - `refund.failed` → Refund `FAILED` + `failedReason`, PENDING txn → FAILED, `REFUND_FAILED` SYSTEM event; the request
    stays `APPROVED_FOR_REFUND` (no completion, no auto-debit) so the operator can retry.
  - `completeRefund`'s inline terminal side-effects were refactored into the shared private
    `applyRefundTerminalEffects` (behaviour unchanged) so the operator-complete path and the async reconciler stay in
    lockstep.
- **Mock + driver (`scripts/razorpay-mock.mjs`, `scripts/e2e-refund-async.mjs`):** the mock honours `REFUND_ASYNC=1` —
  refunds return `status:'pending'` (in-flight) and are recorded in `GET /__refunds` (default still `processed`), so the
  app's `completeRefund` leaves Refund PROCESSING; the driver then POSTs a signed raw-body `refund.processed` webhook
  and asserts reconciliation to COMPLETED + idempotent replay.
- **Tests:** `razorpay.gateway.spec.ts` +2 (refund.processed / refund.failed normalisation), `returns.service.spec.ts`
  +4 (reconcile PROCESSING→COMPLETED nets the seller payable + marks order REFUNDED + updates the PENDING txn to
  SUCCESS; idempotent replay when already COMPLETED; refund.failed → FAILED + FAILED txn + REFUND_FAILED audit + no
  settle; unknown rfnd → unmatched). Full suite **18 suites / 173 tests** (was 167); typecheck + build clean.
- **Live E2E (`:4100` razorpay mode against `:3912` async mock; `scripts/e2e-refund-async.mjs` → 20 ok steps):** fresh
  order `BK-MTS23JIS` (DB order `cmts23jje000316nz1vllwv51`): razorpay order `order_13jlm` → `payment.captured` webhook
  → PAID → operator CONFIRMED/PACKED, seller accepted slice, SHIPPED/DELIVERED → customer return → decision/inspection
  PASS → refund `RFD-MTS23K0U-ZB5G` initiate → `refund/complete` submitted the live razorpay refund and, because the
  mock returned `pending`, left Refund **PROCESSING** with real `gatewayRef rfnd_mts23k1hwpmh` (`REFUND_PROCESSING`
  event) → driver POSTed a signed `refund.processed` webhook → **reconciled to COMPLETED**: Refund COMPLETED,
  `refund_transactions` SUCCESS, return request COMPLETED, order REFUNDED/REFUNDED, and `REFUND_COMPLETED` (SYSTEM)
  audit — replay idempotent. Ledger confirmed via psql. (The Session-18 synchronous terminal path is unchanged and
  still covered by the gateway `COMPLETED` completeRefund unit test.)

## Session 20 — Product listing/publishing (2026-09-08, `/home/user/rajrani-web`)

Owner-chosen next scope: **product listing/publishing** (product create + catalog-publish
review/approval lifecycle). NO code was changed for onboarding/KYC, ratings/reviews, seller-ops
order gating, or courier.

- **Schema/migration `20260908175000_product_publishing`:** `Product.reviewNote` (nullable, last
  staff note/reason surfaced to the seller) + a new `product_status_history` table/model
  (`ProductStatusHistory`: productId FK cascade, fromStatus/toStatus, actorRole SELLER|OPERATOR|
  ADMIN|SYSTEM, actorId, reason, createdAt; indexed by productId). Existing `Product.status`
  (`DRAFT/PENDING_REVIEW/APPROVED/REJECTED/ARCHIVED`) + `visibility` (`LIVE/HIDDEN/…`) + `publishedAt`
  were reused — no separate submission table was warranted. Applied via SQL-file + manual
  `_prisma_migrations` row (≤36 chars), never `migrate dev/reset`; `prisma generate` OK.
- **New `src/publishing/` module (wired into `app.module.ts`), no new role:**
  - `SellerProductController @Controller('seller/catalog') @Roles(SELLER)` (distinct from the existing
    read-only `GET /seller/products` in seller-ops): `GET` list (own, optional `?status`), `GET
    /:productId`, `POST` create DRAFT, `PATCH /:productId` edit (DRAFT/REJECTED only), `POST
    /:productId/submit` → PENDING_REVIEW (DRAFT/REJECTED only), `POST /:productId/archive`
    (non-published only). Every write is strictly scoped to the caller's own ACTIVE seller
    (`requireSeller` → SELLER role + `User.sellerId` + `Seller.status=ACTIVE`); reading/editing another
    seller's product → 404. Slug auto-deduped; category must be `ACTIVE`+not-deleted.
  - `CatalogPublishingController @Controller('catalog-publishing/products') @Roles(OPERATOR, ADMIN)`
    (distinct staff review surface; REVIEWER is onboarding-only and NOT granted publishing):
    `GET` PENDING_REVIEW list (+`?status`), `GET /:productId` review detail, `POST /:productId/approve`
    (→ `APPROVED` + `visibility LIVE` + `publishedAt`; sets reviewNote) and `POST /:productId/reject`
    (mandatory reason → `REJECTED` + `HIDDEN` + `publishedAt` null; reason stored in `reviewNote`).
    Both mutate only a `PENDING_REVIEW` product (409 otherwise) and are staff-role-gated.
  - `ProductStatusHistory` written for create/edit-free transitions: created-as-draft, submitted,
    approve/reject each append a row (fromStatus → toStatus, actorRole, actorId, reason).
  - **Public catalog untouched:** `catalog.service` still only exposes `status APPROVED` +
    `visibility LIVE` + not-deleted. Approving a product feeds that filter so it appears; a DRAFT/
    PENDING_REVIEW/REJECTED product never resolves publicly (404).
- **Tests:** new `src/publishing/product-publishing.service.spec.ts` (8): seller-owner create DRAFT
  scoped + history, non-seller 403, submit only from DRAFT/REJECTED (409 otherwise), cross-seller 404,
  staff approve → APPROVED+LIVE+publishedAt+audit(actor role), staff reject → REJECTED+HIDDEN+reason,
  non-staff (SELLER/CUSTOMER) approve 403, approve-already-APPROVED 409 → **19 suites / 181 tests**
  (was 173); typecheck + `npm run build` clean.
- **Live E2E (`scripts/e2e-publishing.mjs`, 13/13 ok, sandbox-provider API `:4300`):** `seller1@example.
  com` (SELLER, ACTIVE `seller-legacy`) → created DRAFT (HIDDEN, appears in own list) → submit →
  PENDING_REVIEW → `pfop@example.com` (OPERATOR) lists it → **approve** → `APPROVED`+`LIVE`+`publishedAt`,
  publicly resolvable by slug (`GET /catalog/products/:slug` 200); second product **reject** path →
  `REJECTED`+`HIDDEN`, reason `price below floor` surfaced in the seller's own detail (`reviewNote`) and
  NOT publicly resolvable (404). RBAC: CUSTOMER denied both the OPERATOR review surface and the SELLER
  authoring surface (403). DB audit for the approved product: `product_status_history`
  `DRAFT→PENDING_REVIEW→APPROVED` (actorRole SELLER/OPERATOR + reasons). E2E test products cleaned up.

## Session 21 — Product reviews & ratings (backend) (2026-09-08, `/home/user/rajrani-web`)

Owner-chosen next scope: **product reviews/ratings (backend)**. NO code was changed for
onboarding/KYC, catalog publishing, courier/delivery-provider, or storefront UI.

- **Schema/migration `20260908200000_product_reviews`:** `ProductReview` (already modelled from init,
  `ReviewStatus PENDING/PUBLISHED/REJECTED/HIDDEN`, `verifiedBuyer`) gains moderation fields
  `moderatorId`/`moderatedAt`/`moderationNote`, a **`@@unique([productId, userId])`** (one review per
  customer per product) and a `(userId, status)` index (the prior bare `userId` index is dropped). Applied
  via `psql -f` + manual `_prisma_migrations` row, never `migrate dev/reset`; `prisma generate` OK (23
  migrations).
- **New `src/reviews/` module (wired into `app.module.ts`), no new role:**
  - `ReviewsController @Controller('reviews') @Roles(CUSTOMER)` — POST (create), GET `/me`, GET
    `/:reviewId`, PATCH `/:reviewId`, DELETE `/:reviewId`. Create requires the product be APPROVED+LIVE
    and the caller to have a **DELIVERED** order item for it (`verifiedBuyer=true`); duplicate (same
    product+user) → 409; non-buyer → 403. Update allowed on own PENDING, or a REJECTED/HIDDEN review
    (reopens to PENDING for re-moderation); PUBLISHED reviews are not customer-editable/removable
    (must go through moderation). Delete allowed on own non-PUBLISHED review.
  - `ReviewModerationController @Controller('product-reviews') @Roles(OPERATOR, ADMIN)` (REVIEWER stays
    onboarding/KYC-only): GET list (default PENDING), GET `/:id`, POST `/:id/approve|reject|hide|unhide`.
    Approve → PUBLISHED; reject → REJECTED (+reason); hide → PUBLISHED→HIDDEN (drop from aggregate);
    unhide → HIDDEN→PUBLISHED (restore). Only a PENDING review can be approved/rejected; only PUBLISHED
    can be hidden; only HIDDEN can be unhidden (409 otherwise). Each action records moderatorId/moderatedAt
    + moderationNote.
  - `PublicReviewsController @Controller('catalog/products/:identifier/reviews')` (no auth) returns only
    **PUBLISHED** reviews (paginated) with product summary; PENDING/REJECTED/HIDDEN never appear.
  - **Aggregation:** `recomputeAggregate` sets `Product.ratingAvg`/`reviewCount` = avg/count over
    PUBLISHED reviews, called inside the same tx as approve/hide/unhide. Rejecting a **never-published**
    PENDING review does NOT recompute (so a product with no approved reviews keeps its seeded marketing
    summary until its first review is approved). The existing public catalog read path is otherwise
    untouched.
- **Tests:** new `src/reviews/reviews.service.spec.ts` (12): create PENDING verified review, non-buyer 403,
  duplicate 409, non-public product blocked, cannot edit/delete PUBLISHED (409), editing REJECTED reopens
  to PENDING, approve publishes + recomputes, reject marks REJECTED without recompute, cannot approve
  non-PENDING (409), public read only PUBLISHED, unknown product 404 → **20 suites / 193 tests** (was 19);
  typecheck + `npm run build` clean.
- **Live E2E (`scripts/e2e-reviews.mjs`, 17/17 ok, sandbox API `:4400`):** customer `s12@example.com`
  (DELIVERED order containing `ratlami-sev`) created a PENDING verified review → showed in `/reviews/me`,
  not public → OPERATOR `pfop@example.com` approved it (PUBLISHED, moderation note) → now public and
  `ratlami-sev` recomputed to 5.0/1 → hide (0/0) → unhide (restored) → a second review on
  `shahi-kaju-mixture` rejected (REJECTED + reason, product summary untouched) → editing the REJECTED
  review reopened it to PENDING. RBAC negatives (fresh non-buyer 403, SELLER 403, CUSTOMER on moderation
  403). E2E reviews + product summaries cleaned up to seeded values after the run.

## Session 22 — Courier last-mile delivery of a dispatched replacement (2026-09-08, `/home/user/rajrani-web`)

Owner-chosen next scope: **courier-deliver the dispatched replacement** — closing the Session 17 outbound
replacement leg by routing the physical last mile through the Session 15 DELIVERY-role courier system.

- **Migration `20260908203000_replacement_courier`:** new `replacement_assignments` table (mirrors
  `delivery_assignments`, but FKs to `replacements` + reuses `DeliveryPartner` + `DeliveryAssignmentStatus`;
  `RDLA-…` assignment numbers; one active assignment per replacement, reassign creates fresh rows after
  REJECT/FAIL/CANCEL). `Replacement.assignments` + `DeliveryPartner.replacementAssignments` +
  `Order.replacementAssignments` relations. `ReturnEventType` gains 7 courier-step events
  (`REPLACEMENT_COURIER_ASSIGNED/ACCEPTED/REJECTED/PICKED_UP/OUT_FOR_DELIVERY/CANCELLED/FAILED`);
  `ReturnActorType` gains `DELIVERY` (24 migrations). Applied via `psql -f` + a manual `_prisma_migrations`
  row (checksum = sha256 of the SQL), never `migrate dev/reset`.
- **New `src/commerce/replacement-courier.service.ts`** + controllers (all additive; no new role):
  - `ReplacementCourierAdminController` (OPERATOR/ADMIN, under `/api/v1`):
    `POST /return-requests/:returnRequestId/replacement/assign-courier {deliveryPartnerId}` — only a
    **DISPATCHED**, not-yet-terminal replacement can be assigned; partner must be ACTIVE; no duplicate
    active assignment (409). `GET …/replacement/assignments` and
    `POST …/replacement/assignments/:assignmentId/cancel`.
  - `ReplacementCourierPartnerController` (`@Controller('delivery/replacement-tasks')`, DELIVERY role,
    own profile only): `GET /`, `GET /:assignmentId`, and
    `POST /:assignmentId/{accept,reject,pickup,out-for-delivery,deliver,fail}` mirroring slice delivery.
    The courier's **`deliver`** step, in one transaction, marks the assignment DELIVERED AND auto-completes
    the replacement `DISPATCHED → COMPLETED` (completedAt). Audited on the same return-request trail via
    `ReturnEvent` (DELIVERY actor). **Non-money**: no Refund, no seller-payable change, original order
    status untouched.
  - **Operator `/replacement/complete` guard:** the Session 17 manual-complete now returns **409 while a
    courier assignment is active** (the courier must deliver); manual complete remains for the no-courier path.
- Return detail (`ReturnRequestPublic.replacement`) now exposes `assignments[]` (most recent first) so
  operators/customers see the courier leg; RETURN_INCLUDE + toPublic extended.
- **Tests:** new `src/commerce/replacement-courier.service.spec.ts` (12) → **21 suites / 205 tests** (was
  20/193); typecheck + `npm run build` clean.
- **Live E2E (`scripts/e2e-replacement-courier.mjs`, 31/31 ok, sandbox API `:4500`):** placed a fresh PREPAID
  order (buy-now) → sandbox webhook captured → delivered (seller accept + operator advance); customer
  REPLACEMENT return → approve/pickup/inspection PASS → `REPLACEMENT_ISSUED` + replacement PENDING_DISPATCH →
  dispatch → **assign courier** (delivery15) ASSIGNED; negatives (duplicate assign 409, operator manual
  /complete 409, CUSTOMER/courier/OPERATOR RBAC 403s); courier accept→pickup→out-for-delivery→**deliver**
  → replacement COMPLETED + assignment DELIVERED; return shows COMPLETED + DELIVERED assignment + `refund:null`;
  original order unchanged (DELIVERED/PAID). E2E order/return/replacement/assignment/payable rows cleaned up.

## Session 23 — Catalog Console (connected React/Vite UI for SELLER + staff catalog publishing)

Added `catalog-console/`, a React 18 + Vite 5 app that drives the Session 20 publishing backend from the
browser through Vite's relative `/api` proxy (`server.allowedHosts` enabled for the live-preview host).
No backend changes — it consumes the existing `/seller/catalog`, `/catalog/categories` and
`/catalog-publishing/products` routes.

- SELLER flow: list/filter own products by status (DRAFT/PENDING_REVIEW/APPROVED/REJECTED/ARCHIVED), create a
  DRAFT, edit only while DRAFT/REJECTED, submit for review, archive non-published items, see rejection reason.
- OPERATOR/ADMIN flow: review queue (PENDING_REVIEW + view APPROVED/REJECTED), product detail with timestamps +
  actor history, approve (optional note) or reject (mandatory reason that the seller sees) → publishes on approval.
- Role-aware: the app shows the seller or staff tab by signed-in role; a non-seller/non-staff user gets a
  no-access card. Login via `/auth/login`, token under `bilokat_token`.
- Verified live through the proxy: a real seller create → submit (PENDING_REVIEW) → appears in the staff queue →
  approve → APPROVED in the seller list; staff detail returned history + publishedAt/createdAt/updatedAt. Also
  surfaced the backend rule that a seller can only archive a NON-published product (CONFLICT on APPROVED).
  All test products created during E2E were removed from the DB to keep the seeded catalog clean.
- Committed `deb9bd9`.

## Session 24 — Customer Storefront (connected React/Vite UI: live catalog + published reviews)

Added `customer-storefront/`, a React 18 + Vite 5 app (port 5180) that browses the live public catalog and
reads PUBLISHED reviews, with optional CUSTOMER sign-in for a verified-buyer review-write surface. Read-only
commerce this session (no cart/checkout). All calls go through the Vite `/api` proxy (`allowedHosts` on).

- Shop/home: live product grid from `/catalog/products` (category chips, search `q`, sort, pagination);
  data lives in the DB — nothing hardcoded.
- Product detail (`/catalog/products/:slug`): media (remote image with inline-SVG fallback for the offline
  preview), price/discount/origin/spice/stock/ingredients/nutrition/pairing, star aggregate + review count.
- Reviews: only PUBLISHED reviews (`/catalog/products/:slug/reviews`); empty state explains moderation.
- CUSTOMER sign-in (`/auth/login`, token under `bilokat_customer_token`) reveals a star/title/comment
  "write a review" form that POSTs `/reviews` (verified-buyer gated) and an Account page listing the user's
  reviews by status with edit/delete + rejection-reason display.
- Verified live through the proxy: browsed products/detail/reviews (8 live products), logged in as
  `s12@example.com` (CUSTOMER with DELIVERED orders), submitted a review → PENDING and correctly NOT public,
  then deleted it to keep data clean. Note: product detail shows the seeded marketing aggregate (e.g.
  Ratlami Sev 4.9/3820) with 0 written reviews until one is approved — matching Session 21 semantics
  (a PUBLISHED review would take over the aggregate and collapse those rich seeded numbers, so none were
  approved for the demo).
