# HANDOFF — BILOKAT

For the next AI session.

| Key | Value |
|---|---|
| CURRENT SESSION | Session 04 — Commerce: cart + checkout + orders (server-authoritative) |
| STATUS | COMPLETE (unit tests 26 pass; live order place/cancel verified) |
| NEXT SESSION | Reviews, or next commerce/payments module per priority |
| NEXT WORKFLOW | Product reviews (rating avg refresh), or multi-seller split-cart / buy-now / payments; reuse commerce source-of-truth pricing + transactional patterns |

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
