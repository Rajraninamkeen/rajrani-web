import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { CurrentUserId } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CourierTrackingService } from './courier-tracking.service';

/**
 * Session 31 — courier tracking-read surface.
 *
 * GET /orders/:id/tracking
 *  Live courier tracking (slice parcels + outbound replacement dispatches) for an
 *  order. The order OWNER (CUSTOMER) reads their own order; OPERATOR/ADMIN read any
 *  order (ownership enforced inside CourierTrackingService). Read-only, non-money.
 */
@Controller('orders')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OrderCourierTrackingController {
  constructor(private readonly tracking: CourierTrackingService) {}

  @Get(':id/tracking')
  @Roles('CUSTOMER', 'OPERATOR', 'ADMIN')
  orderTracking(@CurrentUserId() userId: string, @Param('id') orderId: string) {
    return this.tracking.trackOrder(userId, orderId);
  }
}
