import { Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUserId } from '../auth/decorators/current-user.decorator';
import { WishlistService } from './wishlist.service';

@Controller('wishlist')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('CUSTOMER')
export class WishlistController {
  constructor(private readonly wishlist: WishlistService) {}

  @Get()
  list(@CurrentUserId() userId: string) {
    return this.wishlist.list(userId);
  }

  @Get('ids')
  savedIds(@CurrentUserId() userId: string) {
    return this.wishlist.savedIds(userId);
  }

  @Post(':productId')
  add(@CurrentUserId() userId: string, @Param('productId') productId: string) {
    return this.wishlist.add(userId, productId);
  }

  @Delete(':productId')
  remove(@CurrentUserId() userId: string, @Param('productId') productId: string) {
    return this.wishlist.remove(userId, productId);
  }
}
