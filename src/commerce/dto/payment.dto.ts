import {
  IsEnum,
  IsInt,
  IsNotEmptyObject,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PaymentMethod } from '../../generated/prisma/client';
import { AddressInputDto } from './checkout.dto';

/** Direct (no-cart) buy-now order. Mirrors checkout but from a single product. */
export class BuyNowDto {
  @IsString()
  productId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(99)
  quantity!: number;

  @IsObject()
  @IsNotEmptyObject()
  @ValidateNested()
  @Type(() => AddressInputDto)
  address!: AddressInputDto;

  @IsOptional()
  @IsString()
  couponCode?: string;

  @IsEnum(PaymentMethod)
  paymentMethod!: PaymentMethod;

  @IsOptional()
  @IsString()
  @Matches(/^[6-9]\d{9}$/, { message: 'Enter a valid 10-digit Indian mobile number' })
  secondaryContact?: string;
}

/** Inbound (sandbox) gateway webhook/confirm payload. Signed. */
export class SandboxWebhookDto {
  @IsString() @MinLength(8) providerEventId!: string;
  @IsString() @MinLength(8) paymentReference!: string;
  @IsString() eventType!: 'payment.captured' | 'payment.failed';
  @Type(() => Number) @IsInt() @Min(0) amount!: number;
  @IsString() timestamp!: string;
  @IsString() signature!: string;
}

export class CodOtpDto {
  @IsString()
  @Matches(/^[6-9]\d{9}$/, { message: 'Enter a valid 10-digit Indian mobile number' })
  secondaryContact!: string;
}

export class CodVerifyDto {
  @IsString()
  @MinLength(6)
  @MaxLength(6)
  @Matches(/^\d{6}$/, { message: 'Enter the 6-digit OTP' })
  code!: string;
}
