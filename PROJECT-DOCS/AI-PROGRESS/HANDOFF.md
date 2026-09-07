# HANDOFF — BILOKAT

For the next AI session.

| Key | Value |
|---|---|
| CURRENT SESSION | Tech upgrade — Prisma 6→7.10 (stable) |
| STATUS | COMPLETE (verified end-to-end) |
| NEXT SESSION | Session 04 — Commerce: cart + checkout + orders |
| NEXT WORKFLOW | Backend cart (guest/user) → checkout → order creation + status; reuse catalog source-of-truth for pricing |

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
  (interactive) or in sandbox `prisma migrate diff --from-url ... --to-schema-datamodel`
  then psql apply + record in `_prisma_migrations`; if `migrate deploy` complains,
  remove stray rows and `prisma migrate resolve --applied <name>`.

## WHAT WAS VERIFIED (most recent pass)
- `prisma validate`/`generate`/`migrate deploy` clean (5 migrations, no pending).
- `npm run typecheck` 0; `npm run build` 0; `npm test` 5 suites / 15 PASS.
- `prisma db seed` -> 5 categories / 8 products.
- Live: health postgres up; catalog list/detail; auth register+login via adapter.
- Pushed GitHub `rajrani-web` main (`06bfecd`); backup branch
  `backup/session03-before-upgrade` exists.

## WHAT WAS NOT VERIFIED
- Cart/checkout/orders (Session 04). Product write/admin APIs. customer-web app.
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

## DOCUMENTS TO READ (Session 04 — Commerce)
- `00-MASTER-SPEC.md` (§28–§31 cart/buy-now/multi-seller cart/pricing, §33 checkout,
  §38–§39 order + state machine)
- `02-BUSINESS-WORKFLOWS.md` (§7 shopping workflow, §11–§18 cart/checkout/address)
- `03-DATABASE-DESIGN.md` (commerce / payment / order table groups)
- `04-API-SPECIFICATION.md` (§41–§50 cart/checkout/order APIs)
- `09-SECURITY-SPEC.md` (§34 checkout integrity, §36 order state security)
