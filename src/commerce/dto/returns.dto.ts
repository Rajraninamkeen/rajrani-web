import { IsArray, IsBoolean, IsEnum, IsInt, IsOptional, IsString, MaxLength, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { InspectionResult, ReturnReasonCode, ReturnResolution } from '../../generated/prisma/client';

export class ReturnRequestItemDto {
  @IsString()
  orderItemId!: string;

  @IsInt()
  @Min(1)
  quantity!: number;
}

/** A customer-supplied evidence object reference (photo/video). Storage-intent
 *  only: an object key/id, never the raw file bytes (backend stores no binary). */
export class EvidenceUploadDto {
  @IsString()
  storageObjectId!: string;

  @IsOptional()
  @IsString()
  fileName?: string;

  @IsOptional()
  @IsString()
  mimeType?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sizeBytes?: number;

  @IsOptional()
  @IsString()
  kind?: string; // IMAGE | VIDEO (defaults IMAGE)
}

export class CreateReturnDto {
  @IsEnum(ReturnReasonCode)
  reasonCode!: ReturnReasonCode;

  /** Desired remedy: REFUND (default) or REPLACEMENT (exchange). */
  @IsOptional()
  @IsEnum(ReturnResolution)
  resolution?: ReturnResolution;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;

  /** Which order items (and quantities) to return. Omit => return every line fully. */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReturnRequestItemDto)
  items?: ReturnRequestItemDto[];

  /** Evidence (photos) supplied alongside the request. */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EvidenceUploadDto)
  evidence?: EvidenceUploadDto[];
}

export class ReturnDecisionDto {
  @IsBoolean()
  approve!: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  reason?: string;
}

export class InspectionItemDto {
  @IsString()
  returnItemId!: string;

  @IsEnum(InspectionResult)
  result!: InspectionResult;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class InspectionDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InspectionItemDto)
  items!: InspectionItemDto[];
}
