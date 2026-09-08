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
| Current session | Session 21 (pending owner-chosen next) |
| Current phase | Seller split-checkout + per-seller fulfilment gate + partial-fulfilment + seller payables/settlements + finance reconciliation & reporting + seller onboarding/KYC (orgs/applications/documents/review/activation/REVIEWER) + per-slice courier delivery (delivery_partners/assignments/events + DELIVERY role) + **return replacement/exchange vs refund with customer photo evidence upload** + **outbound replacement dispatch** (item-level returns) + **real Razorpay payment-gateway provider with LIVE refund execution (E2E vs a local Razorpay-protocol mock)** + **async gateway refund reconciliation (`refund.processed`/`refund.failed` → finalise PROCESSING refunds)** + **product listing/publishing (seller authors DRAFT → submits PENDING_REVIEW → OPERATOR/ADMIN approve → APPROVED+LIVE into the public catalog, or reject with a surfaced reason; immutable per-product status history)** all done; reviews, product reviews/ratings, and courier delivery of the dispatched replacement itself remain |
| Overall status | Backend (foundation, auth/RBAC, catalog, commerce cart/checkout/orders, buy-now + sandbox payments + COD OTP, fulfilment/delivery, returns/refunds incl. item-level with replacement/exchange resolution + evidence upload + outbound dispatch lifecycle, multi-seller split-checkout + seller-ops + per-seller fulfilment gate + partial-fulfilment resolution + seller payables/settlements + finance reconciliation/reporting with auto return-debit + seller onboarding/KYC with Organizations + OWNER members + REVIEWER + per-slice courier delivery with a DELIVERY role + a real Razorpay payment-gateway provider with live refund execution + async refund reconciliation + product listing/publishing state machine) on Prisma 7; all verified |
| Completed sessions | 00–04, upgrade pass, 05 (buy-now + payments + COD), 06 (fulfilment/delivery), 07 (returns/refunds), 08 (item-level returns + pickup/inspection lifecycle), 09 (seller orgs + split-checkout + seller-ops core), 10 (per-seller fulfilment gating + delivery markers), 11 (partial fulfilment resolution of rejected seller slices), 12 (seller payables & settlements), 13 (finance reconciliation + reporting), 14 (seller onboarding/KYC + Organizations + REVIEWER), 15 (per-slice courier delivery + DELIVERY role), 16 (return replacement vs refund + evidence upload), 17 (outbound replacement dispatch), 18 (real Razorpay gateway + live refund execution E2E), 19 (Razorpay async refund reconciliation: `refund.processed`/`refund.failed` webhooks finalise in-flight PROCESSING refunds), 20 (product listing/publishing: seller-authored DRAFT → PENDING_REVIEW → OPERATOR/ADMIN approve/reject with surfaced reason; APPROVED+LIVE publishes into the existing public catalog; product_status_history audit) |
| Next session | Product reviews/ratings, courier-delivering the dispatched replacement, real-seller product publishing to LIVE, or another owner-chosen priority |
| Active blockers | None local; Session 20 **pushed** to GitHub (`origin/main` = `7b78716`) |
| Known technical debt | See `COMPLETION-MATRIX.md`; `src/generated/` gitignored; payments select the gateway via `PAYMENT_GATEWAY_PROVIDER` (default **sandbox**, unchanged) — **Session 18 adds a real Razorpay provider** (`RazorpayGateway`, real REST over Node fetch, Basic auth, amount in paise, `RAZORPAY_KEY_ID`/`KEY_SECRET`/`WEBHOOK_SECRET`, `RAZORPAY_BASE_URL` override) behind a `PaymentGateway` interface, plus **live refund execution** in `ReturnsService.completeRefund` that actually calls the gateway refund API and records the real `gatewayRef`/provider on the Refund + a `RefundTransaction` (replacing the hardcoded sandbox seq). E2E is verified against a **local Razorpay-protocol HTTP mock** (`scripts/razorpay-mock.mjs`) speaking the real wire protocol; flipping to real Razorpay only needs env base-URL/keys (no code change). Roles: OPERATOR/ADMIN run fulfilment/returns/finance; REVIEWER (onboarding/KYC only); DELIVERY (courier tasks only); SELLER accepts/rejects slices, reads own payables/settlements and runs own onboarding. Per-slice courier delivery (Session 15) is a real delivery_assignments model + DELIVERY role but **rides the order-level DELIVERED money trigger** (owner decision): a courier finalizing the last slice earns the accepted slices' payables exactly as before — per-slice earn is intentionally NOT used; real courier-provider integration/tracking/POD and per-slice payout are future work. Seller payables auto-earn at order DELIVERED (commission = per-seller `commissionRateBps`; Bilokat 0, partner 10%); payables/settlement DB-authoritative; completed refunds auto-debit returned goods' net off the EARNED payable (net-zero rule) as SYSTEM `seller_payable_adjustment` (in/after-settlement payables untouched, surfaced by reconciliation). Return replacement/exchange (Session 16) is offered as a terminal `REPLACEMENT_ISSUED` resolution on the item-level returns flow (no Refund, no seller payable auto-debit — the refund/auto-debit money logic is kept intact for REFUND-resolution requests); evidence upload (customer + operator) stores an object reference only. **Outbound replacement dispatch (Session 17)** drives the `ReplacementStatus` lifecycle `PENDING_DISPATCH → DISPATCHED → COMPLETED | CANCELLED` via OPERATOR/ADMIN endpoints, each step audited via a per-request `ReturnEvent` (REPLACEMENT_DISPATCHED/COMPLETED/CANCELLED) with dispatch reference/note/cancel reason persisted; it is a **non-money** leg (no ledger, no seller debit). Couriers are not yet assigned to a dispatched replacement (still an OPERATOR action). No real payout execution or product-listing/publishing. Reconciliation read-only. |
| Last verification | typecheck/build OK; `npm test` **181 passing (19 suites)** (Session 20 added `src/publishing`); **22 migrations applied** (`migrate status` up to date). Live Session 20 E2E (`scripts/e2e-publishing.mjs` on a fresh `:4300` sandbox-provider API, **13/13 ok**): `seller1@example.com` (SELLER, ACTIVE `seller-legacy`) authored a product DRAFT (HIDDEN) → it appears in the seller's own `GET /seller/catalog` → `POST …/submit` → PENDING_REVIEW → `pfop@example.com` (OPERATOR) sees it in `GET /catalog-publishing/products?status=PENDING_REVIEW` → **approve** → `APPROVED` + `visibility LIVE` + `publishedAt`, now publicly resolvable by slug via `GET /catalog/products/:identifier` (200); a second product went the **reject** path (`REJECTED` + `HIDDEN`, reason `price below floor`) → surfaced in the seller's product detail (`reviewNote`) and **not** publicly resolvable (404). RBAC: CUSTOMER denied both the OPERATOR review surface and the seller authoring surface (403). DB audit for the approved product: `product_status_history` rows `DRAFT→PENDING_REVIEW→APPROVED` with `actorRole` SELLER/OPERATOR + reasons. Prior Session 14–19 E2E remain valid. Session 19 async reconciliation (`refund.processed`/`refund.failed`) on `:4100`/`:3912` and Session 18 razorpay live refund on `:4000`/`:3911` were left running (2026-09-08). |
| Repository health | pushed to GitHub (`main` up to `7b78716`, Session 19); no committed secrets |

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
  - Session 14: **Seller onboarding/KYC + Organizations + REVIEWER role**
    (owner decision: full additive org model; application origin = BOTH self-service
    and operator-managed; onboarding approval state machine on Seller). Schema/migration
    `20260908100000_orgs_onboarding_kyc`: adds `Organization`/`OrganizationMember`
    (a SELLER-type org per seller; seller operator bound as an OWNER member), expands
    `SellerStatus` to `REGISTERED/PENDING/UNDER_REVIEW/APPROVED/REJECTED` (retaining
    `ACTIVE/SUSPENDED/DEACTIVATED`), adds `Seller.organizationId` + `activatedAt`, and
    tables `seller_applications` / `seller_documents` / `seller_reviews` /
    `seller_status_history`. `Seller.operators` (via `users.sellerId`) is retained as a
    denormalized convenience so all prior commerce code is untouched. New `REVIEWER`
    role (onboarding-only). Public `POST /auth/seller-register` (self-service): creates
    the SELLER org + a PENDING seller + a DRAFT application + an OWNER member, returns
    tokens. New `src/seller/` module + controllers: owner surface
    `/seller/onboarding/{me,profile,documents,submit}` (SELLER, bound to own seller;
    document uploads are **storage-intent only**, no object store), staff
    `/seller-onboarding/*` — `sellers` POST (OPERATOR/ADMIN create ACTIVE seller),
    `applications` list/detail/review (REVIEWER/ADMIN), `documents/:id/verify`
    (REVIEWER/ADMIN), `sellers/:id/activate` (REVIEWER/ADMIN/OPERATOR, APPROVED→ACTIVE),
    `sellers/:id/status` (OPERATOR/ADMIN operational). REVIEWER is denied
    finance/fulfilment/returns/seller-order/op-create routes; owner editing is blocked
    once ACTIVE; every status transition is audited in `seller_status_history`. Seed
    backfills sellers→orgs + OWNER membership.
  - Session 20: **Product listing/publishing** (owner-chosen next). A **SELLER**
    bound to an ACTIVE seller org (strictly `Product.sellerId`-scoped via a
    `requireSeller` that enforces SELLER role + `User.sellerId` + ACTIVE seller)
    authors a product **DRAFT** (`POST /seller/catalog`, slug auto-deduped) with
    catalog fields (name/slug/tagline/description/category[ACTIVE]/brand/
    `regionOrigin`/basePrice/originalPrice(MRP)/weightLabel/spiceLevel/ingredients/
    nutritional/pairingSuggestion/isBestseller/isNew/stockOnHand/stockStatus + media)
    in an active Category; edits a DRAFT/REJECTED (`PATCH`), submits it to
    **PENDING_REVIEW** (`POST …/submit`), lists/reads only its own products
    (`GET /seller/catalog` + `/:id`), and archives non-published ones. Nothing goes
    live without **OPERATOR/ADMIN** staff approval on a distinct review surface
    (`/catalog-publishing/products`, `@Roles(OPERATOR, ADMIN)`): approve →
    `APPROVED` + `visibility LIVE` + `publishedAt` → visible on the existing **public
    catalog** (whose filter stays `APPROVED`+`LIVE`+not-deleted — Session 20 only
    feeds it); reject → `REJECTED` + `HIDDEN` + mandatory reason surfaced to the
    seller (`reviewNote`); a REJECTED product may be edited + resubmitted → PENDING_REVIEW
    again. Every transition is written to an immutable **`product_status_history`**
    audit (actor role, from→to status, reason, time). Migration
    `20260908175000_product_publishing` (new `reviewNote` column on products +
    `product_status_history` table, productStatusHistory relation). Distinct routes
    mapped in `RouterExplorer` for `seller/catalog` (SELLER) and
    `catalog-publishing/products` (OPERATOR/ADMIN).

