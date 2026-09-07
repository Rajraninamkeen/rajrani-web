import { BadRequestException, NotFoundException } from '@nestjs/common';
import { createHmac } from 'node:crypto';
import { CodService } from './cod.service';

const otpHash = (c: string) => createHmac('sha256', 'bilokat-cod-otp').update(c).digest('hex');

function codOrder() {
  return {
    id: 'o1',
    userId: 'u1',
    paymentMethod: 'COD',
    status: 'PLACED',
    paymentStatus: 'COD_PENDING',
    addressSnapshot: { phone: '9999888877' },
  };
}

describe('CodService', () => {
  let prisma: any;
  let service: CodService;

  function mockTx() {
    return {
      codVerification: {
        update: jest.fn(async (a: any) => ({ id: 'v1', orderId: a.where.orderId, status: 'CONFIRMED', decision: 'CONFIRMED', otpAttempts: 1, ...a.data })),
      },
      order: { update: jest.fn() },
      orderStatusHistory: { create: jest.fn() },
    };
  }

  beforeEach(() => {
    prisma = {
      order: { findFirst: jest.fn() },
      codVerification: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
      $transaction: jest.fn(),
    };
    service = new CodService(prisma);
  });

  it('initiates OTP (sandbox returns a 6-digit dev OTP and stores only a hash)', async () => {
    prisma.order.findFirst.mockResolvedValue(codOrder());
    prisma.codVerification.findUnique.mockResolvedValue(null);
    prisma.codVerification.create.mockImplementation(({ data }: any) => ({ id: 'v1', ...data }));
    const res = await service.initiateOtp('u1', 'o1', { secondaryContact: '9876543210' });
    expect(res.status).toBe('PENDING_CUSTOMER_OTP');
    expect(res.devOtp).toMatch(/^\d{6}$/);
    expect(res.secondaryContact).toBe('9876543210');
    // only the hash (not the raw OTP) is stored
    const created = prisma.codVerification.create.mock.calls[0][0].data;
    expect(created.otpHash).toBe(otpHash(res.devOtp as string));
    expect(created.otpHash).not.toBe(res.devOtp);
  });

  it('rejects verification for a non-COD order', async () => {
    prisma.order.findFirst.mockResolvedValue({ ...codOrder(), paymentMethod: 'PREPAID' });
    await expect(service.initiateOtp('u1', 'o1', { secondaryContact: '9876543210' })).rejects.toThrow(BadRequestException);
  });

  it('confirms the order when the correct OTP is submitted', async () => {
    prisma.order.findFirst.mockResolvedValue(codOrder());
    prisma.codVerification.findUnique.mockResolvedValue({
      id: 'v1', orderId: 'o1', userId: 'u1',
      status: 'PENDING_CUSTOMER_OTP', otpAttempts: 0,
      otpHash: otpHash('123456'),
      otpExpiresAt: new Date(Date.now() + 60000),
    });
    const tx = mockTx();
    prisma.$transaction.mockImplementation(async (fn: any) => fn(tx));
    const res = await service.verifyOtp('u1', 'o1', { code: '123456' });
    expect(res.status).toBe('CONFIRMED');
    expect(tx.order.update).toHaveBeenCalled();
  });

  it('increments attempts on a wrong OTP and rejects after the cap', async () => {
    prisma.order.findFirst.mockResolvedValue(codOrder());
    prisma.codVerification.findUnique.mockResolvedValue({
      id: 'v1', orderId: 'o1', userId: 'u1',
      status: 'PENDING_CUSTOMER_OTP', otpAttempts: 4,
      otpHash: otpHash('123456'),
      otpExpiresAt: new Date(Date.now() + 60000),
    });
    prisma.codVerification.update.mockResolvedValue({ status: 'REJECTED' });
    prisma.$transaction.mockImplementation(async (fn: any) => fn(mockTx()));
    await expect(service.verifyOtp('u1', 'o1', { code: '999999' })).rejects.toThrow(BadRequestException);
  });

  it('404 when no COD verification exists for the order', async () => {
    prisma.order.findFirst.mockResolvedValue(codOrder());
    prisma.codVerification.findUnique.mockResolvedValue(null);
    await expect(service.verifyOtp('u1', 'o1', { code: '123456' })).rejects.toThrow(NotFoundException);
  });
});
