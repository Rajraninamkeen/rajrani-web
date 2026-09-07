import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { OrderStatus } from '../../generated/prisma/client';

export class AdvanceOrderDto {
  @IsEnum(OrderStatus)
  toStatus!: OrderStatus;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  reason?: string;
}
