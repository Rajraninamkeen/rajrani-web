import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { SellerOrderStatus } from '../../generated/prisma/client';

export class SellerOrderListQuery {
  @IsOptional()
  @IsEnum(SellerOrderStatus)
  status?: SellerOrderStatus;

  @IsOptional()
  page?: number;

  @IsOptional()
  limit?: number;
}

export class RejectSellerOrderDto {
  @IsString()
  @MaxLength(500)
  reason!: string;
}

export class ResolveRejectedSliceDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
