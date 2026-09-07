import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

export class AddCartItemDto {
  @IsString()
  productId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(99)
  quantity!: number;
}

export class UpdateCartItemDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(99)
  quantity!: number;
}

// Guest cart: client supplies a secure opaque session id (>= 16 chars).
export class GuestHeaderDto {
  @IsOptional()
  @IsString()
  @IsUUID()
  guestSessionId?: string;
}
