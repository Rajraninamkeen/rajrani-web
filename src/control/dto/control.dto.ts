import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsISO8601, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

/** Session 43 — Control Panel query/action contracts (OPERATOR/ADMIN). */

export class ControlUsersQueryDto {
  @IsOptional()
  @IsIn(['CUSTOMER', 'SELLER', 'OPERATOR', 'ADMIN', 'DELIVERY', 'REVIEWER'])
  role?: string;

  @IsOptional()
  @IsIn(['ACTIVE', 'SUSPENDED', 'CLOSED', 'PENDING_VERIFICATION'])
  status?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  q?: string; // email / fullName / phone prefix search

  @IsOptional()
  @Transform(({ value }) => (value === undefined || value === '' ? undefined : Number(value)))
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Transform(({ value }) => (value === undefined || value === '' ? undefined : Number(value)))
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;
}

export class ControlSessionsQueryDto {
  @IsOptional()
  @IsIn(['active', 'revoked', 'all'])
  scope?: 'active' | 'revoked' | 'all';

  @IsOptional()
  @IsString()
  @MaxLength(120)
  q?: string; // user email / name

  @IsOptional()
  @Transform(({ value }) => (value === undefined || value === '' ? undefined : Number(value)))
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Transform(({ value }) => (value === undefined || value === '' ? undefined : Number(value)))
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;
}

export class RevokeSessionDto {
  @IsString()
  @MaxLength(500)
  reason: string; // mandatory justification (Control-Panel spec §52)
}

export class RevokeAllSessionsDto {
  @IsString()
  @MaxLength(500)
  reason: string;
}

export class ControlSellersQueryDto {
  @IsOptional()
  @IsIn(['ACTIVE', 'SUSPENDED', 'PENDING', 'UNDER_REVIEW', 'APPROVED', 'REGISTERED', 'REJECTED', 'DEACTIVATED'])
  status?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  q?: string;
}

export class ControlAuditQueryDto {
  @IsOptional()
  @IsIn(['SESSION_REVOKE', 'SESSION_REVOKE_ALL', 'SELLER_SUSPEND', 'SELLER_ACTIVATE', 'USER_STATUS_CHANGE', 'CATALOG_OVERRIDE', 'PAYMENT_OVERRIDE', 'OTHER'])
  action?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  actorId?: string;

  @IsOptional()
  @IsISO8601()
  from?: string;

  @IsOptional()
  @IsISO8601()
  to?: string;

  @IsOptional()
  @Transform(({ value }) => (value === undefined || value === '' ? undefined : Number(value)))
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Transform(({ value }) => (value === undefined || value === '' ? undefined : Number(value)))
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number;
}
