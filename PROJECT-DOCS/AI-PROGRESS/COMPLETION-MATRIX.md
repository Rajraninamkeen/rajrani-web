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
| 03 | Seller Onboarding | PARTIALLY_COMPLETE | **Session 14**: backend onboarding/KYC + full additive Organization/OrganizationMember model + OWNER memberships + `REVIEWER` role + lifecycle (PENDING→UNDER_REVIEW→APPROVED→ACTIVE, correction loop, audit history) live under `/seller/onboarding` (owner) + `/seller-onboarding` (staff), plus public `POST /auth/seller-register`; document uploads are storage-intent only. Remaining: seller-web application, product listing/publishing, catalog-publishing approval UI. (Catalog API built early out-of-order to serve landing page; see Catalog row.) |
| 04 | Catalog | PARTIALLY_COMPLETE | Public catalog read API live (/api/v1/catalog: categories, products w/ filters, detail) + seed (5 cats/8 prods) + display-field migration + tests. Attribute/variant/media mgmt & publishing UI deferred |
| 05 | Catalog Publishing | NOT_STARTED | listings, approval/review, visibility, lifecycle |
| 06 | Seller Platform | NOT_STARTED | seller apps for products/orders/inventory/returns |
| 07 | Customer Commerce | PARTIALLY_COMPLETE | cart (guest+auth, merge-on-login), checkout quote, order place/list/cancel/history-timeline, coupons, buy-now done (server-authoritative, verified live). Remaining: discovery, multi-seller split-cart, reviews |
| 08 | Payment + COD | VERIFIED | provider-agnostic Payment intent + gateway capture (signature+idempotency), payment ledger/webhook audit, buy-now, COD OTP verification, COD cash-collection at delivery (COD_PAID flip), refund ledger (payment_transactions REFUND) — verified live. **Session 18** adds a **real Razorpay gateway** behind the pluggable `PaymentGateway` seam (`PAYMENT_GATEWAY_PROVIDER`, default **sandbox** unchanged): real REST `POST /v1/orders` + raw-body-HMAC webhook verify + real `POST /v1/payments/:id/refund` refund execution (real `rfnd_…` gatewayRef persisted on the Refund + a `refund_transactions` SUCCESS row), E2E-verified against a **local Razorpay-protocol mock**; flipping to live Razorpay is env base-url/keys only (no code change). **Session 19** adds **async refund reconciliation** — a gateway refund left in-flight (Refund `PROCESSING`) is later finalised by `ReturnsService.reconcileRefundFromEvent` on a signed `refund.processed` webhook (`refund.failed` → Refund FAILED, request stays open for retry). COD path unchanged |
| 09 | Fulfillment + Delivery | PARTIALLY_COMPLETE | internal operator advance workflow (CONFIRMED→PACKED→SHIPPED→OUT_FOR_DELIVERY→DELIVERED, guarded + audited, deliveredAt + COD_PAID on delivery) verified live. **Session 15** adds the per-slice courier layer: `delivery_partners`/`delivery_assignments`/`delivery_events` + a dedicated **DELIVERY** role with its own `/delivery/tasks` surface (accept/reject/pickup/out-for-delivery/deliver/fail) driving per-slice `deliveredAt`, and the courier finalizes the order to DELIVERED on the last slice (money trigger unchanged). Remaining: real courier-provider integration, delivery pricing/zone, tracking/POD, per-slice payout (earn stays order-level by owner decision) |
| 10 | Returns + Support | VERIFIED (return money/refund now REAL-gateway-executed per Session 18; see note) | whole-order returns + refunds backend verified live + tests. **Session 08**: item-level partial returns, pickup scheduling, per-line inspection (PASS/PARTIAL_PASS/FAIL → policy-rate refund amounts), `return_items`/`return_inspections`, full-return → order REFUNDED. **Session 16**: **replacement (exchange) vs refund** + **evidence upload** — a return request carries a `resolution` (REFUND default | REPLACEMENT); REPLACEMENT requests are `evidenceRequired` and accept customer/operator photo evidence (`return_evidence`, storage-intent), and on completed inspection go **terminal `REPLACEMENT_ISSUED`** with a `replacement` row (PENDING_DISPATCH) and **no Refund / no seller auto-debit**; REFUND requests keep the existing refund + auto-debit money path intact. **Session 17**: **outbound replacement dispatch** — OPERATOR drives `replacement` `PENDING_DISPATCH → DISPATCHED → COMPLETED | CANCELLED` (dispatch ref/note, cancel reason) with audited `ReturnEvent`s; a **non-money** leg (no ledger/debit). **Session 18**: GATEWAY-method **refund completion now executes a live gateway refund** (real `rfnd_…` recorded on Refund + `refund_transactions`) before the DB write — an external call can never roll back with the surrounding tx, so the gateway refund is executed first (idempotent on the refund reference) and the DB commit persists the real reference; a synchronously-processed refund completes the request and nets seller payables, an in-flight (PROCESSING) gateway refund leaves the request PROCESSING for later reconciliation. Remaining: support tickets/CRM, courier-delivering a dispatched replacement, and the `refund_transactions` table note below is resolved (exists since Session 07/12). |
| 11 | Control Panel | NOT_STARTED | platform governance, audit, break-glass |
| 12 | Finance + Settlement | PARTIALLY_COMPLETE | seller payables + settlements ledger (Session 12): per-seller commissionRateBps; SellerPayable auto-earned per accepted slice at DELIVERED (goods−commission; Bilokat 0%, partner 10%); net+comm+tax+delivery == slice grandTotal; EARNED/IN_SETTLEMENT/SETTLED; operator /finance payables list/adjustments + settlements create/advance APPROVED→PROCESSING→PAID→RECONCILED (FAILED→retry) with settlement_events audit; each payable in ≤1 settlement; seller reads own payables/settlements — verified live. Session 13 adds: **auto return-debit** — a completed refund auto-debits the returned goods' net (`goods × (1−rate)`) off the delivered slice's EARNED payable to net-zero as a SYSTEM `seller_payable_adjustment` (in/after-settlement payables intentionally untouched); **read-only reconciliation** `/finance/reconciliation/summary` (order-split, refund cap, delivered-payable-presence vs cancelled-none, no-negative-net, net==goods−comm+Σadj ledger self-consistency); **reporting** `/finance/report/totals` per-seller+grand sums with earnedAt/sellerId filters — all OPERATOR/ADMIN, verified live. Remaining: real payout execution (external transfer; PAID is a ledger mark), reconciliation engine vs external provider (finance is internal-ledger integrity only), finance dashboards, financial-integrity job, no auto-fix of reconciliation discrepancies (read-only) |
| 13 | Analytics | NOT_STARTED | events, analytics storage, dashboards |
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
