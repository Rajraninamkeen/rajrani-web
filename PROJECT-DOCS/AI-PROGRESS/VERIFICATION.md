# VERIFICATION — BILOKAT

> Commands actually executed and their results. Do not claim a command passed
> unless it was actually run this session.

## Session 00 — 2026-09-07

| Command | Result |
|---|---|
| `git -C . branch -a` | `* main`, `remotes/origin/main` |
| `git remote -v` | `origin https://github.com/Rajraninamkeen/concept.git` |
| `git status` | On branch main; working tree clean; nothing to commit |
| `git log --oneline -15` | `da32542 Initial project structure` (single commit) |
| `git rev-list --count HEAD` | 1 |
| `git ls-files \| wc -l` | 45 tracked files |
| `ls PROJECT-DOCS/*.md` | 13 spec docs (all present) |
| `git ls-files \| grep -c node_modules` | 0 (none tracked) |
| `find . -name ".env*"` | none |
| Secret pattern grep (keys/tokens/private keys across non-lock files) | No high-confidence secrets; only generic word "secret" / placeholder spec text |
| `node -v` | v20.20.2 |
| `npm -v` | 10.8.2 |
| `npm ci --no-audit --no-fund` | OK (dependencies installed) |
| `npx tsc --noEmit` (in `landing-page/`) | exit 0 — typecheck PASS |
| `npm run build` (in `landing-page/`) | exit 0 — vite build PASS; `dist/index.html` 409.04 kB (gzip 107.38 kB) |

## Not run / not possible
- No backend build/typecheck/tests (no backend exists yet).
- No test commands exist (no test suite configured in the repo).
- No DB commands (no database/infrastructure provisioned).
- No security scanner beyond targeted grep (add real scanner in Session 15).

---

## Session 01 — bilokat-api (2026-09-07)

| Command (in `/home/user/bilokat-api`) | Result |
|---|---|
| `npx prisma validate` | schema valid |
| `npx prisma generate` | Generated Prisma Client |
| `npx prisma migrate dev --name init` | Applied `20260907114155_init` |
| `npx prisma migrate dev --name map_users_snakecase` | Applied `20260907114205_map_users_snakecase` |
| `psql -c "\dt"` (bilokat db) | 9 tables present (addresses, categories, coupons, product_media, product_reviews, product_variants, products, users, _prisma_migrations) |
| `npx tsc --noEmit -p tsconfig.json` | exit 0 — typecheck PASS |
| `npm run build` | exit 0 — nest build PASS |
| `npm test` | 2 suites / 4 tests PASS |
| `curl /api/v1/health` | `{success:true, postgres:up, app:up}` |
| `curl -I /api/v1/health` | `X-Request-Id` header present |
| `curl /api/v1/nope` | HTTP 404 with error envelope |
| `npm audit` | 3 high (single `deepmerge-ts` transitive advisory in Prisma CLI dev tool; deferred) |
| `git status` in bilokat-api | clean, 1 commit, 28 files, no `.env`/`node_modules` staged |
