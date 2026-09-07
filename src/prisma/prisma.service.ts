import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';

// Prisma ORM 7: the client is Rust-free and requires a driver adapter for the
// connection. We supply PrismaPg built from the configured DATABASE_URL.
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor(config: ConfigService) {
    super({
      adapter: new PrismaPg({
        connectionString:
          config.get<string>('databaseUrl') ??
          'postgresql://bilokat:bilokat_dev@localhost:5432/bilokat',
      }),
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log('Connected to PostgreSQL (Prisma 7 + PrismaPg adapter)');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  /** Cleanly reset helper only ever used in dev/test, never in production. */
  async truncateAll(): Promise<void> {
    const tables = await this.$queryRawUnsafe<{ tablename: string }[]>(
      `SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename NOT IN ('_prisma_migrations')`,
    );
    await this.$executeRawUnsafe('SET session_replication_role = replica');
    for (const { tablename } of tables) {
      await this.$executeRawUnsafe(`TRUNCATE TABLE "${tablename}" CASCADE`);
    }
    await this.$executeRawUnsafe('SET session_replication_role = DEFAULT');
  }
}
