import { IsBoolean, IsEnum, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ReturnReasonCode } from '../../generated/prisma/client';

export class CreateReturnDto {
  @IsEnum(ReturnReasonCode)
  reasonCode!: ReturnReasonCode;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class ReturnDecisionDto {
  @IsBoolean()
  approve!: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  reason?: string;
}

export class InitiateRefundDto {
  /** Optional explicit refund amount; omitted => full order grand total. */
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount?: number;
}
