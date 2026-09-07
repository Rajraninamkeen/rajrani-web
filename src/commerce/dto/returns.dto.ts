import { IsArray, IsBoolean, IsEnum, IsInt, IsOptional, IsString, MaxLength, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { InspectionResult, ReturnReasonCode } from '../../generated/prisma/client';

export class ReturnRequestItemDto {
  @IsString()
  orderItemId!: string;

  @IsInt()
  @Min(1)
  quantity!: number;
}

export class CreateReturnDto {
  @IsEnum(ReturnReasonCode)
  reasonCode!: ReturnReasonCode;

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
