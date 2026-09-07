import { Body, Controller, Post, Query, UseGuards } from '@nestjs/common';
import { OrderService } from './order.service';
import { BuyNowDto } from './dto/payment.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUserId } from '../auth/decorators/current-user.decorator';

// Direct (no-cart) purchase — Master-Spec §29.
@Controller()
@UseGuards(JwtAuthGuard)
export class BuyNowController {
  constructor(private readonly orders: OrderService) {}

  @Post('buy-now/preview')
  preview(
    @CurrentUserId() _userId: string,
    @Query('productId') productId: string,
    @Query('quantity') quantity: string,
    @Query('couponCode') couponCode?: string,
  ) {
    return this.orders.quoteBuyNow(_userId, productId, Number(quantity) || 1, couponCode);
  }

  @Post('buy-now')
  buyNow(@CurrentUserId() userId: string, @Body() dto: BuyNowDto) {
    return this.orders.buyNow(userId, dto);
  }
}
