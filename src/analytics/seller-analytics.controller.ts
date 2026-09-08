import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUserId } from '../auth/decorators/current-user.decorator';
import { AnalyticsService } from './analytics.service';
import { AnalyticsListQueryDto, AnalyticsQueryDto } from './dto/analytics-query.dto';

/**
 * Session 42 — Seller-scoped analytics (SELLER role, read-only).
 * The caller is resolved to their own ACTIVE seller; every metric is restricted
 * to that seller's orders/slices/products via `requireSellerId`.
 */
@Controller('seller/analytics')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SellerAnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get('overview')
  @Roles('SELLER')
  async overview(@CurrentUserId() userId: string, @Query() q: AnalyticsQueryDto) {
    const sellerId = await this.analytics.requireSellerId(userId);
    return this.analytics.overview(q, sellerId);
  }

  @Get('trend')
  @Roles('SELLER')
  async trend(@CurrentUserId() userId: string, @Query() q: AnalyticsQueryDto) {
    const sellerId = await this.analytics.requireSellerId(userId);
    return this.analytics.trend(q, sellerId);
  }

  @Get('products')
  @Roles('SELLER')
  async products(@CurrentUserId() userId: string, @Query() q: AnalyticsListQueryDto) {
    const sellerId = await this.analytics.requireSellerId(userId);
    return this.analytics.products(q, sellerId);
  }
}
