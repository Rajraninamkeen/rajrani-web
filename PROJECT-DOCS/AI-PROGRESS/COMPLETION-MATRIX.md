# COMPLETION-MATRIX — BILOKAT

> Status legend:
> `NOT_STARTED` `DISCOVERED` `IN_PROGRESS` `PARTIALLY_COMPLETE` `BLOCKED`
> `COMPLETE` `VERIFIED`
>
> A workflow is only COMPLETE after: Implementation + Integration + Validation +
> Tests + Type Check + Build + Security Verification + Edge Case Verification +
> Documentation.

## Session / Workstream matrix

> Cross-cutting: Prisma 6→7.10 (stable) completed as a tech-upgrade pass
> (NestJS stays 11, TS stays 5.9) — see SESSION-LOG. `landing-page/` is a
> PROTOTYPE/UX reference, not an exact spec (owner).

| # | Session | Status | Notes |
|---|---|---|---|
| 00 | Project Initialization | COMPLETE | Repo/docs inspected, security audited, AI-PROGRESS created |
| 01 | Backend Foundation | PARTIALLY_COMPLETE | `bilokat-api` scaffolded (NestJS+Prisma): config, PostgreSQL wiring + 2 migrations, health, response/error envelope, request-id, Identity+Catalog data model, unit tests — typecheck/build/migrate/tests all PASS. Remaining: feature modules in later sessions |
| 02 | Authentication + Authorization | PARTIALLY_COMPLETE | Auth+RBAC foundation done (register/login/logout/me, JWT + rotating refresh in DB sessions, JwtAuthGuard, RolesGuard, @Roles/@CurrentUserId). ABAC/org/tenant/step-up deferred. Live API + unit tests passing |
| 03 | Seller Onboarding | PARTIALLY_COMPLETE | **Session 14**: backend onboarding/KYC + full additive Organization/OrganizationMember model + OWNER memberships + `REVIEWER` role + lifecycle (PENDING→UNDER_REVIEW→APPROVED→ACTIVE, correction loop, audit history) live under `/seller/onboarding` (owner) + `/seller-onboarding` (staff), plus public `POST /auth/seller-register`; document uploads are storage-intent only. Remaining: seller-web application and the seller-product-listing + catalog-publishing approval UIs (the backend listing/publishing lifecycle itself is Session 20; see Catalog Publishing row). (Catalog API built early out-of-order to serve landing page; see Catalog row.) |
| 04 | Catalog | PARTIALLY_COMPLETE | Public catalog read API live (/api/v1/catalog: categories, products w/ filters, detail) + seed (5 cats/8 prods) + display-field migration + tests. **Session 21** adds `GET /catalog/products/:identifier/reviews` (PUBLISHED-only, paginated) and now derives `ratingAvg`/`reviewCount` from PUBLISHED reviews (a product with none keeps its seeded marketing summary until the first approved review). Attribute/variant/media admin mgmt & publishing UI deferred |
| 05 | Catalog Publishing | PARTIALLY_COMPLETE | **Session 20** backend lifecycle live: SELLER authors a product DRAFT under `/seller/catalog` (create/edit/archive/submit, strictly own-seller scoped, active-category + auto-slug), staff review under `/catalog-publishing/products` (OPERATOR/ADMIN): approve → `APPROVED`+`visibility LIVE`+`publishedAt` (feeds the existing public catalog filter untouched); reject → `REJECTED`+`HIDDEN` with a surfaced reason; each transition audited in `product_status_history`; REJECTED products may be edited+resubmitted → PENDING_REVIEW again. E2E-verified (13/13). Remaining: `catalog-publishing-web` application UI (and full media/variant/attribute admin mgmt beyond the seller-provided media list) |
| 06 | Seller Platform | NOT_STARTED | seller apps for products/orders/inventory/returns |
| 07 | Customer Commerce | PARTIALLY_COMPLETE | cart (guest+auth, merge-on-login), checkout quote, order place/list/cancel/history-timeline, coupons, buy-now done (server-authoritative, verified live). **Session 21** adds verified-buyer **product reviews/ratings** (customer `POST /reviews` PENDING + `/reviews/me|:id` PATCH/DELETE; OPERATOR/ADMIN moderate under `/product-reviews`; PUBLISHED-only public read). Remaining: discovery, multi-seller split-cart, review/rating storefront UI |
| 08 | Payment + COD | VERIFIED | provider-agnostic Payment intent + gateway capture (signature+idempotency), payment ledger/webhook audit, buy-now, COD OTP verification, COD cash-collection at delivery (COD_PAID flip), refund ledger (payment_transactions REFUND) — verified live. **Session 18** adds a **real Razorpay gateway** behind the pluggable `PaymentGateway` seam (`PAYMENT_GATEWAY_PROVIDER`, default **sandbox** unchanged): real REST `POST /v1/orders` + raw-body-HMAC webhook verify + real `POST /v1/payments/:id/refund` refund execution (real `rfnd_…` gatewayRef persisted on the Refund + a `refund_transactions` SUCCESS row), E2E-verified against a **local Razorpay-protocol mock**; flipping to live Razorpay is env base-url/keys only (no code change). **Session 19** adds **async refund reconciliation** — a gateway refund left in-flight (Refund `PROCESSING`) is later finalised by `ReturnsService.reconcileRefundFromEvent` on a signed `refund.processed` webhook (`refund.failed` → Refund FAILED, request stays open for retry). COD path unchanged |
| 09 | Fulfillment + Delivery | PARTIALLY_COMPLETE | internal operator advance workflow (CONFIRMED→PACKED→SHIPPED→OUT_FOR_DELIVERY→DELIVERED, guarded + audited, deliveredAt + COD_PAID on delivery) verified live. **Session 15** adds the per-slice courier layer: `delivery_partners`/`delivery_assignments`/`delivery_events` + a dedicated **DELIVERY** role with its own `/delivery/tasks` surface (accept/reject/pickup/out-for-delivery/deliver/fail) driving per-slice `deliveredAt`, and the courier finalizes the order to DELIVERED on the last slice (money trigger unchanged). Sessions 30-32 added the pluggable courier-provider seam (tracking/POD), a customer/operator tracking-read surface, and the courier delivery-fee payout (money leg). Remaining: real courier-provider live credentials, delivery pricing/zone |
| 10 | Returns + Support | VERIFIED (return money/refund now REAL-gateway-executed per Session 18; see note) | whole-order returns + refunds backend verified live + tests. **Session 08**: item-level partial returns, pickup scheduling, per-line inspection (PASS/PARTIAL_PASS/FAIL → policy-rate refund amounts), `return_items`/`return_inspections`, full-return → order REFUNDED. **Session 16**: **replacement (exchange) vs refund** + **evidence upload** — a return request carries a `resolution` (REFUND default | REPLACEMENT); REPLACEMENT requests are `evidenceRequired` and accept customer/operator photo evidence (`return_evidence`, storage-intent), and on completed inspection go **terminal `REPLACEMENT_ISSUED`** with a `replacement` row (PENDING_DISPATCH) and **no Refund / no seller auto-debit**; REFUND requests keep the existing refund + auto-debit money path intact. **Session 17**: **outbound replacement dispatch** — OPERATOR drives `replacement` `PENDING_DISPATCH → DISPATCHED → COMPLETED | CANCELLED` (dispatch ref/note, cancel reason) with audited `ReturnEvent`s; a **non-money** leg (no ledger/debit). **Session 18**: GATEWAY-method **refund completion now executes a live gateway refund** (real `rfnd_…` recorded on Refund + `refund_transactions`) before the DB write — an external call can never roll back with the surrounding tx, so the gateway refund is executed first (idempotent on the refund reference) and the DB commit persists the real reference; a synchronously-processed refund completes the request and nets seller payables, an in-flight (PROCESSING) gateway refund leaves the request PROCESSING for later reconciliation. **Session 22**: **courier last-mile delivery of a dispatched replacement** — once a replacement is DISPATCHED, OPERATOR/ADMIN assign a DELIVERY partner (`POST …/replacement/assign-courier`, new `replacement_assignments`; one active assignment), the DELIVERY partner drives it via `/delivery/replacement-tasks` (accept/reject/pickup/out-for-delivery/fail) and its **`deliver` step auto-completes the replacement `DISPATCHED → COMPLETED`** in one tx (non-money: no Refund/payable, original order untouched); the Session 17 OPERATOR manual `/complete` is now 409 while a courier is assigned. E2E-verified (31/31). Remaining: support tickets/CRM, and the `refund_transactions` table note below is resolved (exists since Session 07/12). |
| 11 | Control Panel | PARTIALLY_COMPLETE | **Session 43**: an OPERATOR/ADMIN Platform Control Panel shipped inside the two-app MVP — `/api/v1/control` user directory (filters/search), platform session registry + audited **break-glass session revoke / revoke-all** (mandatory reason), seller governance roll, a read-only platform overview KPI strip, and an append-only `ControlAudit` log (new `control_audit` table) feeding an Audit tab in `catalog-console`. Deferred (not dropped): full step-up auth for critical ops, optional approval workflows, ABAC/permission matrix, campaign/pricing/platform-config & emergency operational overrides per the Control-Panel spec §§51–53 |
| 12 | Finance + Settlement | PARTIALLY_COMPLETE | seller payables + settlements ledger (Session 12): per-seller commissionRateBps; SellerPayable auto-earned per accepted slice at DELIVERED (goods−commission; Bilokat 0%, partner 10%); net+comm+tax+delivery == slice grandTotal; EARNED/IN_SETTLEMENT/SETTLED; operator /finance payables list/adjustments + settlements create/advance APPROVED→PROCESSING→PAID→RECONCILED (FAILED→retry) with settlement_events audit; each payable in ≤1 settlement; seller reads own payables/settlements — verified live. Session 13 adds: **auto return-debit** — a completed refund auto-debits the returned goods' net (`goods × (1−rate)`) off the delivered slice's EARNED payable to net-zero as a SYSTEM `seller_payable_adjustment` (in/after-settlement payables intentionally untouched); **read-only reconciliation** `/finance/reconciliation/summary` (order-split, refund cap, delivered-payable-presence vs cancelled-none, no-negative-net, net==goods−comm+Σadj ledger self-consistency); **reporting** `/finance/report/totals` per-seller+grand sums with earnedAt/sellerId filters — all OPERATOR/ADMIN, verified live. Session 32 adds the courier delivery-fee payout ledger (CourierPayout EARNED/SETTLED) for delivered courier legs. Remaining: real external payout execution (PAID is still a ledger mark), reconciliation vs external providers, finance/courier-payout dashboards, financial-integrity job |
| 13 | Analytics | PARTIALLY_COMPLETE | **Session 42**: read-only business analytics derived live from the transactional OLTP store (source of truth) shipped inside the two-app MVP — `/api/v1/analytics` platform overview/trend/products/categories/sellers (OPERATOR/ADMIN) + `/api/v1/seller/analytics` seller-scoped overview/trend/products (SELLER), plus an Analytics tab in `catalog-console`. Deferred (not dropped): a separate events/ingestion path, a dedicated analytics warehouse/storage, and scheduled/AI dashboards per the full 10-ANALYTICS-SPEC |
| 14 | AI Intelligence | NOT_STARTED | gateway, RAG, recommendations, intelligence |
| 15 | Security Hardening | NOT_STARTED | pen-spec checklist pass, secrets, threat model review |
| 16 | Testing + Production Verification | NOT_STARTED | full automated + verification gate |

