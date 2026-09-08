import { HttpException, HttpStatus } from '@nestjs/common';
import { ThrottleGuard } from './throttle.guard';

function fakeReflector(limit: number, window: number) {
  return {
    get: (key: string) => (key === 'throttle.limit' ? limit : key === 'throttle.window' ? window : undefined),
  } as any;
}

function context(overrides: Record<string, unknown> = {}) {
  const req = { ip: '1.2.3.4', method: 'POST', originalUrl: '/api/v1/auth/login', ...overrides };
  return {
    getHandler: () => ({}),
    switchToHttp: () => ({ getRequest: () => req }),
  } as any;
}

describe('ThrottleGuard', () => {
  it('allows requests up to the configured limit', () => {
    const g = new ThrottleGuard(fakeReflector(3, 60));
    for (let i = 0; i < 3; i++) {
      expect(g.canActivate(context())).toBe(true);
    }
  });

  it('rejects with 429 once the limit is exceeded', () => {
    const g = new ThrottleGuard(fakeReflector(2, 60));
    g.canActivate(context());
    g.canActivate(context());
    expect(() => g.canActivate(context())).toThrow(
      new HttpException('Too many requests', HttpStatus.TOO_MANY_REQUESTS),
    );
  });

  it('separates limits per client IP and route', () => {
    const g = new ThrottleGuard(fakeReflector(1, 60));
    expect(g.canActivate(context())).toBe(true);
    // Different IP is not limited.
    expect(g.canActivate(context({ ip: '5.6.7.8' }))).toBe(true);
    // Different route is not limited.
    expect(g.canActivate(context({ originalUrl: '/api/v1/auth/refresh' }))).toBe(true);
    // Same IP+route again is now limited.
    expect(() => g.canActivate(context())).toThrow(HttpException);
  });
});
