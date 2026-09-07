import { Body, Controller, Delete, Get, Headers, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { CartService } from './cart.service';
import { AddCartItemDto, UpdateCartItemDto } from './dto/cart.dto';
import { CartContext } from './cart.service';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';

// Cart API (API-Spec §41). Supports both authenticated (JWT) and guest carts
// (X-Guest-Session-Id header). Auth is optional so guests can browse/cart.
@Controller('cart')
@UseGuards(OptionalJwtAuthGuard)
export class CartController {
  constructor(private readonly cart: CartService) {}

  private ctx(req: Request, guestSessionId?: string): CartContext {
    return { userId: (req as { auth?: { sub?: string } }).auth?.sub, guestSessionId };
  }

  @Get()
  get(@Req() req: Request, @Headers('x-guest-session-id') g?: string) {
    return this.cart.get(this.ctx(req, g));
  }

  @Post('items')
  add(@Req() req: Request, @Headers('x-guest-session-id') g: string | undefined, @Body() dto: AddCartItemDto) {
    return this.cart.addItem(this.ctx(req, g), dto);
  }

  @Patch('items/:id')
  update(@Req() req: Request, @Headers('x-guest-session-id') g: string | undefined, @Param('id') id: string, @Body() dto: UpdateCartItemDto) {
    return this.cart.updateItem(this.ctx(req, g), id, dto);
  }

  @Delete('items/:id')
  remove(@Req() req: Request, @Headers('x-guest-session-id') g: string | undefined, @Param('id') id: string) {
    return this.cart.removeItem(this.ctx(req, g), id);
  }

  @Delete()
  clear(@Req() req: Request, @Headers('x-guest-session-id') g?: string) {
    return this.cart.clear(this.ctx(req, g));
  }
}
