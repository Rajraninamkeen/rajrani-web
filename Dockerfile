# ---------------------------------------------------------------------------
# bilokat-api — production image (multi-stage)
#
# Build:   docker build -t bilokat-api .
# Run:     docker run --rm -p 3000:3000 --env-file .env bilokat-api
#
# The image runs `prisma migrate deploy` (up to date with the 26 committed
# migrations) then boots the compiled NestJS server on $PORT (default 3000).
# ---------------------------------------------------------------------------

# ---------- Stage 1: install deps + build ----------
FROM node:20-alpine AS build
WORKDIR /app

# Lockfiles first for better layer caching.
COPY package.json package-lock.json ./
COPY prisma.config.ts tsconfig.json tsconfig.build.json nest-cli.json ./
COPY prisma ./prisma

# Full install (dev deps included so `nest` + `prisma` CLI are available).
RUN npm ci

# Source + Prisma-generated client (src/generated is not committed).
COPY src ./src
RUN npx prisma generate
RUN npm run build

# ---------- Stage 2: lean runtime ----------
FROM node:20-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app

# Reuse the full node_modules from the build stage so the `prisma` CLI is
# present for `migrate deploy` at startup. (Trade a larger image for reliable,
# dependency-free runtime boots.)
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/prisma.config.ts ./prisma.config.ts
COPY --from=build /app/package.json ./package.json

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/v1/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main"]