## Workstream detail (primary)

| Workstream | Status |
|---|---|
| Landing-page static prototype | DISCOVERED → builds cleanly; **owner: UX reference only, not exact spec** |
| ORM layer | COMPLETE (Prisma 7.10 + adapter-pg + prisma.config.ts, verified) |
| `bilokat-api` backend foundation | COMPLETE (scaffold/config/DB/envelope/health/unit tests — verified) |
| Auth + RBAC foundation | PARTIALLY_COMPLETE (register/login/logout/me, refresh rotation + reuse detection, guards — verified live + tests) |
| Catalog API endpoints (products/categories serving landing page) | COMPLETE (public read API verified live + seeded + tested) |
| Commerce: cart + checkout + orders + coupons (server-authoritative) | COMPLETE (unit tests pass; live order place/cancel verified). Reviews separate |
| Buy-now + online payment (intent/capture, sandbox) + COD OTP | COMPLETE (verified live + payment.service/cod.service tests) |
| `customer-web` full application | NOT_STARTED (only static landing prototype exists) |
| Data model / DB migrations (Identity + Catalog + Commerce tables) | COMPLETE (7 migrations recorded incl. `commerce_models`, `cart_status_merged`; migrate deploy clean) |
| Backend unit tests | COMPLETE (18 suites / 167 tests passing: exception filter, app, auth.service + seller-register, roles.guard, catalog.service, cart.service, order.service, payment.service, payment.gateway.service, cod.service, fulfilment.service, returns.service, seller-ops.service, settlement.service, delivery.service, seller-onboarding.service, gateway/razorpay.gateway) |
| AuthN (sessions/tokens) | NOT_STARTED |
| AuthZ (RBAC/ABAC, org/tenant isolation) | PARTIALLY_COMPLETE | RBAC done since Session 02 (RolesGuard + @Roles, now incl. REVIEWER in Session 14). Session 14 adds Organization/OrganizationMember (seller orgs, OWNER operator memberships) as the seed of org-aware authorization; resource scoping is still per-role + `users.sellerId` binding (SELLER→own seller), not full ABAC / general tenant isolation. |
| Event/outbox infrastructure | NOT_STARTED |
| Automated tests (any layer) | NOT_STARTED |
| CI/CD | NOT_STARTED |
| Docker / deployment config | NOT_STARTED |

