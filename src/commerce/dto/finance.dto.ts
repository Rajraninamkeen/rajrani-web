import {
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ArrayNotEmpty,
} from 'class-validator';
import { SettlementStatus } from '../../generated/prisma/client';

export class PayableListQuery {
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  sellerId?: string;

  @IsOptional()
  page?: number;

  @IsOptional()
  limit?: number;
}

export class PayableAdjustmentDto {
  @IsNumber()
  amount!: number; // signed; negative reduces the seller's net

  @IsString()
  @MaxLength(500)
  reason!: string;
}

export class SettlementListQuery {
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  sellerId?: string;

  @IsOptional()
  page?: number;

  @IsOptional()
  limit?: number;
}

export class SettlementCreateDto {
  @IsString()
  sellerId!: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  payableIds!: string[];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class SettlementAdvanceDto {
  @IsEnum(SettlementStatus)
  toStatus!: SettlementStatus;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class AmountQuery {
  @IsOptional()
  @Min(0)
  page?: number;

  @IsOptional()
  @Min(0)
  limit?: number;
}
