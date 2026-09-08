import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { OrderService } from './order.service';
import { ReturnsService } from './returns.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

// Staff (OPERATOR/ADMIN) read queues for the operations console (Session 28).
// Actions are still driven by the existing per-id routes (fulfilment advance,
// return-ops decisions, ...); this surface only provides the queues/details the
// operator UI needs to know WHICH order/return to act on.
@Controller('ops')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OpsController {
  constructor(
    private readonly orderService: OrderService,
    private readonly returnService: ReturnsService,
  ) {}

  @Get('orders')
  @Roles('OPERATOR', 'ADMIN')
  orderQueue(
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.orderService.listOrders({
      status: (status as never) || undefined,
      page: page !== undefined ? Number(page) : undefined,
      limit: limit !== undefined ? Number(limit) : undefined,
    });
  }

  @Get('orders/:orderId')
  @Roles('OPERATOR', 'ADMIN')
  orderDetail(@Param('orderId') orderId: string) {
    return this.orderService.getOrderStaff(orderId);
  }

  @Get('returns')
  @Roles('OPERATOR', 'ADMIN')
  returnQueue(
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.returnService.listReturnsStaff({
      status,
      page: page !== undefined ? Number(page) : undefined,
      limit: limit !== undefined ? Number(limit) : undefined,
    });
  }

  @Get('returns/:returnRequestId')
  @Roles('OPERATOR', 'ADMIN')
  returnDetail(@Param('returnRequestId') returnRequestId: string) {
    return this.returnService.getReturnStaff(returnRequestId);
  }
}
