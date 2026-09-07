import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { compare } from 'bcryptjs';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let prisma: {
    user: { findFirst: jest.Mock; findUnique: jest.Mock; create: jest.Mock };
    userSession: { create: jest.Mock; update: jest.Mock; updateMany: jest.Mock };
  };
  let service: AuthService;

  const existingUser = {
    id: 'user-1',
    email: 'taken@example.com',
    phone: null,
    fullName: 'Taken',
    passwordHash: '$2a$12$abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRST',
    status: 'ACTIVE',
    role: 'CUSTOMER',
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  beforeEach(() => {
    prisma = {
      user: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
      },
      userSession: {
        create: jest.fn().mockResolvedValue({ id: 's1' }),
        update: jest.fn().mockResolvedValue({ id: 's1' }),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    };

    const jwt = {
      signAsync: jest.fn().mockResolvedValue('signed-access-token'),
      verifyAsync: jest.fn(),
    } as unknown as JwtService;

    const config = {
      get: jest.fn((key: string) => {
        const map: Record<string, number | string> = {
          'jwt.accessSecret': 'test-access-secret',
          'jwt.accessTtl': 900,
          'jwt.refreshTtl': 1209600,
        };
        return map[key] ?? undefined;
      }),
    } as unknown as ConfigService;

    service = new AuthService(prisma as never, jwt, config);
  });

  it('registers a new user and hashes the password', async () => {
    prisma.user.findFirst.mockResolvedValue(null);
    const created = {
      id: 'user-new',
      email: 'new@example.com',
      phone: null,
      fullName: 'New',
      passwordHash: 'hashed',
      status: 'ACTIVE',
      role: 'CUSTOMER',
    };
    prisma.user.create.mockResolvedValue(created);

    const result = await service.register({
      email: 'NEW@example.com',
      password: 'Secret#123',
      fullName: 'New',
    });

    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: 'new@example.com',
          role: 'CUSTOMER',
        }),
      }),
    );
    // ensure the stored hash is actually bcrypt (not plaintext)
    const storedHash = prisma.user.create.mock.calls[0][0].data.passwordHash;
    expect(storedHash).not.toBe('Secret#123');
    expect(await compare('Secret#123', storedHash)).toBe(true);
    expect(result.user.role).toBe('CUSTOMER');
    expect(result.tokens.accessToken).toBe('signed-access-token');
    expect(result.tokens.refreshToken).toBeTruthy();
    // one session created for the refresh token
    expect(prisma.userSession.create).toHaveBeenCalledTimes(1);
  });

  it('rejects duplicate email on registration', async () => {
    prisma.user.findFirst.mockResolvedValue({ email: 'new@example.com', phone: null });
    await expect(
      service.register({ email: 'new@example.com', password: 'Secret#123' }),
    ).rejects.toThrow(ConflictException);
  });

  it('throws UnauthorizedException on wrong password', async () => {
    prisma.user.findUnique.mockResolvedValue({ ...existingUser });
    await expect(
      service.login({ email: 'taken@example.com', password: 'WrongPass1' }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('throws UnauthorizedException for an unknown email', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(
      service.login({ email: 'nobody@example.com', password: 'Whatever1' }),
    ).rejects.toThrow(UnauthorizedException);
  });
});
