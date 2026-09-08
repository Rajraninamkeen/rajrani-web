import { Controller, Get, Param, Query } from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import { PublicReviewsQuery } from './dto/reviews.dto';

// Public published-reviews read for a live product (identifier = id or slug).
// Only PUBLISHED reviews are returned; PENDING/REJECTED/HIDDEN are never shown.
// Auth is not required.
@Controller('catalog/products/:identifier/reviews')
export class PublicReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Get()
  list(@Param('identifier') identifier: string, @Query() query: PublicReviewsQuery) {
    return this.reviews.listPublished(identifier, query.page, query.limit);
  }
}
