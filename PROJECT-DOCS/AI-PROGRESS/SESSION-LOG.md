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