## Existence ≠ completion
- `landing-page/` exists but is **hardcoded** → does NOT satisfy customer-web
  spec or SOURCE-OF-TRUTH rule. Marked DISCOVERED only.
- Every feature in specs is unbuilt until a backend/app with tests and a clean
  build proves otherwise.

---

## Session 29 status — DELIVERY courier task console (2026-09-08)

Adds the DELIVERY-role courier console to the connected React/Vite catalog console (workstream: per-slice
courier delivery + courier last-mile replacement delivery + back-office console UIs).

| Item | Status | Notes |
|---|---|---|
| Courier task console (UI) | COMPLETE/VERIFIED live | `catalog-console/` DELIVERY "My Deliveries" tab over `/delivery/tasks` (slice parcels) + `/delivery/replacement-tasks` (replacements); per-status actions accept/reject(reason)/pickup/out-for-delivery/deliver/fail(reason); detail drawer (customer/address/items/timeline) |
| Enriched slice-task courier surface | COMPLETE/VERIFIED live | new DELIVERY `GET /delivery/tasks/:assignmentId` (orderNumber/paymentMethod/seller/items/customer+events); `partnerTasks` list adds orderNumber/itemCount/customer; RBAC + guards verified (404/403/409/400) |
| Backend | COMPLETE | typecheck + `npm run build` clean; route mapped |
| Console build | COMPLETE | `npm run build` clean in `catalog-console/` |
| Delivery-workflow roll-up | COMPLETE | Sessions 15/22/29 cover per-slice + replacement last-mile delivery + courier console; Session 30 added the pluggable courier-provider seam (tracking/POD), Session 31 the customer/operator tracking-read surface, Session 32 the courier delivery-fee payout (money leg). Remaining future work: wiring a real courier provider's live credentials, real external payout execution |
| Pushed | COMPLETE | Session 28 + 29 at `origin/main` `9b07533` |

