import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsOptional, IsString, Length, Matches, MaxLength } from 'class-validator';

const ADDRESS_TYPES = ['HOME', 'WORK', 'OTHER'] as const;

export class AddressDto {
  @IsOptional()
  @IsIn(ADDRESS_TYPES)
  type?: 'HOME' | 'WORK' | 'OTHER';

  @IsOptional()
  @IsString()
  @MaxLength(40)
  label?: string;

  @IsString()
  @MaxLength(180)
  line1!: string;

  @IsOptional()
  @IsString()
  @MaxLength(180)
  line2?: string;

  @IsString()
  @MaxLength(80)
  city!: string;

  @IsString()
  @MaxLength(80)
  state!: string;

  @IsString()
  @Matches(/^[1-9][0-9]{5}$/, { message: 'pincode must be a 6-digit Indian pincode' })
  pincode!: string;

  @IsOptional()
  @IsString()
  @Length(1, 60)
  country?: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class UpdateAddressDto {
  @IsOptional()
  @IsIn(ADDRESS_TYPES)
  type?: 'HOME' | 'WORK' | 'OTHER';

  @IsOptional()
  @IsString()
  @MaxLength(40)
  label?: string;

  @IsOptional()
  @IsString()
  @MaxLength(180)
  line1?: string;

  @IsOptional()
  @IsString()
  @MaxLength(180)
  line2?: string;

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
  @Matches(/^[1-9][0-9]{5}$/, { message: 'pincode must be a 6-digit Indian pincode' })
  pincode?: string;

  @IsOptional()
  @IsString()
  @Length(1, 60)
  country?: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
