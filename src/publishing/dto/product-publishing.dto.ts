import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class ProductMediaInput {
  @IsString()
  url!: string;

  @IsOptional()
  @IsString()
  altText?: string;

  @IsOptional()
  @IsIn(['IMAGE', 'VIDEO'])
  kind?: 'IMAGE' | 'VIDEO';

  @IsOptional()
  @IsNumber()
  sortOrder?: number;
}

// Seller authored product listing (DRAFT). Core sellable fields only; variants
// and media are optional / storage-intent.
export class CreateProductDto {
  @IsString()
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @IsString()
  slug?: string;

  @IsString()
  categoryId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  tagline?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  brand?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  regionOrigin?: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  basePrice!: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  originalPrice?: number;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  weightLabel?: string;

  @IsOptional()
  @IsIn(['MILD', 'MEDIUM', 'SPICY', 'FIERY'])
  spiceLevel?: 'MILD' | 'MEDIUM' | 'SPICY' | 'FIERY';

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(30)
  ingredients?: string[];

  @IsOptional()
  @IsObject()
  nutritional?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  pairingSuggestion?: string;

  @IsOptional()
  @IsBoolean()
  isBestseller?: boolean;

  @IsOptional()
  @IsBoolean()
  isNew?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  stockOnHand?: number;

  @IsOptional()
  @IsIn(['IN_STOCK', 'LOW_STOCK', 'OUT_OF_STOCK'])
  stockStatus?: 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK';

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  media?: ProductMediaInput[];
}

export class UpdateProductDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  slug?: string;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  tagline?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  brand?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  regionOrigin?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  basePrice?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  originalPrice?: number;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  weightLabel?: string;

  @IsOptional()
  @IsIn(['MILD', 'MEDIUM', 'SPICY', 'FIERY'])
  spiceLevel?: 'MILD' | 'MEDIUM' | 'SPICY' | 'FIERY';

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(30)
  ingredients?: string[];

  @IsOptional()
  @IsObject()
  nutritional?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  pairingSuggestion?: string;

  @IsOptional()
  @IsBoolean()
  isBestseller?: boolean;

  @IsOptional()
  @IsBoolean()
  isNew?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  stockOnHand?: number;

  @IsOptional()
  @IsIn(['IN_STOCK', 'LOW_STOCK', 'OUT_OF_STOCK'])
  stockStatus?: 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK';

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  media?: ProductMediaInput[];
}

export class ProductListQuery {
  @IsOptional()
  @IsIn(['DRAFT', 'PENDING_REVIEW', 'APPROVED', 'REJECTED', 'ARCHIVED'])
  status?: string;
}

export class ApproveProductDto {
  @IsOptional()
  @IsString()
  note?: string;
}

export class RejectProductDto {
  @IsString()
  @MaxLength(500)
  reason!: string;
}
