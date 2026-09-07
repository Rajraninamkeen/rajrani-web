// Prisma ORM 7 configuration (Prisma 7 no longer auto-loads .env or reads the
// "prisma" key in package.json — this file is the single source for CLI config).
import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'ts-node prisma/seed.ts',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
});
