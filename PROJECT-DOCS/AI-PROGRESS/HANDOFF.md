# HANDOFF — BILOKAT

> **NOTE (updated at Session 29 close, 2026-09-08):** The table below dates from the
> Session 19 handoff. Sessions 20–29 have since shipped and been pushed. **`CURRENT-STATE.md`
> is the authoritative live snapshot** — please read that (and `SESSION-LOG.md` for session
> details) rather than this stale header. In short, Sessions 23–29 built a single connected,
> role-aware React/Vite **catalog console** (`catalog-console/`) covering SELLER authoring +
> publishing review, staff review-moderation, a SELLER sales & payouts dashboard, an OPERATOR
> Operations console (order fulfilment + returns queues), and — Session 29 — a **DELIVERY
> courier task console** (slice parcels + replacement last-mile) with an enriched
> `GET /delivery/tasks/:assignmentId`; plus Session 24 `customer-storefront/`.

For the next AI session.

| Key | Value |
|---|---|
| CURRENT SESSION | Session 29 — DELIVERY courier task console (slice parcels + replacement last-mile) + enriched `GET /delivery/tasks/:assignmentId` |
| STATUS | COMPLETE & **PUSHED** to GitHub (`origin/main` at `9b07533`); backend typecheck/build clean; console `npm run build` clean; courier RBAC/read + enriched detail verified live; demo slice + replacement tasks left actionable for an interactive demo |
| NEXT SESSION | Session 30 (owner-chosen). Sessions 23–29 done & pushed |
| NEXT WORKFLOW | Real delivery-courier provider integration (tracking/POD/per-slice payout) or another owner-chosen priority. (Courier console now covers per-slice parcels + replacement last-mile on the live DELIVERY-role task surfaces.) |

## IMPORTANT PRODUCT DECISION (owner)
**`landing-page/` is a PROTOTYPE / UX reference, NOT an exact pixel spec.** It
shows the intended *feel* of user interactions and checkout. Future customer
experience must be built properly per PROJECT-DOCS + later requirements —
enriched, not slavishly copied from the prototype. Backend/DB is source of truth.

## CURRENT STACK (deliberate, after research)
- NestJS **11.2.3** · TypeScript **5.9.3** · Prisma ORM **7.10.0** (driver adapter)
- PostgreSQL 17 (local in sandbox; docker-compose.yml provided for real env)
- NestJS 12 (ESM) + Jest fails; NestJS 12/TS7/Prisma-RC all rejected as too new
  / breaking. See SESSION-LOG. Do not re-attempt without a decision to move to
  Vitest + full ESM.

## TECH NOTE (Prisma 7 — MUST READ)
- Fresh clone: `npm install` → `npx prisma generate` → `npx prisma migrate deploy`
  → `npm run prisma:seed`. `.env` needs `DATABASE_URL`.
- `src/generated/` is gitignored (generated client). Do NOT commit it; run
  `prisma generate` before build.
- Schema datasource has NO `url` (Prisma 7). CLI URL in `prisma.config.ts`;
  runtime passes `adapter: new PrismaPg({ connectionString })` to PrismaClient.
- Add a field/model → `prisma generate`; migrate via `prisma migrate dev`
  (interactive) or in sandbox `prisma migrate diff --from-config-datasource
  --to-schema prisma/schema.prisma --script` (`--from-url` was removed in Prisma 7),
  then psql apply + record a row in `_prisma_migrations` (sha256 checksum,
  applied_steps_count 1); if `migrate deploy` complains, remove stray rows and
  `prisma migrate resolve --applied <name>`.

## WHAT WAS VERIFIED (most recent pass — Session 04)
- `npm run typecheck` 0; `npm run build` 0; `npm test` 7 suites / 26 PASS.
- `prisma migrate deploy` clean (7 migrations, no pending); coupons seeded.
- Live: guest cart + merge-on-login; over-stock rejected; checkout preview with
  coupon folding into grandTotal; place COD order (stock decrement, coupon usage,
  cart CONVERTED, PLACED + history); list/get order; cancel restores stock.
- Pushed GitHub `rajrani-web` main (latest `3348021`).

## WHAT WAS NOT VERIFIED
- Reviews, returns/refunds, payments gateway, multi-seller split-cart, buy-now,
  fulfilment/delivery, product write/admin APIs, customer-web app.
