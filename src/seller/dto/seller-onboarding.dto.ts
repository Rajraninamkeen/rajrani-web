import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import {
  ReviewDecision,
  SellerDocumentType,
  SellerStatus,
} from '../../generated/prisma/client';

const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]{3}$/;
const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/;

/** Applicant (seller owner) fills business/KYC profile on their current application. */
export class UpdateSellerProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  businessName?: string;

  @IsOptional()
  @Matches(GSTIN_RE, { message: 'Enter a valid GSTIN' })
  gstin?: string;

  @IsOptional()
  @Matches(/^[A-Z]{5}[0-9]{4}[A-Z]$/, { message: 'Enter a valid PAN' })
  pan?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  businessAddress?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  city?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  state?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  bankAccountHolder?: string;

  @IsOptional()
  @Matches(/^\d{4}$/, { message: 'bankAccountLast4 must be the last 4 digits' })
  bankAccountLast4?: string;

  @IsOptional()
  @Matches(IFSC_RE, { message: 'Enter a valid IFSC code' })
  bankIfsc?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  payoutPreference?: string;

  @IsOptional()
  @IsBoolean()
  agreedToTerms?: boolean;
}

export class AddSellerDocumentDto {
  @IsEnum(SellerDocumentType)
  documentType!: SellerDocumentType;

  @IsString()
  @MinLength(1)
  @MaxLength(300)
  storageObjectId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(255)
  fileName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  mimeType?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sizeBytes?: number;
}

export class ReviewSellerApplicationDto {
  @IsEnum(ReviewDecision)
  decision!: ReviewDecision;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

/** Operator-managed creation of a seller org (alternative to public self-registration). */
export class AdminCreateSellerDto {
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  legalName!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(200)
  businessName!: string;

  @IsOptional()
  @IsString()
  @Matches(/^SELL-[A-Z0-9]{6,}$/, { message: 'sellerCode must look like SELL-XXXXXX' })
  sellerCode?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10000)
  commissionRateBps?: number;

  // Optional: also create a SELLER-role operator bound to the new org.
  @IsOptional()
  @Matches(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, { message: 'operatorEmail must be a valid email' })
  operatorEmail?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  operatorFullName?: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  operatorPassword?: string;
}

export class VerifyDocumentDto {
  @IsBoolean()
  approved!: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class AdminSellerStatusDto {
  @IsEnum(SellerStatus)
  status!: SellerStatus;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class ApplicationListQuery {
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  sellerId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  limit?: number;
}
