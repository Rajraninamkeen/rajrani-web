# HANDOFF — BILOKAT

For the next AI session.

| Key | Value |
|---|---|
| CURRENT SESSION | Session 03 — Catalog API |
| STATUS | PARTIALLY_COMPLETE (public catalog read API live + seeded + tested; cart/checkout/orders remain) |
| NEXT SESSION | Session 04 — Commerce: cart + checkout + orders |
| NEXT WORKFLOW | Backend: cart endpoints (guest/user), checkout, order creation + status, multi-line totals. Reuse catalog product source-of-truth for pricing |

## CONFIRMED DECISIONS (owner, 2026-09-07)
- **Backend target:** Customer-commerce vertical slice (serve landing/customer flows: catalog, cart, checkout, orders, pincode/delivery, coupons, auth, reviews).
- **Stack:** NestJS + Prisma (modular).
- **Repo layout (REVISED):** Owner chose a single all-in-one repo
  `Rajraninamkeen/rajrani-web` — docs (`PROJECT-DOCS/`), `landing-page/`, and the
  backend (`src/`, `prisma/`) all live together. Continuous push to GitHub after
  each meaningful change. (Supersedes the earlier separate-`bilokat-api` plan.)
- **DB/infra:** docker-compose (PostgreSQL + Redis) — authored; sandbox uses a
  locally installed PostgreSQL 17.
- **Workflow:** Keep GitHub current via continuous `git push origin main`.

---

## WHAT WAS VERIFIED (Session 02)
- Auth API live & correct end-to-end (register/me/401/refresh-rotation/
  reuse-detection revocation) — see SESSION-LOG.
- `npm test` 4 suites / 12 PASS; `tsc` exit 0; `npm run build` exit 0.
- DB has 4 migrations recorded (init, map_users_snakecase, add_user_sessions,
  sessions_unique_refresh).
- Everything pushed to GitHub `rajrani-web` (commit `fcc6682`).

## WHAT WAS NOT VERIFIED (Session 02)
- No catalog/commerce API endpoints yet (Session 03+).
- ABAC / org–tenant isolation / step-up auth not implemented.
- No integration/E2E/security/load tests; no Docker runtime exercised.
- Prisma CLI `deepmerge-ts` advisory unresolved (deferred, dev-only).

## FILES CREATED (Session 01 — bilokat-api repo, `/home/user/bilokat-api`)
- `src/main.ts`, `src/app.module.ts`, `src/app.controller.ts`
- `src/config/configuration.ts`
- `src/prisma/{prisma.module,prisma.service}.ts`
- `src/health/{health.module,health.controller}.ts`
- `src/common/api-response/api-response.ts`
- `src/common/filters/all-exceptions.filter.ts` (+ spec)
- `src/common/interceptors/transform.interceptor.ts`
- `src/common/middleware/request-id.middleware.ts`
- `src/app.controller.spec.ts`
- `prisma/schema.prisma` + `prisma/migrations/*`
- `docker-compose.yml`, `.env.example`, `.env` (ignored), `.gitignore`,
  `.dockerignore`, `README.md`, `package.json`, tsconfigs, `nest-cli.json`

## FILES MODIFIED (Session 01 — concept AI-PROGRESS)
- `CURRENT-STATE.md`, `COMPLETION-MATRIX.md`, `SESSION-LOG.md`, `HANDOFF.md`,
  `VERIFICATION.md`, `BLOCKERS.md` (decision statuses).

## FILES ADDED (Session 03 — catalog)
- `prisma/migrations/.../20260907120621_product_catalog_display_fields/migration.sql`
- `prisma/catalog-seed.ts`, `prisma/seed.ts`
- `src/catalog/catalog.{module,controller,service,types}.ts`
- `src/catalog/dto/list-products.query.ts`
- `src/catalog/catalog.service.spec.ts`

## WHAT WAS VERIFIED (Session 03)
- Public catalog API live (categories/products/detail; filters/search/sort/pagination);
  seed idempotent (5 cats / 8 products). `npm test` 5 suites / 15 PASS; tsc/build 0.
- Pushed `ebd9ce0`.

## WHAT WAS NOT VERIFIED (Session 03)
- Cart/checkout/orders (Session 04). No write/admin product APIs.
- Landing page not yet wired to this API (frontend remains hardcoded).
- Attribute/variant/media management & publishing workflows deferred.
- No E2E/security/load tests; no Docker runtime in sandbox.

## KNOWN ISSUES / DO NOT REIMPLEMENT (Session 04)
- Do NOT duplicate catalog pricing: cart/checkout must re-derive price from the
  product (basePrice) at serve time, never trust client-supplied price.
- Landing page still hardcoded (visual reference).
- `.env` local; GitHub token must be rotated by owner.
- Prisma `deepmerge-ts` dev advisory deferred to Session 15.

## DOCUMENTS TO READ (Session 04 — Commerce)
- `00-MASTER-SPEC.md` (§28–§31 cart/buy-now/multi-seller cart/pricing, §33 checkout, §38–§39 order + state machine)
- `02-BUSINESS-WORKFLOWS.md` (§7 shopping workflow, §11–§14 cart, §15–§18 checkout/address)
- `03-DATABASE-DESIGN.md` (commerce/payment/order table groups)
- `04-API-SPECIFICATION.md` (§41–§50 cart/checkout/order APIs)
- `09-SECURITY-SPEC.md` (§34 checkout integrity, §36 order state security)
