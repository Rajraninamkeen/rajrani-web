import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { CourierPayoutService } from './courier-payout.service';
import { CourierPayoutStatus } from '../generated/prisma/client';

describe('CourierPayoutService (Session 32 — money leg)', () => {
  let prisma: any;
  let tx: any;
  let service: CourierPayoutService;

  beforeEach(() => {
    tx = {
      courierPayout: { findFirst: jest.fn(), create: jest.fn(), findMany: jest.fn(), updateMany: jest.fn() },
    };
    prisma = {
      user: { findUnique: jest.fn() },
      deliveryPartner: { findUnique: jest.fn(), findMany: jest.fn() },
      courierPayout: {
        findFirst: jest.fn(), findMany: jest.fn(), create: jest.fn(), count: jest.fn(),
        aggregate: jest.fn(), groupBy: jest.fn(), updateMany: jest.fn(),
      },
      $transaction: jest.fn(async (cb: any) => cb(tx)),
    };
    service = new CourierPayoutService(prisma as any);
  });

  describe('earnCourierDelivery', () => {
    it('accrues an EARNED parcel payout (default fee 35) on the delivered leg', async () => {
      tx.courierPayout.findFirst.mockResolvedValue(null);
      tx.courierPayout.create.mockImplementation((a: any) => Promise.resolve(a.data));
      const out: any = await service.earnCourierDelivery(tx, {
        deliveryPartnerId: 'p1', kind: 'parcel', orderId: 'o1', sellerOrderId: 'so1', deliveryAssignmentId: 'da1',
      });
      expect(tx.courierPayout.create).toHaveBeenCalledTimes(1);
      expect(out.feeAmount).toBe(35);
      expect(out.status).toBe('EARNED');
      expect(out.kind).toBe('parcel');
      expect(out.deliveryAssignmentId).toBe('da1');
      expect(out.deliveryPartnerId).toBe('p1');
    });

    it('accrues a replacement payout (default fee 40)', async () => {
      tx.courierPayout.findFirst.mockResolvedValue(null);
      tx.courierPayout.create.mockImplementation((a: any) => Promise.resolve(a.data));
      const out: any = await service.earnCourierDelivery(tx, {
        deliveryPartnerId: 'p1', kind: 'replacement', orderId: 'o2', replacementAssignmentId: 'ra1',
      });
      expect(out.feeAmount).toBe(40);
      expect(out.kind).toBe('replacement');
      expect(out.replacementAssignmentId).toBe('ra1');
    });

    it('is idempotent — does not double-earn an already-earned leg', async () => {
      tx.courierPayout.findFirst.mockResolvedValue({ id: 'existing' });
      const out = await service.earnCourierDelivery(tx, {
        deliveryPartnerId: 'p1', kind: 'parcel', orderId: 'o1', deliveryAssignmentId: 'da1',
      });
      expect(out).toBeNull();
      expect(tx.courierPayout.create).not.toHaveBeenCalled();
    });

    it('no-ops when there is no delivery partner', async () => {
      const out = await service.earnCourierDelivery(tx, {
        deliveryPartnerId: null, kind: 'parcel', orderId: 'o1', deliveryAssignmentId: 'da1',
      });
      expect(out).toBeNull();
      expect(tx.courierPayout.create).not.toHaveBeenCalled();
    });
  });

  describe('DELIVERY self-service', () => {
    it('forbids a non-DELIVERY user', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u', role: 'SELLER' });
      await expect(service.partnerPayouts('u')).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('forbids a DELIVERY user without an ACTIVE partner profile', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u', role: 'DELIVERY' });
      prisma.deliveryPartner.findUnique.mockResolvedValue({ id: 'p1', status: 'REGISTERED' });
      await expect(service.partnerPayouts('u')).rejects.toBeInstanceOf(ConflictException);
    });

    it('returns the partner\'s payouts with a summary', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u', role: 'DELIVERY' });
      prisma.deliveryPartner.findUnique.mockResolvedValue({ id: 'p1', userId: 'u', status: 'ACTIVE', partnerCode: 'DLV-1' });
      prisma.courierPayout.findMany.mockResolvedValue([{
        id: 'cp1', deliveryPartnerId: 'p1', kind: 'parcel', orderId: 'o1', sellerOrderId: 'so1',
        deliveryAssignmentId: 'da1', replacementAssignmentId: null, feeAmount: { toNumber: () => 35 },
        currency: 'INR', status: 'EARNED', earnedAt: new Date(), settledAt: null, settledById: null, cancelledAt: null,
      }]);
      prisma.courierPayout.count.mockResolvedValue(1);
      // summary aggregates for 3 statuses
      prisma.courierPayout.aggregate.mockImplementation((a: any) => Promise.resolve({
        _sum: { feeAmount: a.where.status === CourierPayoutStatus.EARNED ? { toNumber: () => 35 } : null },
        _count: a.where.status === CourierPayoutStatus.EARNED ? 1 : 0,
      }));
      const out = await service.partnerPayouts('u');
      expect(out.payouts).toHaveLength(1);
      expect(out.payouts[0].feeAmount).toBe(35);
      expect(out.summary.pendingAmount).toBe(35);
      expect(out.summary.paidAmount).toBe(0);
      expect(out.summary.counts.pending).toBe(1);
    });
  });

  describe('back-office settle', () => {
    it('pays out a partner\'s EARNED payouts in one tx', async () => {
      prisma.deliveryPartner.findUnique.mockResolvedValue({ id: 'p1', partnerCode: 'DLV-1' });
      tx.courierPayout.findMany.mockResolvedValue([
        { feeAmount: { toNumber: () => 35 } }, { feeAmount: { toNumber: () => 40 } },
      ]);
      const out = await service.settlePartnerEarned('op1', 'p1');
      expect(out.settled).toBe(2);
      expect(out.totalAmount).toBe(75);
      expect(tx.courierPayout.updateMany).toHaveBeenCalledWith({
        where: { deliveryPartnerId: 'p1', status: CourierPayoutStatus.EARNED },
        data: expect.objectContaining({ status: CourierPayoutStatus.SETTLED, settledById: 'op1' }),
      });
    });

    it('is a no-op when a partner has nothing EARNED', async () => {
      prisma.deliveryPartner.findUnique.mockResolvedValue({ id: 'p1' });
      tx.courierPayout.findMany.mockResolvedValue([]);
      const out = await service.settlePartnerEarned('op1', 'p1');
      expect(out).toEqual({ settled: 0, totalAmount: 0 });
    });

    it('404s for an unknown partner', async () => {
      prisma.deliveryPartner.findUnique.mockResolvedValue(null);
      await expect(service.settlePartnerEarned('op1', 'nope')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('emits a COURIER_FEE_SETTLED notice when it pays a partner out (Session 38)', async () => {
      prisma.deliveryPartner.findUnique.mockResolvedValue({ id: 'p1', partnerCode: 'DLV-1', userId: 'ur1' });
      tx.courierPayout.findMany.mockResolvedValue([{ feeAmount: { toNumber: () => 35 } }]);
      tx.user = { findUnique: jest.fn().mockResolvedValue({ email: 'r@x.co', phone: null }) };
      const notif = { enqueueTx: jest.fn().mockResolvedValue(undefined) };
      const svc = new CourierPayoutService(prisma as any, undefined, notif as any);
      const out = await svc.settlePartnerEarned('op1', 'p1');
      expect(out.settled).toBe(1);
      expect(notif.enqueueTx).toHaveBeenCalled();
      expect(notif.enqueueTx.mock.calls[0][1].category).toBe('COURIER_FEE_SETTLED');
      expect(notif.enqueueTx.mock.calls[0][1].recipientUserId).toBe('ur1');
    });

    it('does not emit when there is nothing to pay out (Session 38)', async () => {
      prisma.deliveryPartner.findUnique.mockResolvedValue({ id: 'p1', userId: 'ur1' });
      tx.courierPayout.findMany.mockResolvedValue([]);
      const notif = { enqueueTx: jest.fn().mockResolvedValue(undefined) };
      const svc = new CourierPayoutService(prisma as any, undefined, notif as any);
      await svc.settlePartnerEarned('op1', 'p1');
      expect(notif.enqueueTx).not.toHaveBeenCalled();
    });

    it('emits COURIER_FEE_EARNED when it accrues a fee (Session 38)', async () => {
      tx.courierPayout.findFirst.mockResolvedValue(null);
      tx.courierPayout.create.mockResolvedValue({ id: 'cp1' });
      tx.deliveryPartner = { findUnique: jest.fn().mockResolvedValue({ userId: 'ur1' }) };
      tx.user = { findUnique: jest.fn().mockResolvedValue({ email: 'r@x.co', phone: null }) };
      const notif = { enqueueTx: jest.fn().mockResolvedValue(undefined) };
      const svc = new CourierPayoutService(prisma as any, undefined, notif as any);
      await svc.earnCourierDelivery(tx, {
        deliveryPartnerId: 'p1', kind: 'parcel', orderId: 'o1', deliveryAssignmentId: 'da1',
      });
      expect(notif.enqueueTx).toHaveBeenCalled();
      expect(notif.enqueueTx.mock.calls[0][1].category).toBe('COURIER_FEE_EARNED');
    });
  });

  describe('staff list', () => {
    it('lists payouts across partners', async () => {
      prisma.courierPayout.findMany.mockResolvedValue([{
        id: 'cp1', deliveryPartnerId: 'p1', kind: 'parcel', orderId: 'o1',
        feeAmount: { toNumber: () => 35 }, currency: 'INR', status: 'EARNED',
        deliveryPartner: { partnerCode: 'DLV-1', user: { fullName: 'Rider', email: 'r@x.co' } },
        sellerOrderId: null, deliveryAssignmentId: null, replacementAssignmentId: null,
        earnedAt: new Date(), settledAt: null, settledById: null, cancelledAt: null,
      }]);
      prisma.courierPayout.count.mockResolvedValue(1);
      const out = await service.staffList({ status: 'EARNED' });
      expect(out.total).toBe(1);
      expect(out.payouts[0].partnerCode).toBe('DLV-1');
      expect(out.payouts[0].partnerName).toBe('Rider');
    });

    it('staffList applies an inclusive earnedAt [from, to] window (Session 37)', async () => {
      prisma.courierPayout.findMany.mockResolvedValue([]);
      prisma.courierPayout.count.mockResolvedValue(0);
      await service.staffList({ status: 'EARNED', from: '2026-01-01', to: '2026-01-31' });
      const args: any = prisma.courierPayout.findMany.mock.calls[0][0];
      expect(args.where.status).toBe('EARNED');
      expect(args.where.earnedAt.gte).toEqual(new Date('2026-01-01'));
      // date-only `to` is inclusive (end-of-day)
      expect(args.where.earnedAt.lte.getTime()).toBe(new Date('2026-01-31').getTime() + 86399999);
    });

    it('staffSummary applies the earnedAt window to the aggregate totals (Session 37)', async () => {
      prisma.courierPayout.aggregate.mockImplementation(() => Promise.resolve({ _sum: { feeAmount: { toNumber: () => 0 } } }));
      prisma.courierPayout.groupBy.mockResolvedValue([]);
      prisma.deliveryPartner.findMany.mockResolvedValue([]);
      await service.staffSummary({ from: '2026-01-01', to: '2026-01-31' });
      const aggArgs: any = prisma.courierPayout.aggregate.mock.calls[0][0];
      expect(aggArgs.where.earnedAt.gte).toEqual(new Date('2026-01-01'));
      expect(aggArgs.where.earnedAt.lte).toBeDefined();
    });
  });
});
