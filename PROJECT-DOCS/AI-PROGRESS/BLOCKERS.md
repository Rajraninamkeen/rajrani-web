# BLOCKERS — BILOKAT

> ID, Severity, Area, Description, Impact, Required Action, Status.
> Do not hide blockers. Open decisions are recorded so they are not silently
> re-litigated or lost.

| ID | Severity | Area | Description | Impact | Required Action | Status |
|---|---|---|---|---|---|---|
| B-001 | Info | Repo layout | Current repo is a single container (`concept`) with `PROJECT-DOCS/` + `landing-page/` nested, but specs mandate **NO MONOREPO** and independent app repos | Final deployable layout unresolved; affects where `bilokat-api`/`customer-web` live | Decision (2026-09-07): **separate repo** for `bilokat-api`, kept OUTSIDE `concept` container. Backend developed standalone; owner to create GitHub repo + push. | RESOLVED — separate repo |
| B-002 | Info | Backend stack | Spec leaves exact backend framework/ORM "to be selected at implementation"; NestJS and Prisma layout referenced, framework not hard-bound | Backend Session 01 can't assume exact tooling blindly | Decision (2026-09-07): **NestJS + Prisma**, modular, customer-commerce vertical slice. | RESOLVED — NestJS + Prisma |
| B-003 | Info | Infrastructure | PostgreSQL host, Redis, object storage, event bus are spec'd but no infra/connection/credentials exist | Backend can't run end-to-end until DB/infra available; impacts verification | Decision (2026-09-07): **docker-compose** (PostgreSQL + Redis) for dev/test env. | RESOLVED — docker-compose |
| B-004 | Medium | Repo hygiene | No `.gitignore` at root or in `landing-page/`; no `.env.example` | Risk of future secret/artifact commits once backend+env added | Add `.gitignore` (+ nested) and `.env.example` before backend env work; commit Session 01 | OPEN |
| B-005 | Info | Scope model | Spec scope (9 apps + central backend + events + AI + analytics) is very large | Can't be completed in one pass; needs phased sessions 01–16 | Proceed session-by-session; keep completion evidence per matrix | OPEN |
| B-006 | Info | Source of truth | `landing-page/` holds hardcoded products/prices/stock | Must not become production source of truth per spec | Treat as UI reference only; real data comes from backend/db | OPEN (note) |
| B-007 | Info | Mapping to original request | Original user ask implied "create backend for the landing page"; spec defines a full marketplace backend | Backend shape depends on chosen target (whole platform vs. vertical slice serving the landing page) | Decision (2026-09-07): **Customer-commerce vertical slice** — backend that can serve the landing/customer flows (catalog, cart, checkout, orders, delivery/pincode, coupons, auth, reviews). | RESOLVED — customer-commerce slice |
