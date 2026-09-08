import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUserId } from '../auth/decorators/current-user.decorator';
import { ReviewsService } from './reviews.service';
import { ModerateReviewDto, RejectReviewDto, ReviewModerationQuery } from './dto/reviews.dto';

// Staff moderation surface (product-content moderation, matching the Session 20
// catalog-publishing staff role split: OPERATOR/ADMIN; REVIEWER stays KYC-only).
@Controller('product-reviews')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReviewModerationController {
  constructor(private readonly reviews: ReviewsService) {}

  @Get()
  @Roles('OPERATOR', 'ADMIN')
  list(@Query() query: ReviewModerationQuery) {
    return this.reviews.moderationList(query.status);
  }

  @Get(':reviewId')
  @Roles('OPERATOR', 'ADMIN')
  detail(@Param('reviewId') reviewId: string) {
    return this.reviews.moderationDetail(reviewId);
  }

  @Post(':reviewId/approve')
  @Roles('OPERATOR', 'ADMIN')
  approve(@CurrentUserId() userId: string, @Param('reviewId') reviewId: string, @Body() dto: ModerateReviewDto) {
    return this.reviews.approve(userId, reviewId, dto.note);
  }

  @Post(':reviewId/reject')
  @Roles('OPERATOR', 'ADMIN')
  reject(@CurrentUserId() userId: string, @Param('reviewId') reviewId: string, @Body() dto: RejectReviewDto) {
    return this.reviews.reject(userId, reviewId, dto.reason);
  }

  @Post(':reviewId/hide')
  @Roles('OPERATOR', 'ADMIN')
  hide(@CurrentUserId() userId: string, @Param('reviewId') reviewId: string, @Body() dto: ModerateReviewDto) {
    return this.reviews.hide(userId, reviewId, dto.note);
  }

  @Post(':reviewId/unhide')
  @Roles('OPERATOR', 'ADMIN')
  unhide(@CurrentUserId() userId: string, @Param('reviewId') reviewId: string, @Body() dto: ModerateReviewDto) {
    return this.reviews.unhide(userId, reviewId, dto.note);
  }
}
