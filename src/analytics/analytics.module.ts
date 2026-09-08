import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { AnalyticsService } from './analytics.service';
import { AnalyticsController } from './analytics.controller';
import { SellerAnalyticsController } from './seller-analytics.controller';

/** Session 42 — read-only business analytics over the transactional OLTP store. */
@Module({
  imports: [PrismaModule, AuthModule],
  providers: [AnalyticsService],
  controllers: [AnalyticsController, SellerAnalyticsController],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