- Integration/E2E/security/load tests; no Docker runtime in sandbox.
- `npm audit`: 6 findings, 5 high (dev/CLI tooling incl. Prisma `deepmerge-ts`
  + `@prisma/streams-local` requiring node>=22) — runtime not blocked; review Session 15.

## KNOWN ISSUES / DO NOT REIMPLEMENT (Session 04)
- Do NOT re-scaffold NestJS/Prisma/config or re-apply the Prisma 7 migration.
- Do NOT trust client-supplied price/stock in cart/checkout — always re-derive
  from the product (basePrice/stock) at serve time.
- Do NOT copy the landing prototype verbatim (owner clarification above).
- GitHub token must be rotated by owner (was shared in chat; not committed).

## FILES CHANGED (upgrade)
- `prisma.config.ts` (new), `prisma/schema.prisma` (generator+datasource),
  `prisma/seed.ts`, `package.json`, `.gitignore` (`src/generated/`)
- `src/prisma/prisma.service.ts`, `src/auth/auth.service.ts`,
  `src/catalog/catalog.service.ts` (generated-client imports + adapter)

## FILES CHANGED (Session 04 — Commerce)
- `prisma/schema.prisma` + migrations `commerce_models`, `cart_status_merged` +
  `prisma/seed.ts` (coupons)
- `src/commerce/*` (types, cart dto/service/controller, checkout dto,
  order service, checkout controller, module)
- `src/auth/guards/optional-jwt-auth.guard.ts`, `src/auth/auth.module.ts`,
  `src/app.module.ts`
- Tests: `src/commerce/cart.service.spec.ts`, `src/commerce/order.service.spec.ts`

## DOCUMENTS TO READ (Session 05)
- Reviews (rating refresh keeping `ratingAvg`/`reviewCount` in sync with orders),
  or payments/COD workflow + delivery per `00-MASTER-SPEC.md`, `03-DATABASE-DESIGN.md`,
  `04-API-SPECIFICATION.md`, `02-BUSINESS-WORKFLOWS.md`, `09-SECURITY-SPEC.md`.

## SESSION 05 HANDOFF NOTES
- Payments are **sandbox-only** (provider-agnostic). Webhook/confirm signature
  uses HMAC secret from env `PAYMENT_WEBHOOK_SECRET` (default constant in
  `payment.service.ts`). Sandbox COD OTP is returned in the dev response body
  (`devOtp`) and only its hash is stored. Real providers/OTP gateways are future work.
- New routes: `POST /buy-now/preview`, `POST /buy-now`,
  `POST /payments/webhook/sandbox` (signed), `GET /orders/:id/payment`,
  `GET|POST /orders/:id/cod(/otp|/verify)`.
- Files: `src/commerce/{payment.service,cod.service,buynow.controller,
  payment.controller,cod.controller}.ts`, dto/payment.dto.ts, commerce.types.ts,
  order.service.ts (shared `createOrderFromQuote`), commerce.module.ts.
- Migration `20260907125816_payment_cod_models`; ledger now 8 clean rows
  (`prisma migrate deploy` clean). Run `npx prisma generate` on fresh clone.

## SESSION 06 HANDOFF NOTES
- **Fulfilment access control:** the delivery workflow is gated behind
  `@Roles('OPERATOR','ADMIN')` (existing RolesGuard reads `role` from the JWT at
  login time). There is **no dedicated delivery/seller role** yet — if a real
  courier/seller app needs it, add a role value + migration, and extend the
  RolesGuard allow-list rather than loosening the endpoint. Customers cannot
  self-set delivery (verified 403 FORBIDDEN with a CUSTOMER token).
- **Transitions:** `POST /orders/:id/fulfilment/advance` body `{toStatus, reason?}`.
  Legal map PLACED→CONFIRMED→PACKED→SHIPPED→{OUT_FOR_DELIVERY|DELIVERED}→DELIVERED;
  all other states terminal (future returns/refunds/seller-reject flows will open
  exception edges out of DELIVERED/PLACED/etc — implement them as new guarded
  transitions, not by widening this map). Confirmation gate blocks CONFIRMED until
  PREPAID is PAID or COD OTP verification is CONFIRMED.
