import { IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { DeliveryAssignmentStatus, DeliveryPartnerStatus } from '../generated/prisma/client';

export class RegisterDeliveryPartnerDto {
  @IsString()
  userId: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  partnerCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  vehicleType?: string;
}

export class AssignSliceDto {
  @IsString()
  deliveryPartnerId: string;
}

export class RejectAssignmentDto {
  @IsString()
  @MaxLength(300)
  reason: string;
}

export class FailAssignmentDto {
  @IsString()
  @MaxLength(300)
  reason: string;
}

export class DeliveryListQuery {
  @IsOptional()
  @IsEnum(DeliveryAssignmentStatus)
  status?: DeliveryAssignmentStatus;

  @IsOptional()
  @IsString()
  deliveryPartnerId?: string;

  @IsOptional()
  @IsString()
  orderId?: string;

  @IsOptional()
  @IsString()
  sellerOrderId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class SetPartnerStatusDto {
  @IsEnum(DeliveryPartnerStatus)
  status: DeliveryPartnerStatus;
}

// Session 32 — courier payout settle request (back-office).
export class CourierSettleDto {
  @IsString()
  deliveryPartnerId: string;
}