---

## Session 30 status — pluggable courier-provider integration (tracking + POD) (2026-09-08)

Workstream: per-slice courier delivery + courier last-mile replacement delivery → external courier-provider
integration.

| Item | Status | Notes |
|---|---|---|
| Provider seam | COMPLETE/VERIFIED | `src/commerce/courier` `CourierProvider` (createShipment/track/confirmDelivery) + `COURIER_PROVIDER` token; Sandbox default (no I/O) + real REST Http provider (base URL overridable); DI factory in `commerce.module` |
| Tracking + POD persistence | COMPLETE/VERIFIED | migration `courier_tracking` (carrier/trackingNumber/trackingUrl/podRef/podSignedBy/podAt on delivery + replacement assignments); pickup books waybill, deliver captures POD (both best-effort, POD outside the DB tx); serializers expose the fields |
| Unit tests | COMPLETE | courier-provider.spec (6) + delivery-service booking/POD (3) → 22 suites / 214 tests green |
| Build | COMPLETE | `tsc` exit 0, `nest build` clean |
| Live verify (sandbox + real-HTTP mock) | COMPLETE | sandbox demo pickup booked `SWB-…`; real-HTTP E2E (`/tmp/s30_http_e2e.mjs`, 8/8) booked `MCK-…`, captured `POD-MCK-…`, replacement auto-completed — non-money |
| Courier mock | COMPLETE | `scripts/courier-mock.mjs` (local courier-protocol HTTP server, `/_state` inspection) |
| Per-slice payout | COMPLETE (Session 32) | courier delivery-fee payout (money leg) shipped in Session 32; seller earn remains order-level |
| Pushed | COMPLETE | Session 30 at `origin/main` (see git log) |

---

