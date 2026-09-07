import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { SellerOpsService } from './seller-ops.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUserId } from '../auth/decorators/current-user.decorator';
import { RejectSellerOrderDto, SellerOrderListQuery } from './dto/seller.dto';

// Seller-ops surface (Session 09 split-checkout). Scoped to the caller's seller.
@Controller('seller')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SellerOpsController {
  constructor(private readonly sellerOps: SellerOpsService) {}

  @Get('me')
  @Roles('SELLER')
  async me(@CurrentUserId() userId: string) {
    return this.sellerOps.mySeller(userId);
  }

  @Get('products')
  @Roles('SELLER')
  async products(@CurrentUserId() userId: string) {
    return this.sellerOps.myProducts(userId);
  }

  @Get('orders')
  @Roles('SELLER')
  async orders(@CurrentUserId() userId: string, @Query() query: SellerOrderListQuery) {
    return this.sellerOps.listSellerOrders(userId, query);
  }

  @Get('orders/:sellerOrderId')
  @Roles('SELLER')
  async order(@CurrentUserId() userId: string, @Param('sellerOrderId') id: string) {
    return this.sellerOps.getSellerOrder(userId, id);
  }

  @Post('orders/:sellerOrderId/accept')
  @Roles('SELLER')
  async accept(@CurrentUserId() userId: string, @Param('sellerOrderId') id: string) {
    return this.sellerOps.accept(userId, id);
  }

  @Post('orders/:sellerOrderId/reject')
  @Roles('SELLER')
  async reject(
    @CurrentUserId() userId: string,
    @Param('sellerOrderId') id: string,
    @Body() dto: RejectSellerOrderDto,
  ) {
    return this.sellerOps.reject(userId, id, dto.reason);
  }
}
