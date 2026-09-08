import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { THROTTLE_LIMIT, THROTTLE_WINDOW } from './throttle.decorator';

/**
 * Minimal in-memory sliding-window rate limiter.
 *
 * Applied to credential- and account-creation endpoints (login, register,
 * refresh, COD OTP) to blunt brute force / account-takeover attempts. Limits
 * are per (client IP + route). Storage is per-process and non-persistent —
 * fine for a single-instance deployment; a shared (Redis) store should
 * replace it if the API is scaled horizontally.
 *
 * Guard returns HTTP 429 when the limit is exceeded.
 */
@Injectable()
export class ThrottleGuard implements CanActivate {
  private readonly store = new Map<string, number[]>();
  // Bounded cleanup: when the map grows large we drop old buckets eagerly.
  private readonly MAX_ENTRIES = 10_000;

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const limit = this.reflector.get<number>(THROTTLE_LIMIT, context.getHandler()) ?? 20;
    const windowSeconds =
      this.reflector.get<number>(THROTTLE_WINDOW, context.getHandler()) ?? 60;

    const ip = (req.ip as string) || (req.connection?.remoteAddress as string) || 'unknown';
    const route = (req.originalUrl || req.url || '').split('?')[0];
    const key = `${ip}|${req.method}|${route}`;

    const now = Date.now();
    const windowMs = windowSeconds * 1000;

    if (this.store.size > this.MAX_ENTRIES) this.store.clear();

    const hits = (this.store.get(key) ?? []).filter((t) => now - t < windowMs);
    if (hits.length >= limit) {
      throw new HttpException('Too many requests', HttpStatus.TOO_MANY_REQUESTS);
    }
    hits.push(now);
    this.store.set(key, hits);
    return true;
  }
}
