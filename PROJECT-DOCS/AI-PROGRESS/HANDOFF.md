# HANDOFF — BILOKAT

For the next AI session.

| Key | Value |
|---|---|
| CURRENT SESSION | Session 02 — Authentication + Authorization (foundation) |
| STATUS | PARTIALLY_COMPLETE (auth+RBAC foundation verified live + tested; ABAC/tenant/step-up deferred) |
| NEXT SESSION | Session 03 — Catalog API |
| NEXT WORKFLOW | Backend: product/category/variant endpoints (public read) that serve the landing-page data — `GET /api/v1/products`, categories, product detail; plus seed script |

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

## FILES ADDED (Session 02 — `src/auth/` + migrations)
- `prisma/migrations/20260907115442_add_user_sessions`, `.../...15613_sessions_unique_refresh`
- `src/auth/auth.{module,controller,service,types}.ts`, `auth-request.d.ts`
- `src/auth/dto/{auth.dto,logout.dto}.ts`
- `src/auth/guards/{jwt-auth.guard,roles.guard,roles.guard.spec}.ts`
- `src/auth/decorators/{roles.decorator,current-user.decorator}.ts`
- `src/auth/auth.service.spec.ts`
- `src/app.module.ts` (import AuthModule)

## KNOWN ISSUES
- Landing-page is still a hardcoded prototype (visual reference) — not yet
  served from the backend.
- Only the routes marked `@UseGuards(JwtAuthGuard)` are protected; all public
  endpoints are intentionally open.
- `.env.example` JWT secrets are placeholders — rotate before any deployment.
- GitHub token shared in chat → **owner must rotate it**.

## BLOCKERS
- Owner should rotate the GitHub token.
- Prisma `deepmerge-ts` advisory (dev-only) — re-check in Session 15.

## DO NOT REIMPLEMENT (next session)
- Auth foundation done — reuse JwtAuthGuard / RolesGuard / envelope / PrismaService.
- Do not re-scaffold NestJS/Prisma/config.
- Follow `04-API-SPECIFICATION.md` product/category API + `03-DATABASE-DESIGN.md`
  catalog tables when building the catalog endpoints.
- Landing-page design language is the UI reference for `customer-web` later.

## DOCUMENTS TO READ (Session 03 — Catalog API)
- `04-API-SPECIFICATION.md` (§33 category API, §35 product API, §34 attribute,
  §18–§29 response/pagination/filter/sort)
- `03-DATABASE-DESIGN.md` (§29 categories, §34–§37 product/variant/attribute/media)
- `00-MASTER-SPEC.md` (§17–§23 catalog/listings/product visibility, §25 discovery,
  §26 search, §27 homepage)
