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

## Session 10 — Per-seller fulfilment gating + delivery markers (2026-09-07, `/home/user/rajrani-web`)

| Command / check | Result |
|---|---|
| migration `20260907143713_seller_fulfilment_markers` + ledger | applied (12 total); `prisma migrate deploy` clean |
| `npm test` | 12 suites / **81 tests** PASS (fulfilment.service.spec +5 gate/marker cases) |
| `npm run typecheck` / `build` | exit 0 |
| multi-seller order (Bilokat + Rajrani) set to PACKED, seller slices PLACED | — |
| operator `POST /orders/:id/fulfilment/advance` {SHIPPED} before any seller accepts | **400** `Every seller must accept their slice before shipping. Not ready: Bilokat Kitchens (PLACED), Rajrani Select (PLACED)` |
| seller1 `accept` its slice → seller2 `accept` its slice | both `ACCEPTED` |
| operator advance {SHIPPED} (after acceptance) | 200 → order `SHIPPED`; `shippedAt` stamped on both accepted slices |
| operator advance {DELIVERED} | 200 → order `DELIVERED`; `deliveredAt` stamped on both accepted slices |
| seller-ops `GET /seller/orders` for the order | seller_order shows `shippedAt: true, deliveredAt: true` |
| `git push origin main` | schema+backend+tests pushed (Session 10 commit) |

## Session 11 — Partial fulfilment resolution of rejected seller slices (2026-09-07, `/home/user/rajrani-web`)

