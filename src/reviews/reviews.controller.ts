import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUserId } from '../auth/decorators/current-user.decorator';
import { ReviewsService } from './reviews.service';
import { CreateReviewDto, MyReviewsQuery, UpdateReviewDto } from './dto/reviews.dto';

// Customer review authoring. The reviewer must have received the product on a
// DELIVERED order (verified purchase). Ownership is enforced in the service.
@Controller('reviews')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Post()
  @Roles('CUSTOMER')
  create(@CurrentUserId() userId: string, @Body() dto: CreateReviewDto) {
    return this.reviews.create(userId, dto.productId, dto.rating, dto.title, dto.comment);
  }

  @Get('me')
  @Roles('CUSTOMER')
  mine(@CurrentUserId() userId: string, @Query() query: MyReviewsQuery) {
    return this.reviews.listMine(userId, query.status);
  }

  @Get(':reviewId')
  @Roles('CUSTOMER')
  detail(@CurrentUserId() userId: string, @Param('reviewId') reviewId: string) {
    return this.reviews.getOwn(userId, reviewId);
  }

  @Patch(':reviewId')
  @Roles('CUSTOMER')
  update(@CurrentUserId() userId: string, @Param('reviewId') reviewId: string, @Body() dto: UpdateReviewDto) {
    return this.reviews.update(userId, reviewId, dto.rating, dto.title, dto.comment);
  }

  @Delete(':reviewId')
  @Roles('CUSTOMER')
  remove(@CurrentUserId() userId: string, @Param('reviewId') reviewId: string) {
    return this.reviews.remove(userId, reviewId);
  }
}
