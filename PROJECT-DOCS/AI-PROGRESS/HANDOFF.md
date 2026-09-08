# HANDOFF — BILOKAT

For the next AI session.

| Key | Value |
|---|---|
| CURRENT SESSION | Session 18 — Real Razorpay payment gateway behind the pluggable payment seam + LIVE refund execution |
| STATUS | COMPLETE locally (18 suites / 167 tests; 20 migrations applied + recorded; working-tree changes ready to commit — **PUSH REQUIRED**, needs a fresh one-shot GitHub token) |
| NEXT SESSION | Product reviews, courier-delivering the dispatched replacement, or another owner-chosen priority |
| NEXT WORKFLOW | Product reviews (ratingAvg refresh); flip the Razorpay provider to LIVE external keys (env-only, see SESSION 18 note) + wire the async `refund.processed`/`payment.failed` reconciliation webhooks for in-flight refunds; real courier-provider integration + per-slice payout (earn currently stays order-level); courier-assign the dispatched replacement (currently an OPERATOR `replacement/…` action, non-money) |

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
