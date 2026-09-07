# HANDOFF — BILOKAT

For the next AI session.

| Key | Value |
|---|---|
| CURRENT SESSION | Session 06 — Fulfilment + delivery state machine |
| STATUS | COMPLETE (10 suites / 49 tests; live PREPAID & COD orders driven to DELIVERED, audited, COD_PAID + deliveredAt verified) |
| NEXT SESSION | Reviews, returns/refunds, or real payment-gateway provider |
| NEXT WORKFLOW | Product reviews (rating avg refresh), returns/refunds (exception transitions OUT of DELIVERED/RETURN*/REFUND*), a real gateway provider (razorpay/stripe via the pluggable provider), settlements/finance |

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