- **Actor:** every transition row is `OrderActor.CONTROL` with `actorId` = the
  authenticated operator's user id + reason + metadata. Confirmation itself
  (PLACED→CONFIRMED) is recorded by the payment/cod services with actor SYSTEM.
- **Delivery semantics:** DELIVERED sets `deliveredAt` and (COD only) flips
  `paymentStatus` `COD_PENDING`→`COD_PAID`; PREPAID stays PAID.
- **Customer timeline:** `GET /orders/:id/history` returns from→to, actor,
  reason, createdAt (ordered). Public order DTO does not expose `deliveredAt`.
- **Files:** `src/commerce/fulfilment.service.ts` (+ `.spec.ts`, 8 tests),
  `fulfilment.controller.ts`, `dto/fulfilment.dto.ts`; `order.service.ts`
  (`orderHistory`, `toPublicOrder`), `checkout.controller.ts` (history route),
  `commerce.module.ts`.

## SESSION 07 HANDOFF NOTES
- **Returns are whole-order** (order-level), not per-item. `return_items`,
  `return_events`, `return_inspections`, `refund_transactions` (DB-Design §88/89/92)
  are NOT modelled yet — next refinement would add partial returns + pickup/
  inspection, and a `refund_transactions` ledger mirror.
- **Refund execution is sandbox.** `completeRefund` marks the `Refund` COMPLETED
  and appends a `payment_transactions` REFUND row on the original (PREPAID)
  payment. A real provider would execute the gateway refund keyed by the same
  `Refund.id` + idempotency before completing. COD refunds (method `COD`) have no
  gateway row by design (cash paid out-of-band) — a finance/settlement concern.
- **Return window is centralized** in `src/commerce/returns.policy.ts`
  (`RETURN_WINDOW_DAYS=7`); move to a config store when one exists. Do not scatter
  in frontends.