| Command / check | Result |
|---|---|
| migration `20260907232834_partial_fulfilment_resolution` + ledger | applied (13 total); `prisma migrate deploy` clean |
| `npm test` | 12 suites / **86 tests** PASS (order.service.spec 17 incl. 5 resolution cases) |
| `npm run typecheck` / `build` | exit 0 |
| multi-seller PREPAID order `BK-MTRVM3QQ` (id `cmtrvm3r9000bg4nzp51b4eku`), grand ₹710.85 | sandbox capture webhook (integer 711) → order PAID; operator CONFIRMED → PACKED; slices: Bilokat `cmtrvm3rp000dg4nzhqv5ya05` ₹396.90, Rajrani `cmtrvm3rv000eg4nz3mj8iemr` ₹313.95 (both PLACED) |
| seller1 `POST /seller/orders/:soId/accept` (Bilokat slice) | seller_order → `ACCEPTED` |
| seller2 `POST /seller/orders/:soId/reject` {reason:"out of stock"} (Rajrani slice) | seller_order → `REJECTED` |
| operator `POST /orders/:id/slices/:soId/resolve-reject` (Rajrani slice, reason) | 200; Rajrani slice → `CANCELLED` with `cancelledAt` + `cancellationReason`; response slices show Bilokat ACCEPTED (not cancelled), Rajrani CANCELLED |
| Rajrani kaju `stockOnHand` before vs after resolve | 7 → **8** (slice's stock released exactly once) |
| refunds row for the order | one **COMPLETED** `GATEWAY` refund `RFD-654D96F438B8` **₹313.95** == slice grandTotal; `refund_transactions` SUCCESS; `sellerOrderId` set, `returnRequestId` NULL (return-request-free cancellation refund) |
| operator advance {SHIPPED} (only ACCEPTED Bilokat slice remains; Rajrani CANCELLED) | 200 → order `SHIPPED`; Bilokat slice `shippedAt` stamped, Rajrani slice stays CANCELLED (no shippedAt) |
| operator advance {DELIVERED} | 200 → order `DELIVERED`; Bilokat slice `deliveredAt` stamped |
| customer `GET /orders/:id` | order DELIVERED / PAID; Rajrani slice exposes `cancelledAt: true` + reason; Bilokat slice shipped+delivered, cancelledAt false |
| double stock-release guard | `cancelOrder` skips items of already-CANCELLED slices (unit-tested) |
| `git push origin main` | schema+backend+tests pushed (Session 11 commit) |

## Session 12 — Seller payables & settlements (2026-09-07, `/home/user/rajrani-web`)

| Command / check | Result |
|---|---|
| migration `20260907234906_seller_payables_settlements` + ledger | applied (14 total); `prisma migrate deploy` clean (no pending) |
| `npm test` | 13 suites / **101 tests** PASS (settlement.service.spec +15; fulfilment.service.spec updated for new dep) |
| `npm run typecheck` / `build` | exit 0 |
| sellers commission | `SELL-BILOKAT` 0 bps, `SELL-RAJRANI` 1000 bps (10%) |
| multi-seller PREPAID order `BK-MTRWEGUT` (grand ₹710.85) | captured PAID → CONFIRMED → PACKED; both seller slices ACCEPTED → SHIPPED → DELIVERED |
| auto-earn at DELIVERED (`seller_payables` for the order) | 2 EARNED rows, each reconciles to its slice grandTotal exactly: Bilokat gross 378.00 / comm 0 / net **378.00** (goods 378 + tax 18.90 + del 0 = 396.90); Rajrani gross 299.00 / comm 29.90 / net **269.10** (269.10+29.90+14.95 = 313.95) |
| operator `POST /finance/payables/:id/adjustments` {amount:-10} | Rajrani payable net ₹269.10 → **₹259.10**; adjustment row recorded (actor OPERATOR) |
| operator `POST /finance/settlements` (Rajrani payable) | **STL-445969B3** PENDING, net ₹259.10, comm ₹29.90, 1 item (SO-MTRWEGW0-6871 ₹259.10) |
| `POST /finance/settlements/:id/advance` | APPROVED → PROCESSING → PAID → RECONCILED (each an audited `settlement_events` row); on PAID the Rajrani payable → **SETTLED**; Bilokat payable stays EARNED |
| advance RECONCILED → PAID | **409 CONFLICT** `Cannot move settlement from "RECONCILED" to "PAID"` |
| second settlement re-including the settled Rajrani payable | **409 CONFLICT** `One or more payables are already in a settlement` |
| seller2 (Rajrani) `GET /seller/payables` + `/seller/settlements` | sees own payable (₹259.10 SETTLED) + settlement STL-445969B3 RECONCILED ₹259.10 |
| 2nd order `BK-MTRWFK4Z`: Rajrani REJECTED → operator resolve-reject → delivered | only the delivered ACCEPTED Bilokat slice earned a payable **₹189.00**; the CANCELLED Rajrani slice has **no** payable (₹0 earned) — Session-11 rejected/cancelled slice contributes nothing |
| `git push origin main` | schema+backend+tests pushed (Session 12 commit) |

## Session 13 — Finance reconciliation + reporting (auto return-debit) (2026-09-08, `/home/user/rajrani-web`)

| Command / check | Result |
|---|---|
| migrations | none new; 14 applied, `prisma migrate deploy` clean (no pending) |
| `npm run typecheck` / `build` | exit 0 |
| `npm test` | 13 suites / **110 tests** PASS (settlement.service.spec +9; returns.service.spec +1) |
| returns auto-debit | `ReturnsService.completeRefund` now calls `SettlementService.debitReturnedGoodsForRefund` inside its own `$transaction` |
| customer return on delivered slice of `BK-MTRWFK4Z` | full item-level return (Bilokat ratlami-sev ₹189) → approve → pickup → picked-up → inspection **PASS** → initiate refund `RFD-MTRX0MTT-PB39` ₹217.43 (PENDING) → complete → return **COMPLETED** |
| auto-debit effect on payable `cmtrwfv3…` (Bilokat EARNED ₹189) | **net ₹189 → ₹0**, `refundAmount` ₹0 → ₹189, stored signed `adjustmentAmount` → **−₹189**; audited append-only `seller_payable_adjustments` row `actorType: SYSTEM`, `amount: −189`, `actorId` = returnRequestId, reason references the return + `RFD-MTRX0MTT-PB39` |
| `GET /finance/reconciliation/summary` | returns `{ ok, discrepancyCount, checked {deliveredOrders:3, payables:3} }`; flags **only** the pre-existing historical `delivered_slice_missing_payable` (pre-settlement E2E order `cmtrvm3r9…`, slice `SO-MTRVM3RO-9049`); **no** discrepancy from the auto-debit (net 0 = goods 189 − 0 − 189) |
| `GET /finance/report/totals` | per-seller + grand totals — Bilokat goods ₹567 / refund ₹189 / adj −₹189 / net ₹378; Rajrani goods ₹299 / adj −₹10 / net ₹259.10; grand net ₹637.10, refund ₹189, adj −₹199 |
| `GET /finance/report/totals?sellerId=seller-legacy` | returns only Bilokat (net ₹378) — filter DTO-whitelisted |
| date filter `?from=…&to=…` | valid ISO range accepted |
| RBAC | CUSTOMER → **403** on `/finance/reconciliation/summary` and `/finance/report/totals`; no token → **401** |
| seller self-service | `seller1` (Bilokat) `GET /seller/payables` → own two payables (EARNED net ₹0 refund ₹189; EARNED net ₹378); scoped to own org |
| `git push origin main` | deferred — waiting on owner-rotated GitHub token |
## Session 14 — Seller onboarding/KYC + Organizations + REVIEWER (2026-09-08, `/home/user/rajrani-web`)

| Command / check | Result |
|---|---|
| migration `20260908100000_orgs_onboarding_kyc` | **15th migration**, applied to live DB via `psql -f` + manual `_prisma_migrations` insert (plain `INSERT ... WHERE NOT EXISTS`); `npx prisma migrate status` = 15, **up to date**; `npx prisma generate` ok |
| `npm run typecheck` / `build` | exit 0 |
| `npm test` | **15 suites / 124 tests PASS** (seller-onboarding.service.spec +12 incl. adminCreateSeller tx-history regression + OWNER-member bind; auth.seller-register.spec +2) |
| schema tables | `organizations`, `organization_members`, `seller_applications`, `seller_documents`, `seller_reviews`, `seller_status_history` present; `sellers.organizationId`/`activatedAt` + expanded `SellerStatus` |
| `POST /auth/seller-register` | 201 → SELLER user role=SELLER, seller **PENDING** w/ `SELL-XXXXXXXX`, org `organizationId` set, OWNER membership row |
| REVIEWER RBAC negatives | REVIEWER token → **403** on `/seller/onboarding/me`, `/finance/payables`, `/finance/settlements`, `/seller/orders/:id/accept`, and `POST /seller-onboarding/sellers`; no token → 401 |
| owner onboarding | `GET /seller/onboarding/me` 200; `PATCH /profile` (pan/address/agreedToTerms) 200 app DRAFT; `POST /documents` (storage-intent) → **PENDING**, no object store; `POST /submit` → app **SUBMITTED** |
| staff review | REVIEWER `GET /seller-onboarding/applications` (list) 200; `GET .../:id` 200 (docs+reviews); `POST .../:id/review {APPROVE}` 201 → app **APPROVED** (`reviewedBy` set) |
| activation | `POST /seller-onboarding/sellers/:id/activate` 201 → seller **ACTIVE** + `activatedAt` |
| guards | re-review of closed (APPROVED) app → **409** "already closed"; owner `POST /submit` once ACTIVE → **409** "not editable" |
| OPERATOR admin-create | `POST /seller-onboarding/sellers` (OPERATOR) → **201 ACTIVE** seller, commissionRateBps 250, org + `operatorCreated:true` (OWNER member) — after fixing the tx-scoped status-history FK 500 |
| `git push origin main` | pushed `8930517` Session 14 to `main` (2026-09-08) |
## Session 15 — Per-slice delivery / courier handoff (DELIVERY role) (2026-09-08, `/home/user/rajrani-web`)

| Command / check | Result |
|---|---|
| migration `20260908150000_seller_slice_delivery_courier` | **16th**, applied to live DB via `psql -f` + `_prisma_migrations` insert; `npx prisma migrate status` = 16, up to date; `prisma generate` ok |
| `npm run typecheck` / `build` | exit 0 |
| `npm test` | **16 suites / 136 tests PASS** (delivery.service.spec +12) |
| tables/enums | `delivery_partners`, `delivery_assignments`, `delivery_events`, `DeliveryPartnerStatus`, `DeliveryAssignmentStatus`; no ALTERs to order/seller_order/payable tables |
| partner registry | OPERATOR `POST /delivery/partners` for a DELIVERY user → **201 ACTIVE** partner `DLV-…`; OPERATOR `GET /delivery/partners` 200 |
| RBAC | DELIVERY → **403** on `/delivery/partners`, `/delivery/assignments`, `/finance/settlements`; OPERATOR → **403** on `/delivery/tasks`; REVIEWER → **403** on `/delivery/partners`; DELIVERY `GET /delivery/tasks` **200** (empty) |
| operator surfaces | `GET /delivery/assignments` 200 (total 0); `POST /delivery/slices/:id/assign` on a bogus slice → **404** (route reachable) |
| courier slice flow (accept→pickup→out-for-delivery→deliver/fail, own-assignment authz, step ordering, final-slice earn) | covered by `delivery.service.spec` (12 tests); final-slice `deliver` asserts `settlement.earnDeliveredSlices(tx, orderId)` only on the last slice — not re-run live this pass (no courier-stage order existed in the live DB) |
| `git push origin main` | pushed (`5168b36` code+migration, `d745d3b` docs) |

## Session 16 — Return replacement vs refund + evidence upload (2026-09-08, `/home/user/rajrani-web`)

Server `bilokat-api-session-16-…` on `:4000` (fresh `dist/main.js` build). Fixtures: reset
`s12@example.com` password (throwaway test customer, owns DELIVERED `BK-MTRWEGUT`); operator
`pfop@example.com`.

| Check | Result |
|---|---|
| migrations | 18 applied, `prisma migrate status` up to date; `prisma generate` OK; typecheck + `npm run build` clean |
| unit tests | `returns.service.spec.ts` +9 → **16 suites / 145 tests** green |
| replacement request | CUSTOMER `POST /orders/:orderId/returns` `{resolution:REPLACEMENT, evidence:[photo]}` on item qty2 → **201** `REQUESTED`, `resolution REPLACEMENT`, `evidenceRequired true`, 1 evidence row, items `replacementRequested true` |
| replacement lifecycle | OPERATOR decision APPROVE → pickup → picked-up → inspection PASS → **`REPLACEMENT_ISSUED`** (terminal) with `replacement` `RPL-MTRZGF1A-GBLH` `PENDING_DISPATCH` `quantityTotal 2` |
| no money on replacement | DB: **no `refunds` row** created for the replacement return; `POST …/refund` → **409**; `return_requests` row `REPLACEMENT_ISSUED`/`REPLACEMENT`/evidenceRequired true |
| evidence-on-terminal | CUSTOMER `POST …/returns/:id/evidence` on the terminal request → **409** |
| refund path intact | REFUND-resolution return on the order's other line → inspection `APPROVED_FOR_REFUND` (`approvedForRefundAt` + per-line `refundAmount`) → refund initiate `PENDING` → complete `COMPLETED` / return `COMPLETED` (money + auto-debit logic unchanged) |
| RBAC | CUSTOMER → **403** on OPERATOR-only `POST /return-requests/:id/evidence`; customer evidence route enforces order ownership (404 cross-owner) |
| `git push origin main` | pushed (`b0f1f15` code+migration, `49863e3` docs) |

## Session 17 — Outbound replacement dispatch (2026-09-08, `/home/user/rajrani-web`)

Server `bilokat-api-session-17-…` on `:4000` (fresh `dist/main.js` build). Reused Session 16
fixtures + reset `pf@example.com` password (throwaway test customer). Operator `pfop@example.com`.

| Check | Result |
|---|---|
| migrations | 19 applied, `prisma migrate status` up to date; `prisma generate` OK; typecheck + `npm run build` clean |
| unit tests | `returns.service.spec.ts` +8 → **16 suites / 153 tests** green |
| RBAC | CUSTOMER `POST …/replacement/dispatch` → **403** (OPERATOR/ADMIN only) |
| dispatch | OPERATOR on return `…6zkb3ly` (`PENDING_DISPATCH` `RPL-MTRZGF1A-GBLH`) → **201 DISPATCHED** with `dispatchReference TRK-S17-1`, `dispatchBy`, `dispatchedAt`; re-dispatch → **409** |
| complete | OPERATOR `…/replacement/complete` → **201 COMPLETED** (`completedAt`); re-complete → **409**; cancel-on-completed → **409** |
| cancel | fresh REPLACEMENT return on `BK-MTRVM3QQ` (pf@example.com) driven to `REPLACEMENT_ISSUED`, then `…/replacement/cancel {reason:"stock unavailable"}` → **201 CANCELLED** with `cancellationReason`; cancel-again → **409** |
| no money | refund on a replacement still **409**; no `refunds` row; `settlement.debitReturnedGoodsForRefund` never called (non-money leg) |
| audit | `return_events` show REQUESTED…REPLACEMENT_ISSUED then REPLACEMENT_DISPATCHED/REPLACEMENT_COMPLETED (return …6zkb3ly) and REPLACEMENT_CANCELLED (return …0ph1tzh8) with OPERATOR actor |
| `git push origin main` | pending (this session; needs a fresh one-shot token) |

## Session 18 — Real Razorpay gateway + LIVE refund execution (2026-09-08, `/home/user/rajrani-web`)

API in **razorpay mode** on `:4000` (started `PAYMENT_GATEWAY_PROVIDER=razorpay RAZORPAY_KEY_ID=rzp_test_key
RAZORPAY_KEY_SECRET=secret RAZORPAY_WEBHOOK_SECRET=whsec_e2e RAZORPAY_BASE_URL=http://localhost:3911 PORT=4000 node
dist/main.js`); the API talks to the **local Razorpay-protocol mock** `scripts/razorpay-mock.mjs` on `:3911` (speaks the
real wire protocol: `POST /v1/orders`, `POST /v1/payments/:id/refund` → `processed`, `GET /__orders`). No real external
credentials are used. Reusable driver: `node scripts/e2e-razorpay.mjs` → 21 ok steps (exits non-zero on first failure).
Fresh run: order `BK-MTS18BPF` (DB `cmts18bpg0021khnznff3abja`), razorpay mock order `order_48bps`, payment
`pay_e2e_mts18bq6`, refund `RFD-MTS18BWI-7LJE`, gatewayRef `rfnd_mts18bx35tzu`.

| Check | Result |
|---|---|
| migrations | 20 applied, `prisma migrate status` up to date (`20260908171500_return_refund_processing_enum`); `ReturnEventType.REFUND_PROCESSING` present in the live DB enum; `prisma generate` OK; typecheck + `npm run build` clean |
| unit tests | `razorpay.gateway.spec.ts` +7 (incl. sandbox default), `payment.gateway.service.spec.ts` +6, `returns.service.spec.ts` +2 → **18 suites / 167 tests** green (sandbox default path unchanged) |
| sandbox default | with `PAYMENT_GATEWAY_PROVIDER` unset the constructor falls back to `new SandboxGateway()`; all prior suites green unchanged |
| intent (razorpay) | buy-now PREPAID ₹194.95 → razorpay order **`order_48bps`** created on the mock (amount in paise, unique receipt) + stored as `Payment.providerPaymentId`, provider `razorpay`, state INITIATED → only ONE order create per run (mock `__orders`) |
| webhook capture | raw-body HMAC-SHA256 `payment.captured` (`x-razorpay-signature`, secret `whsec_e2e`) → **200** payment `CONFIRMED` (`providerCaptureId pay_e2e_mts18bq6`) + order `PAID` + `payment_transactions` CAPTURE SUCCESS + `payment_webhooks` PROCESSED (`signatureVerified=t`) |
| idempotency | duplicate webhook replay → `idempotent:true` PROCESSED (no double-capture); deliberate bad signature → **403** |
| delivery | operator CONFIRMED/PACKED, seller accepted slice, SHIPPED, DELIVERED (all 200) |
| return → refund | customer return → operator decision APPROVED → pickup → picked-up → inspection PASS → **APPROVED_FOR_REFUND** ₹194.95 |
| live refund exec | initiate → `RFD-MTS18BWI-7LJE` PENDING; `…/refund/complete` called the active gateway → **real razorpay refund `rfnd_mts18bx35tzu`** (`POST /v1/payments/pay_e2e_mts18bq6/refund`, `processed` → COMPLETED synchronously) |
| ledger | psql: `refunds` row `RFD-MTS18BWI-7LJE` `gatewayProvider=razorpay` `gatewayRef=rfnd_mts18bx35tzu` COMPLETED; `refund_transactions` provider `razorpay` `rfnd_mts18bx35tzu` SUCCESS; return request COMPLETED; order `REFUNDED`/`REFUNDED`; events …REFUND_INITIATED → REFUND_COMPLETED |
| RBAC | `/api/v1/payments/webhook/razorpay` is intentionally NOT JWT-protected (authenticity = raw-body signature HMAC), consistent with the sandbox webhook route |
| `git push origin main` | pending (needs a fresh one-shot token) |

## Session 19 — Razorpay async refund reconciliation (2026-09-08, `/home/user/rajrani-web`)

API in **razorpay mode** on `:4100` (`PAYMENT_GATEWAY_PROVIDER=razorpay RAZORPAY_KEY_ID=rzp_test_key
RAZORPAY_KEY_SECRET=secret RAZORPAY_WEBHOOK_SECRET=whsec_e2e RAZORPAY_BASE_URL=http://localhost:3912 PORT=4100 node
dist/main.js`); the **local Razorpay-protocol mock** `scripts/razorpay-mock.mjs` ran in **async mode** on `:3912`
(`REFUND_ASYNC=1` → refunds return `pending`). Reusable driver `scripts/e2e-refund-async.mjs` → 20 ok steps.
Fresh run: order `BK-MTS23JIS` (DB `cmts23jje000316nz1vllwv51`), razorpay order `order_13jlm`, payment `pay_e2e_mts23jn3`,
refund `RFD-MTS23K0U-ZB5G`, gatewayRef `rfnd_mts23k1hwpmh`.

| Check | Result |
|---|---|
| migrations | 21 applied, `prisma migrate status` up to date (`20260908172000_return_refund_failed_enum`); `ReturnEventType.REFUND_FAILED` present in the live DB enum; `prisma generate` OK; typecheck + `npm run build` clean |
| unit tests | `razorpay.gateway.spec.ts` +2 (refund.processed/.failed normalisation), `returns.service.spec.ts` +4 (reconcile PROCESSING→COMPLETED, idempotent replay, refund.failed→FAILED, unknown rfnd) → **18 suites / 173 tests** green |
| intent/capture | buy-now razorpay PREPAID ₹194.95 → razorpay order `order_13jlm` (mock) + stored; `payment.captured` raw-body-HMAC webhook → order PAID (unchanged from Session 18) |
| submit in-flight | `refund/complete` submitted the live gateway refund; mock returned `pending` → Refund left **PROCESSING** with real `gatewayRef rfnd_mts23k1hwpmh`, `REFUND_PROCESSING` event, PENDING refund_transactions row |
| async reconcile | signed `refund.processed` webhook (`payload.refund.entity`, `id=rfnd_mts23k1hwpmh`) → `ReturnsService.reconcileRefundFromEvent` → Refund **COMPLETED**, `refund_transactions` SUCCESS + completedAt, return request **COMPLETED**, `REFUND_COMPLETED` (SYSTEM) event |
| ledger | psql: refund `RFD-MTS23K0U-ZB5G` `gatewayProvider=razorpay` `gatewayRef=rfnd_mts23k1hwpmh` COMPLETED completedAt=t; txn `razorpay` SUCCESS completedAt=t; order `REFUNDED`/`REFUNDED`; events REQUESTED…REFUND_PROCESSING(OPERATOR) then REFUND_COMPLETED(SYSTEM) |
| idempotency | replay of the same `refund.processed` → `{idempotent:true, status:'COMPLETED'}` (no double-complete/no double-debit) |
| failure path | (unit) `refund.failed` → Refund FAILED + reason, PENDING txn→FAILED, `REFUND_FAILED` SYSTEM audit, request stays APPROVED_FOR_REFUND, no settle |
| RBAC | `/api/v1/payments/webhook/razorpay` stays signature-authenticated (not JWT); refund completion remains OPERATOR/ADMIN; reconciliation is SYSTEM (webhook-driven) |
| `git push origin main` | Session 19 feature + docs committed and pushed (see git log) |

## Session 20 — Product listing/publishing (2026-09-08, `/home/user/rajrani-web`)

Sandbox-provider API on `:4300` (`PORT=4300 node dist/main.js`, default `PAYMENT_GATEWAY_PROVIDER`,
not used here) against the same dev DB; reusable driver `scripts/e2e-publishing.mjs` → 13 ok steps.
Fixtures: SELLER `seller1@example.com` (ACTIVE `seller-legacy`), OPERATOR `pfop@example.com`,
CUSTOMER `s12@example.com`, ACTIVE category `cmtrvg2j90005usnz1jaaa7mx`.

| Check | Result |
|---|---|
| migrations | 22 applied, `prisma migrate status` up to date (`20260908175000_product_publishing`); `product_status_history` table + `products.reviewNote` present; `prisma generate` OK; typecheck + `npm run build` clean |
| unit tests | new `src/publishing/product-publishing.service.spec.ts` (8) → **19 suites / 181 tests** green |
| create | SELLER `POST /seller/catalog` → product DRAFT, HIDDEN, auto-slug, own-list visible (`GET /seller/catalog`) |
| submit | `POST /seller/catalog/:id/submit` (DRAFT) → PENDING_REVIEW; appears in `GET /catalog-publishing/products?status=PENDING_REVIEW` for OPERATOR |
| approve | OPERATOR `POST /catalog-publishing/products/:id/approve` → `APPROVED` + `visibility LIVE` + `publishedAt`; now resolves publicly: `GET /catalog/products/:slug` 200 (public filter `APPROVED`+`LIVE` untouched) |
| reject | OPERATOR `POST …/reject {reason}` → `REJECTED` + `HIDDEN`, `publishedAt` null, reason in `reviewNote`; surfaced in SELLER's own `GET /seller/catalog/:id`; **not** publicly resolvable (404) |
| RBAC | CUSTOMER `GET /catalog-publishing/products` → 403; CUSTOMER `POST /seller/catalog` → 403; only a PENDING_REVIEW product may be approved/rejected (409 otherwise); seller edits/submits only DRAFT/REJECTED (409 otherwise); cross-seller read/edit → 404 |
| audit | psql `product_status_history` for the approved product: `DRAFT→PENDING_REVIEW→APPROVED` with actorRole SELLER/OPERATOR + reasons (created-as-draft, submitted, approved-by-operator) |
| cleanup | E2E-created products (`pub-*`) hard-deleted after the run; public catalog clean |
| `git push origin main` | Session 20 feature + docs committed and pushed (see git log) |

## Session 21 — Product reviews & ratings (2026-09-08, `/home/user/rajrani-web`)

Sandbox-provider API on `:4400` (`PORT=4400 node dist/main.js`) against the same dev DB; reusable driver
`scripts/e2e-reviews.mjs` → 17 ok steps. Fixtures: buyer CUSTOMER `s12@example.com`/`Test@12345` (DELIVERED
order `cmtrwegvj000hkvnz466lceg7` contains products `ratlami-sev` + `shahi-kaju-mixture`, both APPROVED+LIVE),
OPERATOR `pfop@example.com`/`Operator@123`, SELLER `seller1@example.com`/`Seller@123`, plus a freshly registered
non-buyer CUSTOMER for the 403 negative.

| Check | Result |
|---|---|
| migrations | 23 applied, `prisma migrate status` up to date (`20260908200000_product_reviews`); `product_reviews` has moderation cols + unique(productId,userId) + (userId,status) index; `prisma generate` OK; typecheck + `npm run build` clean |
| unit tests | new `src/reviews/reviews.service.spec.ts` (12) → **20 suites / 193 tests** green |
| create | buyer `POST /reviews` (`ratlami-sev`, 5★) → PENDING + `verifiedBuyer:true`; in `GET /reviews/me`; public `/catalog/products/ratlami-sev/reviews` shows 0 (not yet approved) |
| negatives | duplicate review → 409; fresh CUSTOMER with no DELIVERED purchase → 403; SELLER (non-CUSTOMER role) → 403; CUSTOMER on `/product-reviews` → 403 |
| moderation queue | OPERATOR `GET /product-reviews?status=PENDING` sees it |
| approve | `POST /product-reviews/:id/approve {note:'looks genuine'}` → PUBLISHED + moderationNote + moderatedAt; public read now returns it; `ratlami-sev` recomputed `ratingAvg 5` / `reviewCount 1` |
| hide/unhide | hide → HIDDEN, not public, aggregate 0/0; unhide → PUBLISHED restored |
| reject | second review (`shahi-kaju-mixture`) `POST …/reject {reason:'duplicate content'}` → REJECTED + reason; its product summary untouched (stays 4.9/2450) |
| edit-after-reject | `PATCH /reviews/:id` on the REJECTED review reopens → PENDING (awaiting re-moderation) |
| cleanup | E2E `product_reviews` rows deleted; `ratlami-sev`/`shahi-kaju-mixture` rating summaries reset to seeded (4.9/3820, 4.9/2450); throwaway registered CUSTOMERs deleted |
| RBAC | moderation is OPERATOR/ADMIN only (REVIEWER stays KYC-only); public read is auth-free and PUBLISHED-only |
| `git push origin main` | Session 21 feature + docs committed and pushed (see git log) |

## Session 22 — Courier last-mile delivery of a dispatched replacement (2026-09-08, `/home/user/rajrani-web`)

Sandbox-provider API on `:4500` (`PORT=4500 node dist/main.js`) against the same dev DB; reusable driver
`scripts/e2e-replacement-courier.mjs` → **31 ok steps**. Credentials: buyer `s12@example.com`/`Test@12345`,
OPERATOR `pfop@example.com`/`Operator@123`, SELLER `seller1@example.com`/`Seller@123`, DELIVERY
`delivery15@example.com`/`Delivery@123` (its partner profile was already ACTIVE).

| Check | Result |
|---|---|
| migrations | 24 applied, `migrate status` up to date (`20260908203000_replacement_courier`); `replacement_assignments` table + `ReturnEventType` courier events + `ReturnActorType.DELIVERY` present; typecheck + build clean |
| unit tests | new `src/commerce/replacement-courier.service.spec.ts` (12) → **21 suites / 205 tests** green |
| order+pay | fresh PREPAID buy-now order; sandbox webhook captured → order PAID; seller accepted slice; operator advanced to DELIVERED |
| replacement issue | customer REPLACEMENT return → operator approve/pickup/picked-up/inspection PASS → `REPLACEMENT_ISSUED` + replacement `PENDING_DISPATCH` |
| dispatch | operator `…/replacement/dispatch` → `DISPATCHED` |
| assign courier | `POST …/replacement/assign-courier {deliveryPartnerId}` → ASSIGNED (`RDLA-…`); partner `delivery15` |
| negatives | duplicate assign → 409; OPERATOR manual `/replacement/complete` while a courier is assigned → 409; CUSTOMER assigns → 403; DELIVERY hits OPERATOR route → 403; OPERATOR hits `/delivery/replacement-tasks` → 403 |
| courier task | not listed before accept (ASSIGNED excluded); accept → PICKED_UP → OUT_FOR_DELIVERY → **deliver** → assignment DELIVERED |
| completion | courier deliver auto-completes replacement `DISPATCHED → COMPLETED` (completedAt) in one tx |
| return detail | customer return read shows `replacement.status COMPLETED`, assignment `DELIVERED` + deliveredAt, `refund:null` |
| non-money | replacement has no Refund; original order stays DELIVERED / PAID (unchanged) |
| audit | courier steps recorded as `ReturnEvent` (ReturnActorType DELIVERY) on the same return trail |
| cleanup | E2E order/return/replacement/assignment/seller-payable rows deleted; 0 `replacement_assignments` remain |
| `git push origin main` | Session 22 feature + docs committed and pushed (see git log) |

## Session 29 — DELIVERY courier task console + enriched courier task surface (2026-09-08, `/home/user/rajrani-web`)

API on `:4600` (`PORT=4600 node dist/main.js`) against the same dev DB; console Vite dev server on `:5173`
proxying `/api` → `:4600`. Credentials: DELIVERY `delivery15@example.com`/`Delivery@123` (partner
`DLV-DEMO15` ACTIVE), OPERATOR `pfop@example.com`/`Operator@123`, SELLER `seller1@example.com`/`Seller@123`,
CUSTOMER `s12@example.com`/`Test@12345`.

| Command / check | Result |
|---|---|
| `npx tsc --noEmit -p tsconfig.json` (backend) | exit 0 (PASS) |
| `npm run build` (backend) | exit 0 (Nest build clean) |
| `npm run build` (`catalog-console/`) | exit 0 (vite build; 42 modules) |
| route mapping | running API logs show `{/api/v1/delivery/tasks/:assignmentId, GET}` mapped (DELIVERY) |
| DELIVERY `/delivery/tasks` (read surface, RBAC probe `/tmp/verify_courier.mjs`) | 200 (list); bogus detail id → 404; DELIVERY on `/delivery/assignments` + `/delivery/partners` → 403; OPERATOR admin lists 200 (partners `DLV-DEMO15`, assignments total 0); OPERATOR on `/delivery/tasks` → 403 |
| enriched slice detail | `GET /delivery/tasks/:assignmentId` returns orderNumber/paymentMethod/sellerName/sellerCode/items[] (productName/weight/sku/qty)/customer{name,phone,address} + events |
| replacement detail | `GET /delivery/replacement-tasks/:assignmentId` returns replacementReference/quantityTotal/customer (replacement surface already carried context) |
| cross-role detail | OPERATOR asks DELIVERY slice-task detail → 403; `fail` with empty body → 400 (reason required) |
| demo seed | `node scripts/seed-courier-demo.mjs` → created 2 throwaway PREPAID orders; slice parcel `DLVA-08BA1C54` ACCEPTED (order BK-MTS7EXB5), replacement `RDLA-996C06BF` ACCEPTED (RPL-MTS7EXQS-WGP3); both courier-accepted (visible) |
| console list via proxy | `GET /delivery/tasks` through `:5173/api/v1` → 1 parcel (ACCEPTED, orderNumber, itemCount 1, customer Kanpur); `/delivery/replacement-tasks` → 1 replacement (ACCEPTED, qty 1) |
| `git push origin main` | Session 28 + 29 committed & pushed (`9b07533`, `cde0845..9b07533 HEAD -> main`) |

Demo rows are intentionally left assigned+accepted (not delivered) so the courier console is populated for an
interactive demo; ids for targeted cleanup are in the SESSION-LOG Session 29 entry.

## Session 30 — pluggable courier-provider integration (tracking + POD) (2026-09-08, `/home/user/rajrani-web`)

Provider layer + migration + tracking/POD wiring; verified over BOTH the default sandbox provider and a
real-HTTP provider against a local courier-protocol mock. Money untouched (seller earn stays order-level).

| Command / check | Result |
|---|---|
| `npx prisma migrate deploy` | `20260908190000_courier_tracking` applied → **25 migrations** (carrier/trackingNumber/trackingUrl/podRef/podSignedBy/podAt on delivery + replacement assignments) |
| `npx tsc --noEmit -p tsconfig.json` | exit 0 (PASS) |
| `npm run build` | exit 0 (Nest build clean) |
| `npx jest` | **22 suites / 214 tests** pass (new `courier-provider.spec` 6 + delivery-service booking/POD 3) |
| sandbox live (API `:4600`, demo tasks) | pickup booked `SWB-…` (`Sandbox Courier`) on slice parcel + replacement, `SHIPMENT_BOOKED` event appended |
| courier-protocol mock | `scripts/courier-mock.mjs` (incremental) listening on `:9600`: `POST /v1/shipments`, `GET …/track`, `POST …/pod`, `/_state` |
| HTTP-provider live (`/tmp/s30_http_e2e.mjs`, API `:4700` with `COURIER_PROVIDER=http COURIER_BASE_URL=http://localhost:9600`, **8/8 ok**) | slice pickup books `MCK-F79C7047` (`Mock Courier`); replacement pickup books `MCK-84F6EF3E`; out-for-delivery → deliver captures `POD-MCK-84F6EF3E`; mock `/_state` + `/track` DELIVERED; DB shows replacement DELIVERED+POD+COMPLETED, slice parcel PICKED_UP w/ MCK waybill |
| non-money | no seller payable/Refund touched by the HTTP-courier steps (slice left PICKED_UP; replacement delivery is the non-money leg) |
| `git push origin main` | Session 30 increment pushed (see git log; `d2fb8b7` + follow-up) |

## Session 31 — 2026-09-08 (courier tracking-read surface, live)
Run from repo root after `npm run build`.

| Command | Result |
|---|---|
| `npm run typecheck` | exit 0 |
| `npm run build` | exit 0 (dist updated) |
| `npx jest` | **23 suites / 222 tests passed** (added `courier-tracking.service.spec.ts`, 8) |
| `git status` | new `src/commerce/courier-tracking.{service,controller}.ts` + spec; edited `commerce.module.ts`; storefront `api.js/styles.css/OrderView.jsx` |
| Live stack | courier-protocol mock `node scripts/courier-mock.mjs` (:9600); API `PORT=4700 COURIER_PROVIDER=http COURIER_BASE_URL=http://localhost:9600 COURIER_CARRIER='Mock Courier' COURIER_API_KEY=dummy-key node dist/main.js`; storefront `API_TARGET=http://localhost:4700 npm run dev` (:5180) |
| Mock seed | `POST /v1/shipments {ref:DLVA-08BA1C54,kind:parcel}` → `MCK-F79C7047`; `POST /v1/shipments {ref:RDLA-996C06BF,kind:replacement}` → `MCK-84F6EF3E`; `POST /v1/shipments/MCK-84F6EF3E/pod` → `POD-MCK-84F6EF3E` |
| Live E2E `/tmp/s31_tracking_e2e.mjs` | **14/14 ok**: owner `GET /orders/BK-MTS7EXB5/tracking` → parcel leg `DLVA-08BA1C54` PICKED_UP `MCK-F79C7047` with live provider `OUT_FOR_DELIVERY` (3 events, no podRef); owner `GET /orders/BK-MTS7EXII/tracking` → replacement leg `RDLA-996C06BF` DELIVERED `POD-MCK-84F6EF3E` with live provider `DELIVERED` (4 events); OPERATOR 200; non-owner CUSTOMER 404; DELIVERY role 403; unknown order 404 |
| Storefront proxy | `GET http://localhost:5180/api/v1/orders/<BK-MTS7EXB5>/tracking` (owner bearer) → `orderNumber BK-MTS7EXB5`, parcel `PICKED_UP MCK-F79C7047`, provider `OUT_FOR_DELIVERY` (200 through the Vite proxy) |
| `curl :5180/` | 200 (app HTML served) |
| Canonical API | restarted `:4600` (`node dist/main.js`, sandbox default) onto the S31 build → `Mapped {/api/v1/orders/:id/tracking, GET}` |
| Money invariant | tracking read only; no Refund / payable / ledger touched (DB state unchanged beyond the throwaway registered customer) |

## Session 32 — 2026-09-08 (courier delivery-fee payout / money leg)
Run from repo root after `npm run build`.

| Command | Result |
|---|---|
| migration | `prisma/migrations/20260908210000_courier_payout` applied + recorded; `courier_payouts` table + `CourierPayoutStatus` enum present; typecheck + build clean |
| `npx jest` | **24 suites / 233 tests passed** (added `courier-payout.service.spec.ts`, 11) |
| DI fix | `delivery.service` / `replacement-courier.service` now `@Optional() @Inject(CourierPayoutService)` (union `\| null` otherwise erased the class from `design:paramtypes`, so payouts never accrued) |
| Live E2E `/tmp/s32_payout_e2e.mjs` (sandbox API `:4600`, **18/18 ok**) | fresh PREPAID order shipped; slice courier assigned+accepted; pickup/out-for-delivery/**deliver** → parcel payout **EARNED ₹35** (`feeAmount:35,status:EARNED`); DELIVERY `GET /delivery/payouts` lists it + summary pending ≥35; OPERATOR `GET /delivery/payouts/all?status=EARNED` + `/summary` show it; RBAC: OPERATOR→DELIVERY route 403, DELIVERY→OPERATOR route 403 |
| Settle | OPERATOR `POST /delivery/payouts/settle {deliveryPartnerId}` → `{settled:1, totalAmount:35}`; courier view shows row **SETTLED** with `settledAt`, summary paid ≥35 & pending 0 for that leg |
| Money cleaned | `courier_payouts` = 0 after E2E cleanup; E2E orders (`BK-MTS934VE`, `BK-MTS93XIA`, `BK-MTS96F5C`, `BK-MTS9AHAS`) + their seller payables/assignments deleted; S29/S30 demo orders (`BK-MTS7EXB5`, `BK-MTS7EXII`) + their 1 payable / 1 slice assignment / replacement assignment left intact |
| Seller-earn invariant | order-level seller payable path unchanged; only new courier payouts accrue on delivery |
| `git push origin main` | Session 32 feature + docs committed and pushed (see git log) |

### Session 33 — baseline security hardening

Run from repo root after `npm run build`.

| Command | Result |
|---|---|
| `npm run typecheck` | clean |
| `npm run build` | clean |
| `npx jest` | **26 suites / 238 tests passed** (added `throttle.guard.spec.ts` + `security-headers.middleware.spec.ts`, +5) |
| Security headers (live `:4600`) | public catalog `GET` returns `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, `Cross-Origin-Opener-Policy: same-origin`, `X-XSS-Protection: 0`; **no** `X-Powered-By` |
| Rate limiting (live `:4600`) | `POST /auth/login` ×10 → `401`×8 then `429`×2 (limit 8/min); uniform 401s confirm no user enumeration |
| `git push origin main` | Session 33 feature + docs committed and pushed (see git log) |

### Session 34 — back-office Finance console

Run from repo root after `npm run build`.

| Command | Result |
|---|---|
| `catalog-console` `npm run build` | clean |
| Live E2E `scripts/e2e-finance.mjs` (sandbox API `:4600`, **32/32 ok**) | RBAC negatives (CUSTOMER/SELLER/DELIVERY → 403 on `/finance/*` + courier-payout staff routes); OPERATOR read shapes (reconciliation checked/discrepancyCount/ok, report perSeller+totals, payout summary currency+partners); throwaway money round-trip → courier parcel deliver **EARNED ₹35** + seller payable EARNED → payout summary lists partner pending → **settle** `{settled:1,totalAmount:35}` → row **SETTLED** (settledAt) → seller **settlement create** (PENDING) → illegal `PENDING→PAID` **409** → `PENDING→APPROVED` → appears in the list read; script **self-cleans** every row and asserts `cp=0,sp=0,st=0` |
| Console proxy `:5173` | OPERATOR login + `/finance/reconciliation/summary` + `/delivery/payouts/summary` read return the shapes the FinanceOps tab renders |
| `git push origin main` | Session 34 feature + docs committed and pushed (see git log) |

### Session 35 — DELIVERY-partner management console

Run from repo root after `npm run build`.

| Command | Result |
|---|---|
| `npm run typecheck` / `npm run build` | clean |
| `npx jest` | **26 suites / 239 tests passed** (added `listPartnerCandidates` unit case to `delivery.service.spec.ts`, +1) |
| `catalog-console` `npm run build` | clean |
| Live E2E `scripts/e2e-deliveryops.mjs` (sandbox API `:4600`, **22/22 ok**) | RBAC negatives (CUSTOMER/SELLER/DELIVERY → 403 on `/delivery/partners`, `/delivery/partner-candidates`, `/delivery/assignments`); throwaway DELIVERY-role user appears in candidates; `POST /delivery/partners` → **ACTIVE** auto `DLV-…` + vehicleType, then drops out of candidates; duplicate → **409**; **SUSPENDED → ACTIVE** toggle; appears in `/delivery/partners`; assignments list shape + per-partner filter isolation (fresh partner 0 / seeded resolves) + a detail row (number/status/sellerOrder/events); payout summary (INR + partners) + ledger shapes; script **self-cleans** the throwaway partner + DELIVERY user + customer and asserts the roster is back to the 1 seeded partner |
| `git push origin main` | Session 35 feature + docs committed and pushed (see git log) |

### Session 36 — courier tracking in the staff consoles (OPERATOR + DELIVERY)

Run from repo root after `npm run build`.

| Command | Result |
|---|---|
| `npm run typecheck` / `npm run build` | clean |
| `npx jest` | **26 suites / 243 tests passed** (added 4 `trackTaskForDelivery` cases to `courier-tracking.service.spec.ts`, +4) |
| `catalog-console` `npm run build` | clean |
| Live E2E `scripts/e2e-staff-tracking.mjs` (sandbox API `:4600`, **14/14 ok**, read-only) | RBAC 403s both ways (DELIVERY/SELLER on `/orders/:id/tracking`; OPERATOR/SELLER on the DELIVERY-only task-tracking routes); OPERATOR order-tracking returns legs with a parcel leg merging live provider events; DELIVERY parcel task-tracking (own `DLVA-…`) + replacement task-tracking (own `RDLA-…`) each return their leg with live provider events; DELIVERY on a bogus/foreign assignment → 404; partner roster asserted unchanged (no DB writes) |
| Console proxy `:5174` | HMR serving updated `CourierTasks.jsx` / `OperatorDashboard.jsx` / `TrackPanel.jsx` / `api.js` |
| `git push origin main` | Session 36 feature + docs committed and pushed (see git log) |

### Session 37 — period / date-range finance views (back-office)

Run from repo root after `npm run build`.

| Command | Result |
|---|---|
| `npm run typecheck` / `npm run build` | clean |
| `npx jest` (targeted affected suites) | `settlement.service.spec.ts` + `courier-payout.service.spec.ts` **38/38 passed** (added 3 window-shaping cases to settlement + 2 to courier, +5) |
| Full-suite note | `npx jest` in this sandbox is resource-heavy (individual suites take 40–210 s); after all suites that ran passed, the runner was OOM-killed before printing the final tally. No suite reported a failure — the two suites touched this session are green above |
| `catalog-console` `npm run build` | clean |
| Live verify `scripts/live-period-verify.mjs` (sandbox API `:4600`, read-only) | OPERATOR scoped `GET /finance/payables?from&to`, `/finance/settlements?from&to`, `/delivery/payouts/all?from&to`, `/delivery/payouts/summary?from&to`, `/finance/report/totals?from&to` all **200**; invalid dates on `from`/`to` across payables/settlements/courier-payouts each return **400**; date-only `to` treated inclusive end-of-day |
| Console | `FinanceOps.jsx` Period (From/To) bar `Apply`/`Clear` scopes every list + KPI (reconciliation stays global); served via HMR (`:5174`) |
| `git push origin main` | Session 37 feature + docs committed and pushed (see git log) |
