import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { OrderService } from './order.service';
import { OrderListQuery } from './commerce.types';
import { CheckoutDto } from './dto/checkout.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUserId } from '../auth/decorators/current-user.decorator';

// Checkout + customer orders. All require authentication (orders are per-user).
@Controller()
@UseGuards(JwtAuthGuard)
export class CheckoutController {
  constructor(private readonly orders: OrderService) {}

  /** Preview server-authoritative totals for the current cart before placing. */
  @Get('checkout/preview')
  preview(@CurrentUserId() userId: string, @Query('cartId') cartId: string, @Query('couponCode') couponCode?: string) {
    return this.orders.preview(userId, cartId, couponCode);
  }

  /** Place an order from an active cart. Server computes all money values. */
  @Post('checkout')
  checkout(@CurrentUserId() userId: string, @Body() dto: CheckoutDto) {
    return this.orders.checkout(userId, dto);
  }

  @Get('orders')
  list(
    @CurrentUserId() userId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
  ) {
    return this.orders.listUserOrders(userId, {
      page: page !== undefined ? Number(page) : undefined,
      limit: limit !== undefined ? Number(limit) : undefined,
      status: status as OrderListQuery['status'],
    });
  }

  @Get('orders/:id')
  get(@CurrentUserId() userId: string, @Param('id') id: string) {
    return this.orders.getOrder(userId, id);
  }

  @Get('orders/:id/history')
  history(@CurrentUserId() userId: string, @Param('id') id: string) {
    return this.orders.orderHistory(userId, id);
  }

  @Post('orders/:id/cancel')
  cancel(@CurrentUserId() userId: string, @Param('id') id: string, @Body('reason') reason?: string) {
    return this.orders.cancelOrder(userId, id, reason);
  }
}
