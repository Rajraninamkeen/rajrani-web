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
| Current session | Session 02 — Authentication + Authorization (foundation: register/login/refresh/logout/me, RBAC guards) |
| Current phase | Foundations — auth + RBAC foundation done; commerce feature modules remain |
| Overall status | Specs + landing prototype + backend foundation + **auth/RBAC foundation** exist |
| Completed sessions | Session 00 (audit), Session 01 (backend foundation) — complete |
| Next session | Session 03 — Catalog API (products/categories endpoints to serve the landing page) |
| Active blockers | Owner to rotate GitHub token (shared in chat); owner to keep `rajrani-web` as canonical repo |
| Known technical debt | See `COMPLETION-MATRIX.md`; landing-page is hardcoded; Prisma CLI transitive `deepmerge-ts` advisory (dev-only) |
| Last verification | Backend typecheck/build OK; `npm test` 12 passing; auth flows verified live (2026-09-07) |
| Repository health | `rajrani-web` canonical: pushed to GitHub (`fcc6682`); no committed secrets |

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

### Absent (per spec) / deferred
- No commerce/catalog **API endpoints** yet (Session 03+).
- No ABAC/organization/tenant isolation, step-up auth (deferred to later auth work).
- No `customer-web` full application (multi-page with account, orders, etc.).
- No `seller-web`, `catalog-publishing-web`, `support-web`, `delivery-web`,
  `finance-web`, `control-web`, `analytics-web` applications.
- No Redis-backed caching/jobs, no event bus / outbox yet.
- No payments, COD, delivery, returns, refunds, settlements, AI, analytics, or
  audit implementation.
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
