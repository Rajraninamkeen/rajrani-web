import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { SettlementService } from './settlement.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUserId } from '../auth/decorators/current-user.decorator';
import {
  PayableAdjustmentDto,
  PayableListQuery,
  ReconciliationReportQuery,
  SettlementAdvanceDto,
  SettlementCreateDto,
  SettlementListQuery,
} from './dto/finance.dto';

// Finance / settlement operations — internal operator surface (Session 12).
@Controller('finance')
@UseGuards(JwtAuthGuard, RolesGuard)
export class FinanceOpsController {
  constructor(private readonly svc: SettlementService) {}

  @Get('payables')
  @Roles('OPERATOR', 'ADMIN')
  async payables(@Query() query: PayableListQuery) {
    return this.svc.listPayables(query);
  }

  @Get('payables/:payableId')
  @Roles('OPERATOR', 'ADMIN')
  async payable(@Param('payableId') id: string) {
    return this.svc.getPayable(id);
  }

  @Post('payables/:payableId/adjustments')
  @Roles('OPERATOR', 'ADMIN')
  async adjust(
    @CurrentUserId() userId: string,
    @Param('payableId') id: string,
    @Body() dto: PayableAdjustmentDto,
  ) {
    return this.svc.addAdjustment(userId, id, dto.amount, dto.reason);
  }

  @Get('settlements')
  @Roles('OPERATOR', 'ADMIN')
  async settlements(@Query() query: SettlementListQuery) {
    return this.svc.listSettlements(query);
  }

  @Get('settlements/:settlementId')
  @Roles('OPERATOR', 'ADMIN')
  async settlement(@Param('settlementId') id: string) {
    return this.svc.getSettlement(id);
  }

  @Post('settlements')
  @Roles('OPERATOR', 'ADMIN')
  async create(@CurrentUserId() userId: string, @Body() dto: SettlementCreateDto) {
    return this.svc.createSettlement(userId, dto);
  }

  @Post('settlements/:settlementId/advance')
  @Roles('OPERATOR', 'ADMIN')
  async advance(
    @CurrentUserId() userId: string,
    @Param('settlementId') id: string,
    @Body() dto: SettlementAdvanceDto,
  ) {
    return this.svc.advanceSettlement(userId, id, dto.toStatus, dto.reason);
  }

  @Get('reconciliation/summary')
  @Roles('OPERATOR', 'ADMIN')
  async reconciliation() {
    return this.svc.runReconciliation();
  }

  @Get('report/totals')
  @Roles('OPERATOR', 'ADMIN')
  async reportTotals(@Query() query: ReconciliationReportQuery) {
    return this.svc.reportTotals(query);
  }
}

// Seller-facing view of their own earned payables & settlements.
@Controller('seller')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SellerSettlementController {
  constructor(private readonly svc: SettlementService) {}

  @Get('payables')
  @Roles('SELLER')
  async myPayables(@CurrentUserId() userId: string, @Query() query: PayableListQuery) {
    return this.svc.myPayables(userId, query);
  }

  @Get('settlements')
  @Roles('SELLER')
  async mySettlements(@CurrentUserId() userId: string, @Query() query: SettlementListQuery) {
    return this.svc.mySettlements(userId, query);
  }

  @Get('settlements/:settlementId')
  @Roles('SELLER')
  async mySettlement(@CurrentUserId() userId: string, @Param('settlementId') id: string) {
    return this.svc.mySettlement(userId, id);
  }
}
