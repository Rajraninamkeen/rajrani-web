# BILOKAT API (bilokat-api)

Modular **Central Backend** for BILOKAT — a multi-seller Indian namkeen/snacks
marketplace. This repository holds the backend only (per the NO-MONOREPO
architecture decision); the frontend and spec docs live in their own repos.

**Current scope (Session 01 — Backend Foundation):** runnable NestJS + Prisma
application with configuration, PostgreSQL wiring, standard API response/error
envelope, request-id correlation, health checks, initial Identity + Catalog
data model, and a Jest unit-test suite. Commerce/auth feature modules are added
in later sessions.

## Tech

- [NestJS 11](https://nestjs.com/) (TypeScript, strict mode)
- [Prisma 6](https://www.prisma.io/) + PostgreSQL 17
- Redis (configured; used by caching/jobs in later sessions)
- Jest + ts-jest for unit tests

## Quick start

```bash
# 1. Infra (Postgres + Redis). Docker required.
docker compose up -d

# 2. Install + prepare DB
npm install
npx prisma migrate deploy   # apply committed migrations
npx prisma generate

# 3. Env
cp .env.example .env        # then edit secrets

# 4. Run
npm run start:dev           # http://localhost:4000
```

Health: `GET http://localhost:4000/api/v1/health`

## Scripts

| Command | Purpose |
|---|---|
| `npm run start:dev` | Watch-mode dev server |
| `npm run build` | Production build (`nest build`) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Jest unit tests |
| `npm run prisma:migrate` | Create + apply dev migration |
| `npm run prisma:deploy` | Apply migrations (CI/prod) |
| `npm run prisma:studio` | Prisma Studio |
| `npm run prisma:seed` | Seed dev data |

## Repo layout

```text
src/
  config/        env-driven configuration (typed)
  prisma/        PrismaService (global DB access)
  health/        Terminus health checks (db, app)
  common/
    api-response/  standard {success,error} envelope + error codes
    filters/       global exception → envelope
    interceptors/  success → envelope
    middleware/    request-id/correlation
prisma/
  schema.prisma    data model (Identity + Catalog)
  migrations/      versioned SQL migrations
docker-compose.yml Postgres + Redis (dev)
```

## Environment variables

See `.env.example`. Never commit `.env`. In production, set `JWT_*` secrets to
long random values and pin `DATABASE_URL` / `REDIS_URL`.

## Repo hygiene & security

- `.env`, `node_modules/`, `dist/` are git-ignored.
- Only `prisma:seed` writes fixtures, guarded to dev/test environments.
- See PROJECT-DOCS (spec docs repo) for the full architecture.