## Session 31 status — courier tracking-read surface (customer/operator) (2026-09-08)

Workstream: per-slice courier delivery + courier last-mile replacement delivery → external courier-provider
integration → live tracking read.

| Item | Status | Notes |
|---|---|---|
| Backend read surface | COMPLETE/VERIFIED | `GET /orders/:id/tracking` (`CourierTrackingService`/`OrderCourierTrackingController`); aggregates an order's courier legs (slice `delivery_assignments` + `replacement_assignments`, latest per slice/replacement, terminal filtered) and calls `CourierProvider.track` LIVE per waybill, merged with local leg state + POD; read-only NON-money |
| Entitlement | COMPLETE/VERIFIED | order OWNER (CUSTOMER) or OPERATOR/ADMIN; non-owner CUSTOMER 404 (no leak), other roles 403; `@Roles(CUSTOMER, OPERATOR, ADMIN)` |
| Unit tests | COMPLETE | `courier-tracking.service.spec.ts` (8) → 23 suites / 222 tests green; typecheck + build clean |
| Connected UI | COMPLETE/VERIFIED | `customer-storefront` OrderView "Track delivery" timeline (live provider events + POD); `api.js`/`styles.css`; Vite build clean |
| Live E2E | COMPLETE/VERIFIED | `/tmp/s31_tracking_e2e.mjs` 14/14 vs HTTP-provider API + courier-protocol mock: parcel PICKED_UP `MCK-…` → live `OUT_FOR_DELIVERY`; replacement DELIVERED `POD-MCK-…` → live `DELIVERED`; RBAC 404/403 probed |
| Storefront proxy | COMPLETE/VERIFIED | `http://localhost:5180/api/v1/orders/…/tracking` returned parcel leg + live status through the Vite proxy |
| Migration | COMPLETE (none) | all tracking columns already shipped in S30 `courier_tracking`; 25 migrations unchanged |
| Per-slice payout | COMPLETE (Session 32) | money leg shipped in Session 32 |
| Pushed | COMPLETE | Session 31 at `origin/main` (see git log) |

---

## Session 32 status — courier delivery-fee payout / money leg (2026-09-08)

Workstream: per-slice courier delivery + courier last-mile replacement delivery → external courier-provider
integration → courier payout ledger (the deferred money leg).

| Item | Status | Notes |
|---|---|---|
| CourierPayout data model | COMPLETE/VERIFIED | `CourierPayout` table + `CourierPayoutStatus` (EARNED/SETTLED/CANCELLED), additive migration `20260908210000_courier_payout` (26 total); `courier.fees` config (`COURIER_FEE_PARCEL`=35, `COURIER_FEE_REPLACEMENT`=40) |
| Accrual (earn) | COMPLETE/VERIFIED | `CourierPayoutService.earnCourierDelivery` inside the courier deliver transaction (parcel in `delivery.service.deliver`; replacement in `replacement-courier.service` completion); idempotent per assignment; skip when partner null / fee 0 |
| DI fix | COMPLETE | `@Optional() @Inject(CourierPayoutService)` in both deliver services (a `| null` union otherwise erased the class from `design:paramtypes`, silently injecting undefined) |
| Read + settle surface | COMPLETE/VERIFIED | DELIVERY `GET /delivery/payouts` (+partner summary); OPERATOR/ADMIN `GET /delivery/payouts/all`, `/summary`, `POST /delivery/payouts/settle {deliveryPartnerId}` → EARNED→SETTLED in one tx; roles enforced |
| Unit tests | COMPLETE | `courier-payout.service.spec.ts` (11) → 24 suites / 233 tests green; typecheck + build clean |
| Live money E2E | COMPLETE/VERIFIED | `/tmp/s32_payout_e2e.mjs` 18/18 on sandbox API `:4600`; money fully cleaned after (courier_payouts=0) |
| Seller-earn invariant | COMPLETE | seller payables stay order-level (unchanged) |
| Pushed | COMPLETE | Session 32 at `origin/main` (see git log) |

## Session 40 status — buyer-side returns/refunds UI + customer notification feed (2026-09-08)

MVP framing (owner): the connected `customer-storefront` (buyer) + `catalog-console` (SELLER/OPERATOR/
ADMIN/DELIVERY) apps over the shared backend ARE the product; everything else in the 16-session matrix
(analytics, AI, control panel, and the separate web apps) is **deferred**, not silently dropped.

