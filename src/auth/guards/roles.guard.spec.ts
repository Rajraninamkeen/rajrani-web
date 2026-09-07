import { ForbiddenException } from '@nestjs/common';
import { RolesGuard } from './roles.guard';
import { ROLES } from '../auth.types';

function makeContext(role?: string) {
  const handler = () => undefined;
  const request = { auth: role ? { role, sub: 'u1' } : undefined };
  const context = {
    getHandler: () => handler,
    getClass: () => class {},
    switchToHttp: () => ({ getRequest: () => request }),
  };
  return context;
}

describe('RolesGuard', () => {
  it('allows when no roles are required', () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(undefined) };
    const guard = new RolesGuard(reflector as never);
    expect(guard.canActivate(makeContext('CUSTOMER') as never)).toBe(true);
  });

  it('allows a matching role', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue([ROLES.ADMIN, ROLES.CONTROL]),
    };
    const guard = new RolesGuard(reflector as never);
    expect(guard.canActivate(makeContext(ROLES.ADMIN) as never)).toBe(true);
  });

  it('throws ForbiddenException for a mismatched role', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue([ROLES.ADMIN]),
    };
    const guard = new RolesGuard(reflector as never);
    expect(() => guard.canActivate(makeContext(ROLES.CUSTOMER) as never)).toThrow(
      ForbiddenException,
    );
  });

  it('throws ForbiddenException when no authenticated role present', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue([ROLES.ADMIN]),
    };
    const guard = new RolesGuard(reflector as never);
    expect(() => guard.canActivate(makeContext() as never)).toThrow(ForbiddenException);
  });
});
