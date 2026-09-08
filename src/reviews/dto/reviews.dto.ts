import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class CreateReviewDto {
  @IsString()
  productId!: string;

  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comment?: string;
}

export class UpdateReviewDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  rating?: number;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comment?: string;
}

export class MyReviewsQuery {
  @IsOptional()
  @IsIn(['PENDING', 'PUBLISHED', 'REJECTED', 'HIDDEN'])
  status?: string;
}

export class PublicReviewsQuery {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}

export class ReviewModerationQuery {
  @IsOptional()
  @IsIn(['PENDING', 'PUBLISHED', 'REJECTED', 'HIDDEN'])
  status?: string;
}

export class ModerateReviewDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class RejectReviewDto {
  @IsString()
  @MaxLength(500)
  reason!: string;
}
