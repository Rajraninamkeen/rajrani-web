import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ReviewsService } from './reviews.service';
import { ReviewsController } from './reviews.controller';
import { ReviewModerationController } from './review-moderation.controller';
import { PublicReviewsController } from './public-reviews.controller';

@Module({
  imports: [AuthModule],
  controllers: [ReviewsController, ReviewModerationController, PublicReviewsController],
  providers: [ReviewsService],
  exports: [ReviewsService],
})
export class ReviewsModule {}
