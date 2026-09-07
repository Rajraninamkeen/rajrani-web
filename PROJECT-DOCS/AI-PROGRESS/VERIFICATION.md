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


## Session 05 — buy-now + payments + COD (2026-09-07, `/home/user/rajrani-web`)

| Command / check | Result |
|---|---|
| migration `payment_cod_models` (manual apply + record) | applied; `prisma migrate deploy` clean (8) |
| reconcile migration ledger (rename cart_status_merged row, drop stray dup, resolve product display) | deploy reports "No pending migrations" |
| `npm run typecheck` / `build` | exit 0 |
| `npm test` | 9 suites / 41 tests PASS (added payment.service, cod.service) |
| `POST /buy-now/preview?productId=shahi-kaju-mixture` | grandTotal 362.95 (server-derived) |
| `POST /buy-now` (PREPAID khatta-meetha x3) | order PLACED/PENDING; payment intent created (state INITIATED, amount 532) |
| `GET /orders/:id/payment` | returns intent INITIATED |
| `POST /payments/webhook/sandbox` valid-signed capture | payment CONFIRMED; order PAID; 1 payment_transaction; webhook PROCESSED |
| re-send same providerEventId | idempotent (no reprocess) |
| webhook with bad signature | HTTP 403; webhook row signatureVerified=f, FAILED |
| `POST /buy-now` (COD roasted-diet-chana x2) | order PLACED/COD_PENDING |
| `POST /orders/:id/cod/otp` | returns 6-digit devOtp (hash stored) PENDING_CUSTOMER_OTP |
| wrong OTP verify | stays PENDING (attempt incremented) |
| correct OTP verify | verification CONFIRMED; order CONFIRMED/COD_PENDING |
| `GET /orders/:id/cod` | status CONFIRMED |
| `git push origin main` | schema `a15e75e`, backend `161e4d4`, tests + docs commits pushed |


## Session 06 — fulfilment + delivery state machine (2026-09-07, `/home/user/rajrani-web`)

| Command / check | Result |
|---|---|
| `npm run typecheck` / `build` | exit 0 |
| `npm test` | 10 suites / 49 tests PASS (added fulfilment.service.spec — 8 tests) |
| promote `op6@example.com` to OPERATOR; fresh login | JWT `role=OPERATOR`; operator user id = actor in audit rows |
| PREPAID buy-now (festive hamper x2) | order PLACED/PENDING; intent INITIATED amount 1887.9 |
| signed sandbox webhook `payment.captured` (amount 1888) | PROCESSED; Payment CONFIRMED; order paymentStatus PAID (still PLACED) |
| `POST /fulfilment/advance` with a CUSTOMER token → CONFIRMED | HTTP 403 FORBIDDEN (customer cannot self-set) |
| OPERATOR advance → CONFIRMED | order CONFIRMED (gate: PREPAID PAID) |
| OPERATOR advance → PACKED → SHIPPED → OUT_FOR_DELIVERY → DELIVERED | each success; final DELIVERED |
| illegal jump PACKED→DELIVERED | 409 CONFLICT |
| post-terminal DELIVERED→CANCELLED | 409 CONFLICT |
| DB after DELIVERED | status DELIVERED, paymentStatus PAID, deliveredAt set |
| `order_status_history` for order | PLACED(CUSTOMER)→CONFIRMED→PACKED→SHIPPED→OUT_FOR_DELIVERY→DELIVERED all actor CONTROL with operator id + reasons |
| COD buy-now → OTP send/verify (devOtp) | order CONFIRMED / COD_PENDING |
| OPERATOR advance COD CONFIRMED→PACKED→SHIPPED→OUT_FOR_DELIVERY→DELIVERED | DELIVERED; DB paymentStatus **COD_PAID**, deliveredAt set |
| `GET /orders/:id/history` (customer) | returns ordered timeline (from→to, actor, reason) |
| `git push origin main` | backend `645f851` (+ AI-PROGRESS commit) pushed |

## Session 07 — returns + refunds (2026-09-07, `/home/user/rajrani-web`)

| Command / check | Result |
|---|---|
| `npx prisma validate` / `generate` | schema valid; client regenerated |
| migration `20260907133000_return_refund_models` apply + ledger record | applied; `prisma migrate deploy` clean (9) |
| `npm run typecheck` / `build` | exit 0 |
| `npm test` | 11 suites / 63 tests PASS (added returns.service.spec — 14 tests) |
| PREPAID buy-now + signed capture | order PLACED/PAID; payment CONFIRMED |
| operator fulfil to DELIVERED | CONFIRMED→PACKED→SHIPPED→OUT_FOR_DELIVERY→DELIVERED all OK |
| `POST /orders/:id/returns` with OPERATOR token | 404 (ownership: only the order owner may request) |
| customer `POST /orders/:id/returns` (DEFECTIVE) | ReturnRequest REQUESTED; order RETURN_REQUESTED |
| customer `POST /return-requests/:id/decision` | 403 FORBIDDEN (RBAC) |
| operator decision reject, no reason | 400 "A reason is required to reject a return" |
| operator decision reject (with reason) | ReturnRequest REJECTED; order back to DELIVERED |
| re-request (QUALITY_ISSUE) + operator approve | ReturnRequest APPROVED; order RETURNED |
| `POST /return-requests/:id/refund` (default) | Refund `RFD-...` 1887.90 GATEWAY PENDING; order REFUND_PENDING |
| `POST /return-requests/:id/refund/complete` | Refund COMPLETED (`sndbox-refund-...`); order REFUNDED / paymentStatus REFUNDED |
| double `complete` | 409 CONFLICT |
| `payment_transactions` for the order | CAPTURE 1887.90 SUCCESS + REFUND 1887.90 SUCCESS |
| `return_requests` | one REJECTED (DEFECTIVE) + one COMPLETED (QUALITY_ISSUE) |
| `order_status_history` | full audit: PLACED→…→DELIVERED→RETURN_REQUESTED→DELIVERED→RETURN_REQUESTED→RETURNED→REFUND_PENDING→REFUNDED (customer + CONTROL actors) |
| `git push origin main` | schema+backend+tests `20fb712` (+ AI-PROGRESS commit) pushed |

