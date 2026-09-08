import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUserId } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CourierPayoutService } from './courier-payout.service';
import { CourierSettleDto } from './delivery.dto';

/**
 * Session 32 — courier delivery-fee payout (money leg).
 *
 * DELIVERY partners read their own earnings; OPERATOR/ADMIN list all courier payouts
 * and pay a partner's EARNED payouts out (EARNED → SETTLED).
 */

// DELIVERY partner self-service (base '/delivery/payouts').
@Controller('delivery/payouts')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CourierPartnerPayoutController {
  constructor(private readonly payouts: CourierPayoutService) {}

  @Get()
  @Roles('DELIVERY')
  mine(@CurrentUserId() userId: string, @Query() query: any) {
    return this.payouts.partnerPayouts(userId, {
      status: query?.status,
      page: query?.page,
      limit: query?.limit,
    });
  }
}

// Back-office (base '/delivery/payouts').
@Controller('delivery/payouts')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CourierPayoutAdminController {
  constructor(private readonly payouts: CourierPayoutService) {}

  @Get('all')
  @Roles('OPERATOR', 'ADMIN')
  list(@Query() query: any) {
    return this.payouts.staffList({
      status: query?.status,
      deliveryPartnerId: query?.deliveryPartnerId,
      kind: query?.kind,
      page: query?.page,
      limit: query?.limit,
    });
  }

  @Get('summary')
  @Roles('OPERATOR', 'ADMIN')
  summary() {
    return this.payouts.staffSummary();
  }

  @Post('settle')
  @Roles('OPERATOR', 'ADMIN')
  settle(@CurrentUserId() actorId: string, @Body() dto: CourierSettleDto) {
    return this.payouts.settlePartnerEarned(actorId, dto.deliveryPartnerId);
  }
}
