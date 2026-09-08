import { ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';

describe('AuthService.sellerRegister (Session 14)', () => {
  let prisma: any;
  let service: AuthService;

  function buildPrisma() {
    const tx: any = {
      organization: { create: jest.fn() },
      seller: { create: jest.fn() },
      sellerApplication: { create: jest.fn() },
      user: { create: jest.fn() },
      organizationMember: { create: jest.fn() },
    };
    return {
      user: { findFirst: jest.fn(), findUnique: jest.fn() },
      userSession: { create: jest.fn().mockResolvedValue({ id: 's' }) },
      organization: { create: jest.fn() },
      seller: { create: jest.fn() },
      sellerApplication: { create: jest.fn() },
      organizationMember: { create: jest.fn() },
      $transaction: jest.fn(async (cb: any) => cb(tx)),
    };
  }

  beforeEach(() => {
    prisma = buildPrisma();
    const jwt = { signAsync: jest.fn().mockResolvedValue('tok'), verifyAsync: jest.fn() } as unknown as JwtService;
    const config = {
      get: jest.fn((k: string) =>
        ({ 'jwt.accessSecret': 's', 'jwt.accessTtl': 900, 'jwt.refreshTtl': 1209600 }[k]),
      ),
    } as unknown as ConfigService;
    service = new AuthService(prisma, jwt, config);
  });

  function stageCreate(txValue: any) {
    (prisma.$transaction as jest.Mock).mockImplementation(async (cb: any) => cb(txValue));
    const created: any = {};
    const txObj = {
      organization: {
        create: jest.fn(async () => ({ id: 'org1', slug: 'org-x', ...(created.org ?? {}) })),
      },
      seller: {
        create: jest.fn(async (args: any) => ({ id: 'sel1', sellerCode: 'SELL-AB12', ...args.data })),
      },
      sellerApplication: { create: jest.fn(async (args: any) => ({ id: 'app1', ...args.data })) },
      user: { create: jest.fn(async (args: any) => ({ id: 'u1', role: 'SELLER', status: 'ACTIVE', ...args.data })) },
      organizationMember: { create: jest.fn(async (args: any) => ({ id: 'm1', ...args.data })) },
    };
    (prisma.$transaction as jest.Mock).mockImplementation(async (cb: any) => cb(txObj));
    return txObj;
  }

  it('creates a PENDING seller + org + OWNER membership and returns SELLER tokens', async () => {
    prisma.user.findFirst.mockResolvedValue(null);
    const tx = stageCreate(null as any);
    const res = await service.sellerRegister({
      email: 'newshop@example.com',
      password: 'Passw0rd1',
      fullName: 'Ada',
      legalName: 'Ada Trading Pvt Ltd',
      businessName: 'Ada Spices',
      gstin: '27AAPFU0939F1ZV',
      commissionRateBps: 0,
    } as any);

    expect(prisma.userSession.create).toHaveBeenCalled();
    expect(res.user.role).toBe('SELLER');
    expect(res.seller.status).toBe('PENDING');
    expect(res.seller.organizationId).toBeDefined();
    expect(tx.organization.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ type: 'SELLER' }) }),
    );
    const sellerData = (tx.seller.create as jest.Mock).mock.calls[0][0].data;
    expect(sellerData.status).toBe('PENDING');
    expect(tx.organizationMember.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ role: 'OWNER' }) }),
    );
    const appData = (tx.sellerApplication.create as jest.Mock).mock.calls[0][0].data;
    expect(appData.status).toBe('DRAFT');
  });

  it('rejects a duplicate email', async () => {
    prisma.user.findFirst.mockResolvedValue({ email: 'newshop@example.com' });
    await expect(
      service.sellerRegister({
        email: 'newshop@example.com',
        password: 'Passw0rd1',
        legalName: 'Ada Trading',
        businessName: 'Ada Spices',
      } as any),
    ).rejects.toThrow(ConflictException);
  });
});
