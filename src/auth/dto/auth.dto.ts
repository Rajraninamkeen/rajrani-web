import {
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  IsStrongPassword,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @IsEmail({}, { message: 'A valid email is required' })
  email!: string;

  @IsString()
  @IsStrongPassword(
    { minLength: 8, minLowercase: 1, minUppercase: 1, minNumbers: 1, minSymbols: 0 },
    { message: 'Password must be at least 8 chars with 1 uppercase, 1 lowercase, 1 number' },
  )
  password!: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  fullName?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[6-9]\d{9}$/, { message: 'Enter a valid 10-digit Indian mobile number' })
  phone?: string;
}

export class LoginDto {
  @IsEmail({}, { message: 'A valid email is required' })
  email!: string;

  @IsString()
  @MinLength(1)
  password!: string;
}

export class SellerRegisterDto extends RegisterDto {
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  legalName!: string; // legal / registered business name

  @IsString()
  @MinLength(2)
  @MaxLength(200)
  businessName!: string; // display name / brand

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10000)
  commissionRateBps?: number;

  @IsOptional()
  @IsString()
  @MaxLength(15)
  gstin?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  pan?: string;
}

export class RefreshDto {
  @IsString()
  @MinLength(20)
  refreshToken!: string;
}
