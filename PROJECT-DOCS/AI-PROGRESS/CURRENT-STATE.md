# CURRENT-STATE — BILOKAT

> Authoritative AI snapshot. Update at the end of every session.
> Never mark anything COMPLETE without verification evidence.

| Field | Value |
|---|---|
| Project | BILOKAT — Multi-Seller Marketplace Platform |
| Canonical repo | `Rajraninamkeen/rajrani-web` (all work lives here; owner decision) |
| Remote | `origin https://github.com/Rajraninamkeen/rajrani-web.git` |
| Branch | `main` |
| Layout | `PROJECT-DOCS/` (specs + AI-PROGRESS) · `landing-page/` (frontend prototype) · backend at repo root (`src/`, `prisma/`) |
| Stack (final) | **NestJS 11.2.3 + TypeScript 5.9.3 + Prisma ORM 7.10.0** (driver adapter, prisma.config.ts) + PostgreSQL 17 |
| Current session | Session 13 — Finance reconciliation + reporting (auto return-debit) |
| Current phase | Seller split-checkout + per-seller fulfilment gate + partial-fulfilment + seller payables/settlements + finance reconciliation & reporting (incl. automatic return-debit of earned seller payables) done; seller onboarding/KYC, per-slice delivery/replacement, reviews remain |
| Overall status | Backend (foundation, auth/RBAC, catalog, commerce cart/checkout/orders, buy-now + sandbox payments + COD OTP, fulfilment/delivery, returns/refunds incl. item-level, multi-seller split-checkout + seller-ops + per-seller fulfilment gate + partial-fulfilment resolution + seller payables/settlements + finance reconciliation/reporting with auto return-debit) on Prisma 7; all verified |
| Completed sessions | 00–04, upgrade pass, 05 (buy-now + payments + COD), 06 (fulfilment/delivery), 07 (returns/refunds), 08 (item-level returns + pickup/inspection lifecycle), 09 (seller orgs + split-checkout + seller-ops core), 10 (per-seller fulfilment gating + delivery markers), 11 (partial fulfilment resolution of rejected seller slices), 12 (seller payables & settlements), 13 (finance reconciliation + reporting) |
| Next session | Seller onboarding/KYC + orgs, per-slice delivery/courier handoff, replacement vs refund, reviews, or real payment-gateway provider |
| Active blockers | Owner to rotate GitHub token before next push; keep `rajrani-web` canonical |
| Known technical debt | See `COMPLETION-MATRIX.md`; `src/generated/` gitignored; payments use the built-in **sandbox** gateway (pluggable provider) — real gateway + real refund execution deferred. Fulfilment/returns/finance gated behind `OPERATOR`/`ADMIN`; SELLER role can accept/reject slices and read own payables/settlements (no onboarding/KYC). Seller payables auto-earn at DELIVERED (commission = per-seller `commissionRateBps`; Bilokat 0, partner 10%); payables/settlement are DB-authoritative (settlement/adjustment audited); a completed customer refund auto-debits the returned goods' net earnings from the delivered slice's EARNED payable (owner rule: net-zero on full return) as a SYSTEM `seller_payable_adjustment` (a payable already in/after a settlement is intentionally not auto-debited and is surfaced by reconciliation). No real payout execution (Settlement PAID is a sandbox ledger mark), seller onboarding/KYC, replacement vs refund, evidence upload, per-slice delivery/courier handoff not implemented. Reconciliation is read-only and reports rather than auto-fixes discrepancies. |
| Last verification | typecheck/build OK; `npm test` 110 passing (13 suites); migrate deploy clean (14); live finance E2E on `:4000` (Session 13): customer full item return on delivered Bilokat slice of `BK-MTRWFK4Z` (₹189 EARNED payable `cmtrwfv3…`) → operator approve→pickup→picked-up→inspection PASS→initiate `RFD-MTRX0MTT-PB39` ₹217.43→complete → **payable auto-debited ₹189 → net ₹0** with audited SYSTEM `-189` adjustment (`actorId` = returnRequestId, reason references return + refund); `GET /finance/reconciliation/summary` returns the reconciliation (correctly flags only the one **pre-existing** historical `delivered_slice_missing_payable` in the pre-settlement E2E order `cmtrvm3r9…`, not from the auto-debit); `GET /finance/report/totals` per-seller + grand totals (Bilokat goods ₹567, refund ₹189, adj ₹−189, net ₹378; Rajrani adj ₹−10, net ₹259.10; grand net ₹637.10); `?sellerId=` + `?from/`?to=` filters work; CUSTOMER → 403 / no token → 401 on finance endpoints; seller self-service `/seller/payables` scoped to own org (2026-09-08) |
| Repository health | pushed to GitHub (`main`); no committed secrets |

> ## IMPORTANT PRODUCT DECISION (owner)
> **`landing-page/` is a PROTOTYPE / UX reference only — NOT an exact pixel spec.**
> It shows the *feel* of user interactions and checkout the owner wants. It is
> NOT a strict "make it exactly this." Future customer experience should be
> enriched/built properly per the PROJECT-DOCS specs and later requirements, not
> slavishly copied from the prototype. The backend/DB remains the source of truth.

---

## What exists vs. what the specs require

The repository today is a **documentation + prototype container**, not the final
multi-app platform.

### Present
- `PROJECT-DOCS/` — all 13 specification documents + AI-PROGRESS control files.
- `landing-page/` — a **static single-page React marketing prototype** named
  "Bilokat" (namkeen/snacks D2C). All data is hardcoded. No API / backend calls.
- Backend (`src/`, `prisma/`) — NestJS + Prisma:
  - Session 01: config, health, envelope, request-id, Identity + Catalog data
    model + 3 migrations.
  - Session 02: **Auth + RBAC foundation** — register/login/logout/me,
    refresh-token rotation + reuse detection, `user_sessions` registry,
    JwtAuthGuard + RolesGuard, `@Roles`/`@CurrentUserId` decorators.
    Auth API live under `/api/v1/auth`.
  - Session 03: **Catalog API** (public) under `/api/v1/catalog` — categories,
    product list (filters: category/bestseller/new/search/price, sort, pagination),
    product detail by id/slug. Seed populates 5 categories + 8 products mirroring
    the landing-page catalog. Product schema gained display fields
    (originalPrice, weightLabel, ratingAvg, reviewCount, pairingSuggestion,
    customerFavTag). Migration `20260907120621_product_catalog_display_fields`.
  - Session 04: **Commerce — cart, checkout, orders** (server-authoritative):
    guest + authenticated carts with merge-on-login (`OptionalJwtAuthGuard` +
    `x-guest-session-id`), cart add/update/remove/clear under `/api/v1/cart`;
    checkout quote/preview that always re-derives price from DB product
    `basePrice` + asserts stock; transactional order placement (stock reserve via
    atomic decrement, coupon validate+usage++, address snapshot, order items,
    status history, cart → CONVERTED); list/get/cancel orders (cancel restores
    stock). Dev coupons seeded (`BILOKAT20`, `FLAT50`, `SAVE10`). Commerce tables
    via 2 migrations (`commerce_models`, `cart_status_merged`).
  - Session 05: **Buy-now + payments (COD & online intent/capture)**:
    `POST /buy-now` (direct no-cart order, same server-authoritative pricing);
    provider-agnostic `Payment` intent (`payments`/`payment_transactions`/
    `payment_webhooks`) created for PREPAID orders; signed **sandbox gateway**
    webhook `POST /payments/webhook/sandbox` (HMAC signature, idempotent via
    UNIQUE(provider, provider_event_id), amount match, capture → order `PAID`,
    transaction ledger, audit webhook log); COD secondary-mobile **OTP** flow
    (`/orders/:id/cod` otp/verify — only the OTP hash is stored, expires, attempt
    cap → REJECTED). Migration `payment_cod_models`.
  - Session 06: **Fulfilment/delivery state machine**: operator-only
    `POST /orders/:id/fulfilment/advance` (`@Roles(OPERATOR, ADMIN)` — customers
    cannot self-set delivery). Advance transitions PLACED→CONFIRMED→PACKED→SHIPPED→
    OUT_FOR_DELIVERY→DELIVERED with a confirmation gate (PREPAID must be PAID; COD
    must have passed OTP verification), legal-transition map + concurrency-safe
    guarded `updateMany(where status)`, an audited `order_status_history` row per
    transition (actor CONTROL + operator id + reason), and on DELIVERED sets
    `deliveredAt` + flips COD `COD_PENDING`→`COD_PAID` (cash collected at door).
    Customer timeline `GET /orders/:id/history`.
  - Sessions 07→08: **Returns & refunds** (DB-Design §§85-92). Session 07 built a
    whole-order flow (order → RETURN_REQUESTED/RETURNED/REFUND_PENDING/REFUNDED,
    `payment_transactions` REFUND); Session 08 **reworked it to item-level + full
    lifecycle** (the whole-order flow was superseded, not kept in parallel):
    customer `POST|GET /orders/:id/returns` now selects specific order items +
    quantities (customer order items expose `orderItemId`); proportional refund
    allocation by line value (full return of every line sums exactly to grand
    total). Lifecycle: request → operator decision (approve/reject, rejection
    reason mandatory) → schedulePickup → pickedUp → per-line inspection
    (PASS / PARTIAL_PASS 50% / FAIL 0, `return_inspections`) → auto
    `APPROVED_FOR_REFUND` (server-amounted per-item refund) → initiate refund
    (`GATEWAY` for PREPAID / `COD` for cash; never exceeds grand across partials)
    → sandbox complete → ReturnRequest `COMPLETED` + `refund_transactions` ledger
    + order only goes `REFUNDED`/`paymentStatus REFUNDED` once the aggregate of
    refunds covers the whole grand total (partial returns keep order `DELIVERED`).
    `return_events` record every step (customer + operator actors). Requests/
    decisions are operator-gated (`@Roles(OPERATOR,ADMIN)`).
  - Session 09: **Seller orgs + multi-seller catalog + split-checkout core**
    (scope "B", owner-selected). Schema/migration
    `20260907142140_seller_split_checkout`: `Seller` (sellers) + `SellerStatus`,
    `Product.sellerId` (required; seeded 2 sellers — Bilokat legacy + Rajrani
    partner; migration backfills existing products/orders under the legacy seller),
    `SellerOrder` (seller_orders) + `SellerOrderStatus`, `OrderItem.sellerOrderId`
    + `sellerNameSnapshot`, `User.sellerId` (SELLER-role operator binding). Order
    capture (`checkout` + `buy-now`) now splits each order into one `SellerOrder`
    per seller: the customer `Order` stays the single authoritative money/payment/
    refund entity, and each seller_order carries that seller's real subtotal plus a
    proportional share of order tax/discount/delivery/grand allocated by line-value,
    with the last seller absorbing rounding so **Σ seller_order.grandTotal ===
    order.grandTotal exactly**. Every order item now belongs to a seller_order and
    carries a seller-name snapshot. `Seller-ops` surface (`@Roles(SELLER)`,
    scoped to the caller's seller via `User.sellerId`): `/seller/me`,
    `/seller/products` (own catalog), `/seller/orders` (+ `/…/:id`) list the
    seller's slices with order context, and `accept`/`reject` (reason mandatory)
    drive the seller_order lifecycle PLACED→ACCEPTED/REJECTED. Order cancellation
    cascades open seller_orders → CANCELLED. Returns/refunds/fulfilment keep
    working on the order/orderItem level unchanged.
  - Session 10: **Per-seller fulfilment gating + delivery markers**. Migration
    `20260907143713_seller_fulfilment_markers` adds `shippedAt`/`deliveredAt` to
    seller_orders. The operator `fulfilment/advance` now enforces a per-seller
    **acceptance gate**: before an order may reach SHIPPED / OUT_FOR_DELIVERY /
    DELIVERED, every non-cancelled seller slice must be `ACCEPTED` — a still-`PLACED`
    or `REJECTED` slice blocks shipping and the error names the blockers. When the
    order is SHIPPED / DELIVERED the service stamps `shippedAt`/`deliveredAt` on the
    accepted slices (order-level delivery covers accepted slices together). New
    fields exposed on the order view and the seller-ops order projections.
    Returns/refunds/order-level money unchanged.
  - Session 11: **Partial fulfilment resolution of rejected seller slices**
    (owner-selected rule for a seller slice rejected before shipping: cancel the
    slice, let the remaining accepted sellers ship together as one order-level
    delivery, and for PREPAID refund the buyer that slice's share). Migration
    `20260907232834_partial_fulfilment_resolution` adds nullable
    `refunds.sellerOrderId` (FK → seller_orders) + index, makes
    `refunds.returnRequestId` nullable, and adds `seller_orders.cancelledAt` +
    `cancellationReason`. New OPERATOR/ADMIN endpoint
    `POST /orders/:id/slices/:sellerOrderId/resolve-reject` → `OrderService.
    resolveRejectedSlice`: in one transaction it requires the order status
    PLACED/CONFIRMED/PACKED (pre-shipment) and the slice `REJECTED`; for PREPAID it
    requires `paymentStatus=PAID`; then marks the slice `CANCELLED` (with
    cancelledAt + reason), releases that slice's items' stock only, and for PREPAID
    records one **COMPLETED** `Refund` (method GATEWAY, sandbox gatewayRef + SUCCESS
    `RefundTransaction`) for the slice's `grandTotal`, guarding cumulative refunds
    against the order grand total; an `order_status_history` CONTROL row records the
    resolution. `cancelOrder` is hardened so it never double-releases stock for an
    already-CANCELLED slice. The remaining ACCEPTED slices then pass the Session 10
    gate and ship/deliver together; a REJECTED/unresolved slice still blocks
    shipping. New projection fields expose `cancelledAt`/`cancellationReason` per
    slice.
  - Session 12: **Seller payables & settlements** (finance/settlement loop; owner
    chose rule "seller earns goods value minus commission", per-seller
    `commissionRateBps`, auto-earn at delivery). Migration
    `20260907234906_seller_payables_settlements` adds `Seller.commissionRateBps`
    (Bilokat 0, partner Rajrani 1000 bps = 10%) plus `seller_payables`,
    `seller_payable_adjustments`, `settlements`, `settlement_items`,
    `settlement_events` (14 migrations total). When an order reaches DELIVERED the
    fulfilment service atomically earns one **SellerPayable** per ACCEPTED slice
    (a Session-11 CANCELLED/REJECTED slice earns nothing): seller pays =
    `goodsValue(=subtotal−discount)` − commission; Bilokat retains tax + delivery,
    so net + commission + tax + delivery == slice grandTotal exactly. Money
    rounding is paise-safe. Operator/ADMIN finance surface `/api/v1/finance`
    (payables list/detail, add a signed audited **adjustment** to an EARNED
    payable, settlements list/detail/create, settlement `advance` through
    PENDING→APPROVED→PROCESSING→PAID→RECONCILED with PROCESSING→FAILED→retry);
    each payable can sit in only one settlement (unique `sellerPayableId`), and
    PAID marks its payables SETTLED. Seller-facing reads expose their own
    payables/settlements under `/seller`. Every step is audited via
    `settlement_events`/`seller_payable_adjustments`; no financial value is
    rewritten.

### Absent (per spec) / deferred
- No seller onboarding/KYC (applications/documents/status-history) or
  org/organization_members, no per-slice shipment/delivery model or courier
  handoff, no auto-cancel-all or reassign/retry, no reviews, no real payment-gateway
  provider (razorpay/stripe) with live refund execution, no real delivery-courier
  integration, and no **real payout execution** (a settlement reaching PAID is a
  sandbox-marked ledger state; the external transfer is out of scope). Seller
  payables/settlements now exist as a DB-authoritative ledger (Session 12), and a
  completed customer refund auto-debits the returned goods' net earnings off the
  delivered slice's **EARNED** payable (Session 13, net-zero rule) as a SYSTEM
  `seller_payable_adjustment`; a payable already in/after a settlement is never
  auto-debited (surfaced by reconciliation instead), and `seller_amount`
  on seller_order remains a legacy gross-basis column (seller_payables is the
  authoritative settlement basis). Pre-shipment rejected-slice resolution path
  (Session 11 OPERATOR resolve-reject → CANCELLED + partial refund) still exists.
- Split-checkout core (multi-seller seller_orders + seller accept/reject + money
  reconciliation) is done (Session 09); seller_orders gate the order as follows
  (Sessions 10–12): operator shipping requires every non-cancelled seller slice to
  be ACCEPTED (blocked by PLACED/REJECTED), per-seller shippedAt/deliveredAt markers
  are stamped at order SHIPPED/DELIVERED, an OPERATOR can resolve a REJECTED slice
  to CANCELLED (partial-fulfilment cancel + PREPAID refund) so the remaining ACCEPTED
  slices ship together, and at DELIVERED each accepted slice auto-earns its seller
  payable (cancelled slices earn nothing) which OPERATOR rolls into settlements.
- Fulfilment/delivery/returns/refunds/payables/settlements exist as internal
  operator flows (`OPERATOR`/`ADMIN`); a SELLER role can accept/reject its slices
  and read its own payables/settlements; no dedicated finance/courier role or real
  courier handoff yet.
- Return **replacement** (exchange) vs refund is not yet offered; no customer
  photo/evidence upload for returns yet (inspection is textual PASS/FAIL only).
  Item-level partial returns, pickup scheduling, per-line inspection and the
  `return_items`/`return_events`/`return_inspections`/`refund_transactions`
  ledger are all modelled and working (Session 08).
- No ABAC/organization/tenant isolation, step-up auth (deferred to later auth work).
- No `customer-web` full application (multi-page with account, orders, etc.).
- No `seller-web`, `catalog-publishing-web`, `support-web`, `delivery-web`,
  `finance-web`, `control-web`, `analytics-web` applications.
- No Redis-backed caching/jobs, no event bus / outbox yet.
- No real payment-gateway integration (sandbox gateway + pluggable interface
  implemented), no COD cash-collection at delivery, no returns/refunds,
  settlements, AI, analytics, or audit beyond payment webhook logging.
- No integration/E2E/security tests yet (only backend unit tests exist).
- No CI/CD, no Docker runtime available in sandbox (docker-compose file is
  written; Postgres 17 + Redis used locally).

---

## Document priority (when specs conflict)
Per `00-MASTER-SPEC.md` §Document priority:
1. Explicit latest project decision
2. `00-MASTER-SPEC.md`
3. `01-ARCHITECTURE.md`
4. `02-BUSINESS-WORKFLOWS.md`
5. Database / API / Security specs
6. Feature-specific specs
7. Existing implementation

Existing code is **not** automatically correct.