### Absent (per spec) / deferred
- Seller onboarding/KYC + orgs (applications/documents/reviews/status-history +
  Organization/OrganizationMember + REVIEWER role) now **implemented** (Session 14).
  Still absent: per-slice shipment/delivery model or courier handoff, auto-cancel-all
  or reassign/retry, product reviews/ratings, real delivery-courier
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
  operator flows (`OPERATOR`/`ADMIN`); a SELLER role can accept/reject its slices,
  read its own payables/settlements, and complete its own onboarding/KYC (Session 14);
  a separate `REVIEWER` handles KYC. No dedicated finance/courier role or real courier
  handoff yet.
- Returns now support both a **refund** resolution and a **replacement (exchange)**
  resolution with customer photo evidence upload (Session 16): a customer picks
  `REFUND` (default) or `REPLACEMENT`; a REPLACEMENT request is `evidenceRequired`,
  and when inspection completes it goes terminal `REPLACEMENT_ISSUED` with a
  `replacement` (PENDING_DISPATCH) row and **no Refund / no seller-payable auto-debit**
  (money logic kept intact for REFUND requests). Session 17 finishes the outbound leg:
  OPERATOR drives `replacement` `PENDING_DISPATCH → DISPATCHED → COMPLETED | CANCELLED`
  (dispatch ref/note, cancel reason, all audited via `ReturnEvent`). Item-level partial
  returns, pickup scheduling, per-line inspection, and the `return_evidence`/
  `return_items`/`return_events`/`return_inspections`/`replacements`/`refund_transactions`
  records are modelled and working (Sessions 08 + 16 + 17).
- No ABAC/organization/tenant isolation, step-up auth (deferred to later auth work).
- No `customer-web` full application (multi-page with account, orders, etc.).
- No `seller-web`, `catalog-publishing-web`, `support-web`, `delivery-web`,
  `finance-web`, `control-web`, `analytics-web` applications.
- No Redis-backed caching/jobs, no event bus / outbox yet.
- Session 18 adds a real **Razorpay** payment-gateway provider (real REST over the
  Razorpay wire protocol via Node fetch, selectable with `PAYMENT_GATEWAY_PROVIDER`,
  default stays sandbox) with **live refund execution**, E2E-verified against a local
  Razorpay-protocol mock; live external Razorpay is a config flip (env base-URL/keys)
  only. No COD cash-collection at delivery, no settlement payout execution, no AI,
  no analytics, no courier-provider integration beyond the in-app DELIVERY role.
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