| Item | Status | Notes |
|---|---|---|
| Customer return/refund UI (buyer loop) | COMPLETE/VERIFIED live | `ReturnsPanel` on a DELIVERED order: lists prior/active returns, requests a REFUND or REPLACEMENT (per-item qty + reason + note) over the existing `/orders/:id/returns`, and attaches REPLACEMENT evidence. Pure frontend — no money-model change; storefront vite build clean |
| Customer notification feed | COMPLETE/VERIFIED live | buyer categories `ORDER_STATUS`/`RETURN_STATUS` (native enum migration `20260908225000_cust_notif_cat`); `NotifySpec` title/message overrides; `ReturnsService` best-effort RETURN_STATUS notices on return request + rejection (optional `@Optional NotificationService`); `CustomerNotificationsController` `/customer/notifications` (CUSTOMER read/mark); `NotificationsBell` in the storefront header |
| Unit tests | COMPLETE | returns.spec 43 (incl. +2 RETURN_STATUS), notification 13, settlement 25, delivery 16, fulfilment 13, courier-payout 16 — green; typecheck/build clean |
| Live E2E | COMPLETE/VERIFIED | `scripts/e2e-customer-returns.mjs` 24/24 self-clean on `:4900`: place→capture→deliver a throwaway PREPAID order → customer REFUND return → buyer sees RETURN_STATUS notification → mark-read → RBAC 403s; rows + stock cleaned |
| Pushed | COMPLETE | Session 40 at `origin/main` (see git log) |

MVP close-the-loop is now underway across the two in-scope apps; a final integration/verification +
docs + scope-freeze pass remains to declare the MVP COMPLETE.

---

## Session 41 status — MVP completion & scope freeze (delivery ORDER_STATUS notice + full cross-role E2E) (2026-09-08)

| Item | Status | Notes |
|---|---|---|
| Delivery ORDER_STATUS notice (buyer bell, the real arrival event) | COMPLETE/VERIFIED live | the storefront `NotificationsBell` only ever saw RETURN_STATUS (return request/rejection); the **most important** event — the order actually being delivered — was missing. Now emitted best-effort (post-commit, never blocks/rolls back a delivery) on every delivery-finalizing path: `fulfilment.service` operator advance → DELIVERED; `delivery.service` courier parcel `deliver()`; `replacement-courier.service` courier replacement `deliver()`. `@Optional` NotificationService seams keep legacy unit tests unchanged |
| Unit tests | COMPLETE | delivery.spec 17 (+1 ORDER_STATUS on courier finalize), fulfilment.spec 15 (+2 on operator DELIVERED), replacement-courier.spec 13 (+1 on replacement deliver) — green; typecheck + `nest build` clean |
| Live E2E | COMPLETE/VERIFIED | `scripts/e2e-mvp-loop.mjs` 26/26 on fresh sandbox API `:5000` — full buyer→seller→operator→courier→finance→notifications loop incl. courier parcel fee **EARNED ₹35**, buyer ORDER_STATUS "Order delivered" on the courier-finalized path, buyer REFUND return → RETURN_STATUS notice, and RBAC 403s; throwaway rows + product stock cleaned (DB asserted clean) |
| Scope freeze | COMPLETE | MVP (the two connected apps over the shared backend) declared COMPLETE; the 16-session matrix's other workstreams (analytics/AI/control panel/other web apps) remain **deferred**, not dropped |
| Pushed | COMPLETE | Session 41 at `origin/main` (see git log) |

---

## Session 42 status — read-only business analytics (OLAP-over-OLTP) + Analytics tab (2026-09-08)

Two-app MVP surface (owner-selected scope): business analytics read live over the transactional store.