- **RBAC:** request/status are customer-owned (order.userId must match caller —
  an operator token on a customer's order returns 404). Decisions/refunds are
  `@Roles('OPERATOR','ADMIN')`. Rejections require a reason.
- **Order transitions for returns** (each audited in `order_status_history`):
  DELIVERED→RETURN_REQUESTED (CUSTOMER), RETURN_REQUESTED→RETURNED (approve) or
  →DELIVERED (reject, CONTROL), RETURNED→REFUND_PENDING (initiate), REFUND_PENDING→
  REFUNDED (complete) + `paymentStatus`→REFUNDED. FulfilmentService's forward map
  is intentionally NOT widened for these return edges.
- **Files:** prisma schema + migration `20260907133000_return_refund_models`;
  `src/commerce/{returns.service,returns.controller,return-ops.controller,
  returns.policy}.ts` (+ `.spec.ts` 14 tests), `dto/returns.dto.ts`,
  commerce.types.ts, commerce.module.ts.

## SESSION 18 HANDOFF NOTES
- **Gateway is now a real provider seam (`src/commerce/gateway/`), sandbox stays default.** Select with
  `PAYMENT_GATEWAY_PROVIDER=sandbox|razorpay` (unset = sandbox). Config lives under `payments` in
  `src/config/configuration.ts` (`RAZORPAY_KEY_ID/KEY_SECRET/WEBHOOK_SECRET/BASE_URL`). `main.ts` now enables
  `rawBody: true` (needed for the Razorpay webhook HMAC over the exact bytes). A `PAYMENT_GATEWAY` token (registered +
  exported by `CommerceModule` via `gateway.provider.ts`) injects the active gateway into `PaymentService` and
  `ReturnsService`, each constructor making it **optional and defaulting to `new SandboxGateway()`** so the historical
  unit-test shape `new PaymentService(prisma)` / `new ReturnsService(prisma, settlement)` stays green. Do not make the
  gateway a required constructor arg or require ConfigService in those services (that would break the test seam).
- **Interface is deliberately narrow** (`payment-gateway.interface.ts`): `createGatewayIntent`, `parseWebhook`, `refund`.
  It owns ONLY external I/O + signature/normalisation. The money ledger (Payment/PaymentTransaction/PaymentWebhook
  idempotency, order payment status, Refund + refund_transactions) stays provider-agnostic in PaymentService/ReturnsService.
- **New Razorpay routes/behaviour**
  - `POST /api/v1/payments/webhook/razorpay` — NOT JWT-protected; authenticity = `x-razorpay-signature` HMAC-SHA256 over
    `req.rawBody`. Duplicate events idempotent via the same `UNIQUE(provider, providerEventId)` claim as sandbox.
  - `PaymentService.createIntentTx` for a non-sandbox provider calls `gateway.createGatewayIntent` idempotently (receipt
    = order idempotencyKey) and persists the real gateway order id into `Payment.providerPaymentId` in the same tx.
  - `PaymentService.confirmFromGatewayEvent(event)` = provider-agnostic capture/failed confirm (locate by gateway order
    id / paymentReference, amount-match, capture → CONFIRMED + order PAID + CAPTURE SUCCESS tx, failed → FAILED + CHARGE FAILED).
- **LIVE refund execution (money-path, be careful).** `ReturnsService.completeRefund` for a GATEWAY-method refund now
  executes the gateway refund **before** the DB transaction (an external call can never roll back with the tx): it
  resolves `Payment.providerCaptureId`/`providerPaymentId` (throws a conflict if a real gateway has none), calls
  `gateway.refund(...)` (idempotent on `refundReference`), then commits the real `gatewayRef` + provider to the Refund
  and a `refund_transactions` row. Terminal gateway response → Refund COMPLETED + return COMPLETED + REFUND_COMPLETED
  event + Session-13 seller-payable net-zero auto-debit. In-flight (`PROCESSING`) → Refund **PROCESSING** +
  `REFUND_PROCESSING` event + NO request COMPLETED + NO auto-debit — the next session should add a reconciler that
  consumes the gateway `refund.processed` webhook to drive PROCESSING→COMPLETED. COD refunds never hit the gateway.
- **Flipping to LIVE Razorpay** requires only env: `PAYMENT_GATEWAY_PROVIDER=razorpay`, real test/live
  `RAZORPAY_KEY_ID/KEY_SECRET`, the same WEBHOOK secret used when you configure the Razorpay dashboard webhook, and
  `RAZORPAY_BASE_URL` unset (defaults to `https://api.razorpay.com`). No code change. The webhook endpoint URL is
  `POST {host}/api/v1/payments/webhook/razorpay`.
- **Local protocol mock for E2E:** `node scripts/razorpay-mock.mjs` (default `:3911`; speaks real wire: `POST /v1/orders`,
  `POST /v1/payments/:id/refund`→`processed`, `GET /__orders`). Run the whole flow with
  `PAYMENT_GATEWAY_PROVIDER=razorpay RAZORPAY_KEY_ID=rzp_test_key RAZORPAY_KEY_SECRET=secret
  RAZORPAY_WEBHOOK_SECRET=whsec_e2e RAZORPAY_BASE_URL=http://localhost:3911 PORT=4000 node dist/main.js`, then
  `node scripts/e2e-razorpay.mjs`. Fresh fixture logins all verified: customer `s12@example.com`/`Test@12345`, operator
  `pfop@example.com`/`Operator@123`, seller `seller1@example.com`/`Seller@123`.
- **Migration discipline:** Session 18 migration `20260908171500_return_refund_processing_enum` was applied via `psql -f`
  + a manual `_prisma_migrations` row (never `prisma migrate dev/reset` on the live DB). 20 migrations total.

## SESSION 19 HANDOFF NOTES (async refund reconciliation — completes Session 18's in-flight path)
- **What was added:** `GatewayRefundEvent` (+`category` on the payment event), `PaymentGateway.parseWebhook` now returns
  `Promise<GatewayWebhookEvent>`; `RazorpayGateway.parseWebhook` recognises `refund.processed`/`refund.failed`.
  `PaymentController` injects `ReturnsService` and routes refund events to the new `ReturnsService.reconcileRefundFromEvent`.
- **Reconcile semantics (idempotent by Refund status, money-safe):** finds the local Refund by
  `gatewayRef == gatewayRefundId`; acts ONLY on a `PROCESSING` refund. `refund.processed` → Refund COMPLETED +
  PENDING `refund_transactions` row → SUCCESS + return request COMPLETED + `REFUND_COMPLETED` (SYSTEM) + Session-13
  seller auto-debit + aggregate order REFUNDED. `refund.failed` → Refund FAILED + reason + txn FAILED +
  `REFUND_FAILED` (SYSTEM) + request stays `APPROVED_FOR_REFUND` (operator can retry). Already-COMPLETED/FAILED replay →
  idempotent no-op. Unknown rfnd → matched:false. Provider must match the refund's stored `gatewayProvider`.
- **`completeRefund`'s terminal side-effects were refactored** into the private `applyRefundTerminalEffects(...)` used by
  BOTH the operator path and the reconciler — keep future terminal changes in that one helper.
- **Retry after FAILED is intentionally left to a future session** (no operator endpoint yet resets a FAILED refund to
  re-attempt the gateway); the refund/complete endpoint still requires PENDING. When adding retry, allow GATEWAY FAILED →
  re-execute with a new gateway attempt on the same Refund row (keep the FAILED transaction row, add a fresh attempt).
- **Mock:** `scripts/razorpay-mock.mjs` honours `REFUND_ASYNC=1` (refunds return `pending`, recorded in `GET /__refunds`);
  unset stays `processed` (Session 18 sync path). Driver `scripts/e2e-refund-async.mjs` runs the whole async loop
  (`node scripts/e2e-refund-async.mjs` with `API`/`MOCK`/`RAZORPAY_WEBHOOK_SECRET` env; 20 ok steps, exits non-zero on
  failure). Run the API with `PAYMENT_GATEWAY_PROVIDER=razorpay RAZORPAY_BASE_URL=<mock> RAZORPAY_KEY_ID/KEY_SECRET/
  WEBHOOK_SECRET` (test keys `rzp_test_key`/`secret`/`whsec_e2e` are fine against the local mock).
- **Flipping to LIVE Razorpay** is still env-only and now complete for both refund timings. The live webhook endpoint is
  `POST {host}/api/v1/payments/webhook/razorpay`; configure the Razorpay dashboard to send `payment.captured`,
  `payment.failed` and `refund.processed`/`refund.failed` events to it with the matching webhook secret.
- **Migration discipline:** Session 19 migration `20260908172000_return_refund_failed_enum` applied via `psql -f` +
  manual `_prisma_migrations` row (id `20260908172000_refund_failed`). 21 migrations total.

## SESSION 20 HANDOFF NOTES (product listing/publishing)
- **New module `src/publishing/`**, wired into `app.module.ts` (no new role, no ABAC). Two surfaces:
  - SELLER authoring **`SellerProductController` `@Controller('seller/catalog')`** — do NOT merge these
    with the read-only `GET /seller/products` list owned by `src/commerce/seller-ops`. Routes:
    `GET` (list, optional `?status`), `GET /:productId`, `POST` (create DRAFT), `PATCH /:productId`
    (DRAFT/REJECTED only), `POST /:productId/submit` (→ PENDING_REVIEW; DRAFT/REJECTED only),
    `POST /:productId/archive` (non-published only). All writes are strictly scoped to the caller's own
    ACTIVE seller via `requireSeller` (SELLER role + `User.sellerId` + `Seller.status=ACTIVE`); a
    cross-seller product read/edit resolves to **404** (not 403) to avoid existence leaks.
  - STAFF review **`CatalogPublishingController` `@Controller('catalog-publishing/products')`,
    `@Roles(OPERATOR, ADMIN)`** — REVIEWER is onboarding/KYC-only and is intentionally NOT granted
    publishing. Routes: `GET` (defaults PENDING_REVIEW, `?status`), `GET /:productId`, `POST
    /:productId/approve`, `POST /:productId/reject` (reason mandatory). Approve/reject only act on a
    PENDING_REVIEW product (409 otherwise).
- **State machine on the existing `Product` row** (no new submission table): `status`
  DRAFT→PENDING_REVIEW→(APPROVED+`visibility LIVE`+`publishedAt` | REJECTED+`visibility HIDDEN`+
  `publishedAt` null+`reviewNote` reason). A REJECTED product is editable and resubmittable → back to
  PENDING_REVIEW. Nothing is ever publicly visible until OPERATOR/ADMIN approves, because the **public
  catalog filter is untouched** (`status APPROVED`+`visibility LIVE`+not-deleted in `catalog.service`);
  publishing only feeds that filter. Do not weaken the filter when adding future publishing features.
- **Audit:** new `product_status_history` (`ProductStatusHistory`) — keep writing one row per real
  transition (create, submit, approve, reject, archive). `actorRole` is SELLER for authoring and the
  resolved staff role (OPERATOR/ADMIN) for review. Category is constrained to `ACTIVE`+not-deleted.
  `Product.reviewNote` holds the last staff note/reason and is cleared on edit/submit.
- **Migration discipline:** `20260908175000_product_publishing` applied via `psql -f` + a manual
  `_prisma_migrations` row (id `20260908175000_product_publishing`, ≤36 chars) — never
  `prisma migrate dev/reset` on the live DB. 22 migrations total.
- **Tests/E2E:** `src/publishing/product-publishing.service.spec.ts` (8) → **19 suites / 181 tests**.
  Live E2E driver `scripts/e2e-publishing.mjs` (13/13): `API`/`SELLER`/`SPW`/`OPER`/`OPW`/`CATEGORY`
  env; run against a fresh sandbox-provider API (`PORT=4300 node dist/main.js` after `npm run build`).
  Fixtures: SELLER `seller1@example.com`/`Seller@123` (ACTIVE `seller-legacy`), OPERATOR
  `pfop@example.com`/`Operator@123`, CUSTOMER `s12@example.com`/`Test@12345`, ACTIVE category
  `cmtrvg2j90005usnz1jaaa7mx`.
- **Not in scope (do not add without a new session):** seller onboarding/KYC changes, ratings/reviews,
  per-seller order gating changes, courier/delivery-provider integration.
- For future work the natural next items are: **product reviews/ratings**, **courier-delivering the
  dispatched replacement**, and the **catalog-publishing-web / seller-web UIs**.

## SESSION 21 HANDOFF NOTES (product reviews & ratings)
- **New module `src/reviews/`** (wired into `app.module.ts`; no new role). Three controllers, do NOT
  over-restrict: review authoring is `@Controller('reviews') @Roles(CUSTOMER)` (CUSTOMER-role guard, not
  just JWT), moderation is `@Controller('product-reviews') @Roles(OPERATOR, ADMIN)`, and the public read is
  `PublicReviewsController @Controller('catalog/products/:identifier/reviews')` (no auth) so it does NOT
  collide with `catalog.controller` `GET products/:identifier` (Express matches by path segment).
- **Verified purchase is the core control:** `create` requires the product be APPROVED+LIVE and the caller
  to have a **DELIVERED** order item for it (query `orderItem.findFirst({productId, order:{userId,
  status:'DELIVERED'}})`); anything less → 403. One review per product per user via `@@unique([productId,
  userId])` (409 on duplicate). This is a hard rule — keep it if later enabling pre-delivery "write later".
- **Only PUBLISHED is public.** Staff approve → PUBLISHED; reject → REJECTED (reason); hide/unhide manage
  an already-PUBLISHED review's visibility. Customer can edit/delete only their own non-PUBLISHED review
  (editing a REJECTED/HIDDEN one reopens to PENDING). Never relax the PUBLISHED-only public filter.
- **Aggregation semantics (product decision, keep consistent):** `recomputeAggregate` sets
  `Product.ratingAvg`/`reviewCount` = avg/count over PUBLISHED reviews, in the SAME transaction as
  approve/hide/unhide. Rejecting a **never-published** review does NOT recompute — so a product that has
  never had an approved review keeps its seeded marketing summary until its first review is approved.
  Once any review is approved the product shows its true aggregate. If you later add many seeded reviews,
  seed PUBLISHED rows instead of keeping a parallel marketing number.
- **Migration discipline:** `20260908200000_product_reviews` applied via `psql -f` + a manual
  `_prisma_migrations` row (id `20260908200000_product_reviews`, ≤36 chars). 23 migrations total.
- **Tests/E2E:** `src/reviews/reviews.service.spec.ts` (12) → **20 suites / 193 tests**. Live E2E
  `scripts/e2e-reviews.mjs` (17/17): `API`/`BUYER`/`BW`/`OP`/`OPW`/`SELLER`/`SPW`/`PRODUCT` env; run
  against a fresh sandbox API (`PORT=4400 node dist/main.js`). Fixtures: buyer `s12@example.com`/`Test@12345`
  (has DELIVERED orders), OPERATOR `pfop@example.com`/`Operator@123`, SELLER `seller1@example.com`/`Seller@123`,
  product `ratlami-sev`. The E2E hard-deletes its review rows and resets the two products' rating summaries
  to seeded values afterwards.
- **Not in scope (add only in a new session):** seller onboarding/KYC, catalog publishing, courier /
  delivery-provider, per-seller order gating, and the review/rating storefront UI + "helpful" votes /
  photos / Q&A.
- Natural next items: **courier-deliver the dispatched replacement**, **review storefront UI**,
  **catalog-publishing/seller UIs**, or a next owner-chosen feature.

## SESSION 22 HANDOFF NOTES (courier last-mile delivery of a dispatched replacement)
- **New additive files (no new role):** `src/commerce/replacement-courier.service.ts`, its controllers
  (`ReplacementCourierAdminController` under `/api/v1` OPERATOR/ADMIN + `ReplacementCourierPartnerController`
  `@Controller('delivery/replacement-tasks')` DELIVERY), `dto/replacement-courier.dto.ts`, and the migration
  `prisma/migrations/20260908203000_replacement_courier/`. Wired into `commerce.module.ts`. New public types
  `ReplacementAssignmentPublic` in `commerce.types.ts`.
- **Courier drives completion (owner choice).** Once a replacement is DISPATCHED, OPERATOR/ADMIN assign a
  DELIVERY partner (`…/replacement/assign-courier`); the DELIVERY partner drives it and its **`deliver`**
  auto-completes the replacement (`DISPATCHED → COMPLETED`). The Session 17 OPERATOR manual `/complete` now
  returns 409 while a courier is active — keep that guard; do not let an operator and a courier double-
  finalise a replacement.
- **Non-money invariant (product decision):** the replacement courier leg never creates a Refund, never
  touches a seller payable, and never changes the original order (returns already happen after DELIVERED).
  `ReplacementCourierService.deliver` only flips assignment→DELIVERED + replacement→COMPLETED + a ReturnEvent.
  Do not wire earning/COD/settlement logic into this path.
- **Model:** `replacement_assignments` reuses `DeliveryPartner` + `DeliveryAssignmentStatus` (`RDLA-…`
  numbers) so the DELIVERY role works uniformly; it references `replacements` (via `replacementId`) not a
  seller slice. One **active** assignment per replacement (statuses ASSIGNED/ACCEPTED/PICKED_UP/
  OUT_FOR_DELIVERY); reassign creates a fresh row after REJECT/FAIL/CANCEL. Audit is on the same
  return-request `ReturnEvent` stream using new `ReturnEventType` courier events + `ReturnActorType.DELIVERY`.
- **Migration discipline:** `20260908203000_replacement_courier` applied via `psql -f` + a manual
  `_prisma_migrations` row (id `20260908203000_replacement_courier`, checksum = sha256 of migration.sql).
  24 migrations total.
- **Tests/E2E:** `src/commerce/replacement-courier.service.spec.ts` (12) → **21 suites / 205 tests**.
  Live E2E `scripts/e2e-replacement-courier.mjs` (**31/31**): it places a fresh PREPAID order (sandbox
  capture webhook amount = `Math.round(payment.amount)`), delivers it, and drives a full REPLACEMENT
  return→dispatch→courier-assign→courier-deliver. Fixtures: buyer `s12@example.com`/`Test@12345`, OPERATOR
  `pfop@example.com`/`Operator@123`, SELLER `seller1@example.com`/`Seller@123`, DELIVERY
  `delivery15@example.com`/`Delivery@123` (its ACTIVE partner profile was reused). Run against a fresh sandbox
  API (`PORT=4500 node dist/main.js`). After a run, delete the E2E order/return/replacement/assignment/payable
  rows (see VERIFICATION Session 22 cleanup) so the DB stays tidy.
- **Not in scope (add only in a new session):** real delivery-courier provider integration / tracking / POD,
  delivery pricing/zones, review- or catalog-publishing/seller storefront UIs.
- Natural next items: **review/rating storefront UI**, **catalog-publishing/seller UIs**, or another
  owner-chosen feature.
