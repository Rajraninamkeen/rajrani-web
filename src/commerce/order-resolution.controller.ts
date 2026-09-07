import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { OrderService } from './order.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUserId } from '../auth/decorators/current-user.decorator';
import { ResolveRejectedSliceDto } from './dto/seller.dto';

// Operator action for partial-fulfilment resolution of a rejected seller slice
// (Session 11). Order-level operators decide; the endpoint is OPERATOR/ADMIN.
@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class OrderResolutionController {
  constructor(private readonly orders: OrderService) {}

  @Post('orders/:orderId/slices/:sellerOrderId/resolve-reject')
  @Roles('OPERATOR', 'ADMIN')
  resolveRejected(
    @CurrentUserId() operatorId: string,
    @Param('orderId') orderId: string,
    @Param('sellerOrderId') sellerOrderId: string,
    @Body() dto: ResolveRejectedSliceDto,
  ) {
    return this.orders.resolveRejectedSlice(operatorId, orderId, sellerOrderId, dto.reason);
  }
}