| Item | Status | Notes |
|---|---|---|
| Backend `/api/v1/analytics` (OPERATOR/ADMIN) | COMPLETE/VERIFIED live | `overview` (orders/commerce/returns KPIs + full status breakdown), `trend` (daily order+GMV series, UTC zero-filled), `products`, `categories`, `sellers` (per-seller payable-ledger roll-up) — all windowed by optional validated ISO `from`/`to`; read-only |
| Backend `/api/v1/seller/analytics` (SELLER) | COMPLETE/VERIFIED live | `overview`/`trend`/`products` scoped to the caller's own ACTIVE seller (`requireSellerId`); platform `/sellers` is OPERATOR-only |
| RBAC + validation | COMPLETE/VERIFIED | 401 unauthenticated; SELLER↔OPERATOR cross-route 403 both ways; `from=garbage` → 400; no schema migration (OLAP over existing OLTP tables) |
| Unit tests | COMPLETE | new `analytics.service.spec.ts` (9) — GMV/AOV/units/buyers/cancel-exclusion, seller-scope isolation (defensive `scopedOrders`), trend zero-fill, product ranking, category roll-up, seller-payable roll-up, `requireSellerId`, invalid-window 400. Typecheck + `nest build` clean |
| Console Analytics tab | COMPLETE | `catalog-console/src/views/Analytics.jsx` — platform "Business Analytics" + SELLER "My Performance", From/To + 7/30/90-day presets, Overview/trend/status/returns/top-products/category/seller-ledger sections; `vite build` clean (47 modules) |
| Demo data | COMPLETE | `scripts/seed-analytics-demo.ts` (idempotent) — 28 internally-consistent historical orders + 2 fixture buyers; live aggregates reconcile (GMV, commission, per-seller scoping) |
| Pushed | NOT YET | Session 42 working tree present; docs updated; commit + push pending (needs owner one-shot PAT) |

Two-app MVP (customer-storefront + catalog-console over the shared backend) is functionally COMPLETE
across all four roles; Session 42 closes the last deferred matrix bucket that is reachable inside that
two-app scope.

---

## Session 43 status — Platform Control Panel (governance + audited break-glass) (2026-09-08)

