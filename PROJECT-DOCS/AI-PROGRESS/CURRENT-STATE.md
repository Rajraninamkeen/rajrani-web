# CURRENT-STATE — BILOKAT

> Authoritative AI snapshot. Update at the end of every session.
> Never mark anything COMPLETE without verification evidence.

| Field | Value |
|---|---|
| Project | BILOKAT — Multi-Seller Marketplace Platform |
| Spec/docs repo | `Rajraninamkeen/concept` (PROJECT-DOCS + AI-PROGRESS + landing-page prototype) |
| Backend repo | `bilokat-api` — **separate repo** (NO-MONOREPO). Local path `/home/user/bilokat-api`; not yet on GitHub |
| Branch | `main` (both repos) |
| Remote | `origin https://github.com/Rajraninamkeen/concept.git` (concept); bilokat-api remote TBD (owner creates GitHub repo) |
| Current session | Session 01 — Backend Foundation (backend scaffolded & verified; feature modules later) |
| Current phase | Foundations |
| Overall status | Specs + landing prototype + **backend foundation** (NestJS+Prisma) exist; no commerce/auth feature modules yet |
| Completed sessions | Session 00 (audit) — complete |
| Next session | Session 02 — Authentication + Authorization |
| Active blockers | Owner must create GitHub repo for `bilokat-api` and grant push (B-001); no feature modules built yet |
| Known technical debt | See `COMPLETION-MATRIX.md`; landing-page is hardcoded; Prisma CLI transitive `deepmerge-ts` advisory (dev-only) |
| Last verification | Frontend build PASS; backend typecheck/build/migrate/tests PASS (2026-09-07) |
| Repository health | concept clean (5 commits); bilokat-api clean (1 commit, 28 files); no committed secrets |

---

## What exists vs. what the specs require

The repository today is a **documentation + prototype container**, not the final
multi-app platform.

### Present
- `PROJECT-DOCS/` — all 13 specification documents (complete set, none missing).
- `landing-page/` — a **static single-page React marketing prototype** named
  "Bilokat" (namkeen/snacks D2C). All data is hardcoded. No API / backend calls.

### Absent (per spec) / deferred
- `bilokat-api` backend exists as **foundation only** (Session 01): NestJS +
  Prisma, config, health, envelope, Identity + Catalog data model + 2 migrations.
  Feature modules (auth, commerce, catalog APIs, checkout, orders, delivery…)
  are NOT built yet.
- No `customer-web` full application (multi-page with account, orders, etc.).
- No `seller-web`, `catalog-publishing-web`, `support-web`, `delivery-web`,
  `finance-web`, `control-web`, `analytics-web` applications.
- No Redis-backed caching/jobs, no event bus / outbox yet.
- No auth, RBAC/ABAC, sessions, payments, COD, delivery, returns, refunds,
  settlements, AI, analytics, or audit implementation.
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