## Session 08 — item-level returns + full pickup/inspection lifecycle (2026-09-07, `/home/user/rajrani-web`)

> Supersedes Session 07's whole-order return model. Live evidence below uses
> order `cmtr9ht8c0006k8nzbb2xerr3` (PREPAID, DELIVERED, grand ₹1887.90, single
> line qty 2 @ ₹899) and the earlier two-partial order `cmtrbhlgm000276nztebf4vvr`
> (grand ₹403.90) already held by the same two partial returns.

| Command / check | Result |
|---|---|
| `npx prisma validate` / `generate` | schema valid; client regenerated |
| migration `20260907134000_return_item_lifecycle` apply + ledger | applied; `prisma migrate deploy` clean (10) |
| `npm test` | 11 suites / **66 tests** PASS (returns.service.spec rebuilt item-level — 17 tests) |
| `npm run typecheck` / `build` | exit 0 |
| customer `POST /api/v1/orders/:orderId/returns` with item+quantity (qty1/2) | ReturnRequest `REQUESTED`; `return_items` row (orderItemId, qty 1) |
| non-operator calls inspection endpoint | 403 FORBIDDEN (RBAC) |
| operator decision approve (with reason) | `APPROVED` |
| operator `pickup` → `picked-up` | `PICKUP_SCHEDULED` → `PICKED_UP` |
| operator inspection **PASS** (full pass path) | auto `APPROVED_FOR_REFUND`; per-item refundAmount **₹943.95** = half grand (proportional, qty1/2) |
| operator `refund` initiate | Refund ₹943.95 GATEWAY PENDING |
| operator `refund/complete` | Refund `COMPLETED`; ReturnRequest `COMPLETED`; `refund_transactions` SUCCESS 943.95 |
| order after this partial return | still `DELIVERED` / `PAID` (not flipped — partial) |
| `return_events` on a full-pass inspection (audit-fix regression) | `REQUESTED → APPROVED → PICKUP_SCHEDULED → PICKED_UP → APPROVED_FOR_REFUND → REFUND_INITIATED → REFUND_COMPLETED` — **no stray INSPECTION event** (pre-fix it appeared after APPROVED_FOR_REFUND) |
| two-partial order `cmtrbhlgm000276nztebf4vvr` | Return#1 qty1 ₹201.95 + Return#2 qty1 ₹201.95; 2×201.95 = ₹403.90 == grand → order auto `REFUNDED`/`REFUNDED`; both refunds COMPLETED; both `refund_transactions` SUCCESS |
| `git push origin main` | schema+backend+tests `f439879`; AI-PROGRESS docs in a following commit |

## Session 09 — Seller orgs + split-checkout core (2026-09-07, `/home/user/rajrani-web`)

| Command / check | Result |
|---|---|
| `npx prisma validate` / `generate` | schema valid; client regenerated |
| migration `20260907142140_seller_split_checkout` (backfill) + ledger | applied (11 total); `prisma migrate deploy` clean |
| `npm test` | 12 suites / **76 tests** PASS (order.service.spec 12 incl. split; seller-ops.service.spec 9) |
| `npm run typecheck` / `build` | exit 0 |
| sellers seeded | `SELL-BILOKAT` Bilokat Kitchens (legacy, 6 products), `SELL-RAJRANI` Rajrani Select (partner, 2 products) |
| buyer cart: ratlami-sev×2 (Bilokat) + shahi-kaju-mixture (Rajrani) → COD checkout | order `BK-MTRC6MCA` PLACED, grand **₹710.85**; **2 seller_orders** ₹396.90 (Bilokat) + ₹313.95 (Rajrani); Σ == 710.85; per-item `sellerName` present |
| seller1 `POST /seller/orders/:id/accept` (its Bilokat slice) | seller_order → `ACCEPTED`, `acceptedAt` set |
| seller2 `POST /seller/orders/:id/reject` {reason} (its Rajrani slice) | seller_order → `REJECTED`, `rejectionReason` recorded |
| seller2 accepts Bilokat slice (not its own) | 404 |
| reject with empty/no reason | 400 |
| buyer (CUSTOMER) calls `/seller/orders` | 403 FORBIDDEN |
| re-accept of an already-ACCEPTED slice | 400 |
| `GET /orders/:id` (customer) | exposes `sellerOrders` with sellerName/status/grandTotal |
| buyer cancels the multi-seller COD order | order `CANCELLED`; ACCEPTED seller_order → `CANCELLED`, REJECTED slice stays REJECTED |
| buy-now (single seller, nylon-sev) | order `CANCELLED` for cleanup; created exactly **1** seller_order |
| returns/refunds/fulfilment regression | existing order-level flows green (suite) |
| `git push origin main` | schema+backend+tests pushed (Session 09 commits) |
