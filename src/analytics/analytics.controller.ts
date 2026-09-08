import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AnalyticsService } from './analytics.service';
import { AnalyticsListQueryDto, AnalyticsQueryDto } from './dto/analytics-query.dto';

/**
 * Session 42 — Platform-wide business analytics (OPERATOR/ADMIN, read-only).
 * Every metric is derived live from the transactional OLTP tables (source of
 * truth); nothing here writes. SELLERs are not permitted on this global surface
 * (they get the scoped /seller/analytics routes instead).
 */
@Controller('analytics')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get('overview')
  @Roles('OPERATOR', 'ADMIN')
  overview(@Query() q: AnalyticsQueryDto) {
    return this.analytics.overview(q);
  }

  @Get('trend')
  @Roles('OPERATOR', 'ADMIN')
  trend(@Query() q: AnalyticsQueryDto) {
    return this.analytics.trend(q);
  }

  @Get('products')
  @Roles('OPERATOR', 'ADMIN')
  products(@Query() q: AnalyticsListQueryDto) {
    return this.analytics.products(q);
  }

  @Get('categories')
  @Roles('OPERATOR', 'ADMIN')
  categories(@Query() q: AnalyticsQueryDto) {
    return this.analytics.categories(q);
  }

  @Get('sellers')
  @Roles('OPERATOR', 'ADMIN')
  sellers(@Query() q: AnalyticsQueryDto) {
    return this.analytics.sellers(q);
  }
}
