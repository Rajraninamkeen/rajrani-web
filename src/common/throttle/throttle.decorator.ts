import { SetMetadata, applyDecorators } from '@nestjs/common';

/** Metadata keys read by {@link ThrottleGuard}. */
export const THROTTLE_LIMIT = 'throttle.limit';
export const THROTTLE_WINDOW = 'throttle.window';

/**
 * Declare a rate limit for a handler: at most `limit` requests per
 * `windowSeconds` per (client IP + route). Applied with the guard, e.g.
 *
 *   @UseGuards(ThrottleGuard)
 *   @Throttle(8, 60)   // 8 requests / minute
 */
export function Throttle(limit: number, windowSeconds: number): MethodDecorator {
  return applyDecorators(
    SetMetadata(THROTTLE_LIMIT, limit),
    SetMetadata(THROTTLE_WINDOW, windowSeconds),
  );
}