| Item | Status | Notes |
|---|---|---|
| ControlAudit data model | COMPLETE | `ControlAudit` + `ControlActionType` (50 models) applied via `prisma db push`; DDL record at `20260908230000_control_audit` |
| `/api/v1/control` backend (OPERATOR/ADMIN) | COMPLETE/VERIFIED live | `overview`, `users` + `users/:id`, `sessions`, `sellers` (read); `audit` feed |
| Break-glass actions | COMPLETE/VERIFIED live | `sessions/:id/revoke` + `users/:id/revoke-sessions` — mandatory reason (blank→400), 404/400 guards, non-staff rejected, each appends a `ControlAudit` SESSION_REVOKE row with actor+reason |
| Unit tests | COMPLETE | `control.service.spec.ts` (11) — directory/session mapping, revoke guards + audit writes, sellers roll, audit feed, overview. Typecheck + `nest build` clean |
| Console Control tab | COMPLETE | `ControlPanel.jsx` + `controlApi` in `catalog-console`; Overview / Users (+detail) / Sessions (+revoke) / Sellers / Audit; mandatory-reason confirm overlay; Vite build clean (48 modules) |
| RBAC + live verify | COMPLETE/VERIFIED | 401 unauth; SELLER + CUSTOMER → 403 on `/control`; OPERATOR reads + a real break-glass revoke → audit row; throwaway cleaned. Access token short-lived (15 min): DB revoke stops refresh; full token-denylist deferred (matrix #15) |
| Pushed | NOT YET | Session 43 working tree present; docs updated; commit + push pending (needs owner one-shot PAT) |

---

## Session 44 status — buyer discovery & merchandising (customer storefront) (2026-09-08)

| Item | Status | Notes |
|---|---|---|
| Curated landing rails | COMPLETE | Home shows **Bestsellers** + **New arrivals** horizontal rails over the live `bestseller`/`isNew` filters; rails hide if empty; **See all →** drives the quick-filter + grid retitle |
| Catalog quick filters | COMPLETE | All / ★ Bestsellers / ✨ New arrivals quick-filter row + existing category chips, search, sort, active-filter line with Clear, pagination |
| Card badges | COMPLETE | Explicit ★ Bestseller badge added (New + %-off already present), badges wrap |
| Backend / schema | NONE (pure UI) | Reuses the existing public discovery API (category/q/sort/bestseller/isNew/price) |
| Demo flags (live DB) | COMPLETE | 2 more seeded products marked `isNew` (3 new / 5 bestsellers) for a populated rail; display-only |
| Build + live verify | COMPLETE | storefront `vite build` clean (44 modules); rails fetch 5 bestsellers + 3 new through the dev proxy; module transforms 200 |
| Pushed | NOT YET | working tree present; commit + push pending |

---

## Session 45 status — discovery landing (storefront Home) (2026-09-08)

| Item | Status | Notes |
|---|---|---|
| Promo/promise ribbon | COMPLETE | 24h dispatch · COD · small-batch · gift-ready |
| Editorial split hero | COMPLETE | Live #1 best-seller feature card (image/rating/price/add) + hero copy + live totals |
| Fan-favourite marquee | COMPLETE | Auto-scroll of live product names, pause on hover (original touch) |
| Shop-by-craving category tiles | COMPLETE | Live per-category counts; click filters + scrolls catalog |
| Curated rails (Best-sellers / New) | COMPLETE | Landing-styled, still live-driven, hide on active filter |
| Catalog workhorse | COMPLETE | search/sort/chips/active-filter Clear/pagination unchanged |
| Why/CTA bands | COMPLETE | Value props + closing CTA |
| Origin vs copy | COMPLETE | New design, not a clone of `landing-page/`; no hard-coded merch |
| Backend/schema | NONE | Pure storefront UI over live catalog API |
| Build + live verify | COMPLETE | `vite build` clean (44 modules); modules + root 200; HMR clean |
| Pushed | NOT YET | working tree present; commit + push pending |

---

## Session 46 status — Bilokat design language across the storefront (2026-09-08)

| Item | Status | Notes |
|---|---|---|
| Prototype study | COMPLETE | Header, footer, colour, card UI, payment-success extracted from `landing-page/` |
| Branded header/navbar | COMPLETE | Gradient B tile + wordmark + pill nav + gradient cart pill w/ count |
| Rich footer | COMPLETE | Brand + Shop/Account/We-promise columns, copyright |
| Coherent colour combo | COMPLETE | Cream + brandy/chili + saffron/gold tokens + display-serif headings, all pages |
| Card UI | COMPLETE | `.pcard`/`.panel`/`.summary`/`.rev` rounded + warm shadows/plates |
| Buttons & chips | COMPLETE | Pill gradients, active pills, focus rings |
| Payment-success / order UI | COMPLETE | Order hero → branded 🎉/📦 confirmation card |
| Backend-driven | COMPLETE | No hard-coded merch; all reads stay on live catalog API |
| Backend/schema | NONE | UI-only; wishlist/address/profile-edit lack endpoints (deferred) |
| Build + live verify | COMPLETE | `vite build` clean; 4 routes headless-render, zero page-errors |
| Pushed | NOT YET | working tree present; commit + push pending |

---

## Session 47 status — backend-driven wishlist + address book + search (2026-09-08)

| Item | Backend | Storefront | Notes |
|---|---|---|---|
| Wishlist model + table | COMPLETE | — | `WishlistItem` (user×product unique), db push + migration record |
| Wishlist API | COMPLETE | — | list / ids / add / remove, CUSTOMER-only |
| Wishlist page | — | COMPLETE | #/wishlist: list, remove, add-to-cart, empty/signed-out |
| Wishlist hearts on cards/product | — | COMPLETE | Signed-in only; App-held id set; toggle |
| Address book API | COMPLETE | — | CRUD + default on existing Address table |
| Address book page | — | COMPLETE | #/addresses add/edit/default/delete, responsive |
| Search suggestions | COMPLETE | — | `GET /catalog/suggest` (live name/tagline/category) |
| Search UI (autocomplete + recent) | — | COMPLETE | SearchBox dropdown + recent, backend-driven |
| Nav/account wiring | — | COMPLETE | ♡ Wishlist link + account quick links |
| Typecheck / unit tests / build | PASS | build PASS | 30 suites / 289 tests; backend+frontend builds clean |
| Live verify | PASS | E2E PASS | curl API + headless login→wishlist/addresses/search, 0 errors |
| Pushed | NOT YET | | working tree present; commit + push pending |

---

## Session 48 status — Registration + Notifications centre + mobile nav (2026-09-08)

| customer-web feature | Status | Notes |
|---|---|---|
| Registration (Create account) | COMPLETE | Sign in/Create toggle → `POST /auth/register`, strong-password hint, phone optional |
| Notifications centre | COMPLETE | #/notifications list + All/Orders/Returns filters + read/unread + mark read/all |
| Mobile bottom nav | COMPLETE | Home/Wishlist/Cart/Orders/Account fixed bar <700px, cart badge, safe-area |
| Desktop shell | UNCHANGED | Session 46 header/footer intact |
| Backend needed | NONE new | register + customer-notifications already existed |
| Build + live verify | COMPLETE | `vite build` clean; headless register + mobile-nav + notifications, 0 errors |
| Pushed | NOT YET | commit + push pending |
