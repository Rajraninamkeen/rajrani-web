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

## Session 02 — auth (2026-09-07, `/home/user/rajrani-web`)

| Command / check | Result |
|---|---|
| `npx prisma migrate dev --name add_user_sessions` | non-interactive blocked; applied via manual SQL + recorded (see below) |
| `prisma migrate diff ... ` + psql apply + record into `_prisma_migrations` | unique index `user_sessions_refreshTokenHash_key` created; 4 migrations recorded |
| `npm run typecheck` | exit 0 |
| `npm run build` | exit 0 |
| `npm test` | 4 suites / 12 tests PASS |
| `POST /api/v1/auth/register` | success:true, role CUSTOMER, access token issued |
| `GET /api/v1/auth/me` (Bearer) | returns user (email/role) |
| `GET /api/v1/auth/me` (no token) | HTTP 401 |
| `POST /api/v1/auth/refresh` | success; new refresh token differs (rotation) |
| reuse of old refresh token | UNAUTHORIZED; post-reuse new token also revoked |
| `POST /api/v1/auth/logout` | revokes session |
| `git push origin main` | `b0f3cfb..fcc6682` pushed |

## Session 03 — catalog API (2026-09-07, `/home/user/rajrani-web`)

| Command / check | Result |
|---|---|
| migration `20260907120621_product_catalog_display_fields` (manual apply + record) | 5 migrations in DB |
| `npx ts-node prisma/seed.ts` (x2 idempotent) | 5 categories, 8 products |
| `npm run typecheck` | exit 0 |
| `npm run build` | exit 0 |
| `npm test` | 5 suites / 15 tests PASS |
| `GET /catalog/categories` | 5 categories (bestseller/spicy/mixtures/healthy/gifts) |
| `GET /catalog/products` | total 8, pagination meta present |
| `GET /catalog/products?bestseller=true` | 5 bestsellers |
| `GET /catalog/products?category=healthy` | 2 |
| `GET /catalog/products?q=makhana` | 1 |
| `GET /catalog/products?sort=price_asc` | [139,149,159,169,189,249,299,899] |
| `GET /catalog/products/bilokat-royal-ratlami-sev` | price 189, orig 240, disc 21%, rating 4.9 |
| `GET /catalog/products/<missing>` | HTTP 404 (error envelope) |
| `git push origin main` | `1c5e199..ebd9ce0` pushed |

## Tech Upgrade (Prisma 6->7.10), 2026-09-07

| Command / check | Result |
|---|---|
| `prisma generate` (v7, config) | client -> ./src/generated/prisma |
| `prisma validate` | valid (config loaded from prisma.config.ts) |
| `prisma migrate deploy` | clean — "No pending migrations to apply" (5) |
| `prisma migrate resolve --applied 20260907120621_product_catalog_display_fields` | marked applied |
| `npm run typecheck` | exit 0 |
| `npm run build` | exit 0 |
| `npm test` | 5 suites / 15 PASS |
| `prisma db seed` | 5 categories / 8 products |
| live health | postgres up (Prisma 7 + PrismaPg adapter log) |
| live catalog + auth (register/login) via adapter | success |
| `npm audit` | 6 findings incl. 5 high (largely Prisma CLI/`deepmerge-ts`-style dev tooling + `@prisma/streams-local` node>=22); runtime not blocked. Deferred to Session 15 review. |
| NestJS 12 ESM + Jest | FAILED (reverted to NestJS 11; recorded) |

## Session 04 — commerce (2026-09-07, `/home/user/rajrani-web`)

| Command / check | Result |
|---|---|
| migrations `commerce_models`, `cart_status_merged` (manual apply + record) | 7 migrations recorded in DB |
| `npm run typecheck` | exit 0 |
| `npm run build` | exit 0 |
| `npm test` | 7 suites / 26 tests PASS (added cart.service, order.service) |
| seed coupons upsert | BILOKAT20 (20%), FLAT50 (₹50), SAVE10 (10%) ACTIVE |
| register + login user (Bearer) | success; customer role |
| `GET /cart` (auth) → add items | empty cart created; subtotal 437 after 2 items |
| over-stock add (qty 99 vs stock 12) | BAD_REQUEST "Only 12 units ... in stock" |
| guest cart create + add | subtotal 567 (ratlami x3) |
| authenticated `GET /cart` + guest header (merge) | items carried over; guest cart → MERGED |
| `GET /checkout/preview?cartId&couponCode=BILOKAT20` | couponDiscount 87.4; grandTotal 420.45 (coupon applied) |
| `POST /checkout` (COD + BILOKAT20) | order PLACED, orderNumber BK-*, paymentStatus COD_PENDING, grandTotal 420.45 |
| DB post-order | nylon sev stock 31→29, bhujia 15→14; coupon usageCount 1; cart status CONVERTED |
| `GET /orders` + `GET /orders/:id` | list 1; detail PLACED/COD/420.45 |
| `POST /orders/:id/cancel` | status CANCELLED; stock restored (29→31, 14→15) |
| `git push origin main` | commits `7424840`, `d8c6205`, `3037e31`, `3348021` pushed |


## Session 04 follow-up — hardening (2026-09-07)

| Command / check | Result |
|---|---|
| `npm test` | 7 suites / 31 tests PASS (commerce specs 10→16) |
| `npm run typecheck` / `build` | exit 0 |
| checkout on already-CONVERTED cart | 409 CONFLICT "not active or already checked out" |
| `GET /orders?page=1&limit=1` | `{orders,total,page,limit,totalPages}`; total 3, onpage 1 |
| `GET /orders?page=2&limit=1` | onpage 1 PLACED |
| `GET /orders?status=CANCELLED` | total 1, all CANCELLED |
| `GET /orders?status=BOGUS` | 400 BAD_REQUEST |
| `git push origin main` | commit `dfb27f7` pushed |

