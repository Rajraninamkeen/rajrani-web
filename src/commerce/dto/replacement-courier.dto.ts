import { IsString, MaxLength } from 'class-validator';

// Session 22 — replacement courier last-mile DTOs.

/** OPERATOR/ADMIN assign a dispatched replacement to a DELIVERY partner. */
export class AssignReplacementCourierDto {
  @IsString()
  deliveryPartnerId: string;
}

/** DELIVERY partner rejects an assigned replacement task. */
export class RejectReplacementDto {
  @IsString()
  @MaxLength(300)
  reason: string;
}

/** DELIVERY partner reports a failed replacement delivery attempt. */
export class FailReplacementDto {
  @IsString()
  @MaxLength(300)
  reason: string;
}
