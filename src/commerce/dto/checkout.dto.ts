import { Type } from 'class-transformer';
import {
  IsEnum,
  IsNotEmptyObject,
  IsObject,
  IsOptional,
  IsString,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { PaymentMethod } from '../../generated/prisma/client';
import { AddressInput } from '../commerce.types';

class AddressInputDto implements AddressInput {
  @IsString() @MinLength(2) name!: string;
  @IsString() @MinLength(10) phone!: string;
  @IsString() @MinLength(3) line1!: string;
  @IsOptional() @IsString() line2?: string;
  @IsString() @MinLength(2) city!: string;
  @IsString() @MinLength(2) state!: string;
  @IsString() @MinLength(6) pincode!: string;
  @IsOptional() @IsString() country?: string;
}

export class CheckoutDto {
  // Cart ids are cuid strings (DB `@default(cuid())`), not UUIDs.
  @IsString()
  @MinLength(8)
  cartId!: string;

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
}
