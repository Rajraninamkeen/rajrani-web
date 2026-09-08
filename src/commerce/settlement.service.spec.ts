import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma, SettlementStatus } from '../generated/prisma/client';
import {
  SettlementService,
  computePayableBreakdown,
  PayableSliceInput,
} from './settlement.service';

function dec(n: number) {
  return new Prisma.Decimal(n.toFixed(2));
}

function sliceInput(over: Partial<PayableSliceInput> = {}): PayableSliceInput {
  return {
    subtotal: dec(1000),
    discountTotal: dec(0),
    taxTotal: dec(100),
    deliveryTotal: dec(50),
    seller: { commissionRateBps: 1000 }, // 10%
    ...over,
  };
}

describe('computePayableBreakdown (money rule)', () => {
  it('0% platform seller keeps the whole goods value; commission 0', () => {
    const b = computePayableBreakdown(sliceInput({ seller: { commissionRateBps: 0 } }));
    expect(b.goodsValue).toBe(1000);
    expect(b.commissionAmount).toBe(0);
    expect(b.netPayable).toBe(1000);
    expect(b.taxAmount).toBe(100); // retained by Bilokat
    expect(b.deliveryAmount).toBe(50);
  });

  it('10% seller earns goods value minus commission; slice reconciles exactly', () => {
    const b = computePayableBreakdown(sliceInput());
    expect(b.goodsValue).toBe(1000);
    expect(b.commissionAmount).toBe(100);
    expect(b.netPayable).toBe(900);
    // grandTotal = goods + tax + delivery; seller net + commission + tax + delivery == grand
    expect(b.netPayable + b.commissionAmount + b.taxAmount + b.deliveryAmount).toBe(1150);
  });

  it('respects discounts (goods = subtotal - discount) and rounds to paise', () => {
    const b = computePayableBreakdown(
      sliceInput({ subtotal: dec(500), discountTotal: dec(50), taxTotal: dec(0), deliveryTotal: dec(0) }),
    );
    expect(b.goodsValue).toBe(450);
    expect(b.commissionAmount).toBe(45);
    expect(b.netPayable).toBe(405);
    // paise rounding
    const b2 = computePayableBreakdown(
      sliceInput({ subtotal: dec(101.15), discountTotal: dec(0), taxTotal: dec(0), deliveryTotal: dec(0) }),
    );
    // goodsPaise 10115; 10115*1000/10000 = 1011.5 -> round 1012 -> 10.12 commission, net 91.03
    expect(b2.commissionAmount).toBe(10.12);
    expect(b2.netPayable).toBe(91.03);
  });
});

describe('SettlementService', () => {
  let prisma: any;
  let service: SettlementService;

  function fakeTx(over: Record<string, any> = {}) {
    return {
      sellerOrder: { findMany: jest.fn() },
      sellerPayable: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        findMany: jest.fn(),
      },
      settlement: { create: jest.fn(), updateMany: jest.fn() },
      settlementItem: { create: jest.fn(), findMany: jest.fn() },
      settlementEvent: { create: jest.fn() },
      sellerPayableAdjustment: { create: jest.fn() },
      ...over,
    };
  }

  beforeEach(() => {
    prisma = {
      $transaction: jest.fn((cb: any) => cb(fakeTx())),
      user: { findUnique: jest.fn() },
      seller: { findUnique: jest.fn(), findFirst: jest.fn() },
      sellerPayable: { findUnique: jest.fn(), findMany: jest.fn(), count: jest.fn() },
      settlement: { findUnique: jest.fn(), findMany: jest.fn(), count: jest.fn() },
    };
    service = new SettlementService(prisma as any);
  });

  describe('earnDeliveredSlices', () => {
    it('earns only ACCEPTED delivered slices, computing commission from the seller rate', async () => {
      const tx = fakeTx();
      // Simulates the DB filtering to ACCEPTED slices only (a REJECTED/CANCELLED
      // slice would never be returned, hence never earned).
      tx.sellerOrder.findMany.mockImplementation((args: any) => {
        if (args.where.status !== 'ACCEPTED') throw new Error('must filter ACCEPTED');
        return Promise.resolve([
          {
            id: 'so-accepted',
            sellerId: 'rajrani',
            orderId: 'o1',
            subtotal: dec(1000),
            discountTotal: dec(0),
            taxTotal: dec(100),
            deliveryTotal: dec(50),
            seller: { commissionRateBps: 1000 },
          },
        ]);
      });
      tx.sellerPayable.findUnique.mockResolvedValue(null); // no existing payable
      tx.sellerPayable.create.mockResolvedValue({});
      prisma.$transaction.mockImplementation((cb: any) => cb(tx));

      await service.earnDeliveredSlices(tx as any, 'o1');

      const calls = tx.sellerPayable.create.mock.calls;
      expect(calls.length).toBe(1);
      expect(calls[0][0].data.sellerId).toBe('rajrani');
      expect(calls[0][0].data.netPayable).toBe(900); // 1000 goods - 100 commission
      expect(calls[0][0].data.commissionAmount).toBe(100);
      expect(calls[0][0].data.status).toBe('EARNED');
    });

    it('is idempotent: skips a slice that already has a payable', async () => {
      const tx = fakeTx();
      tx.sellerOrder.findMany.mockResolvedValue([
        { id: 'so1', sellerId: 'r', orderId: 'o1', subtotal: dec(100), discountTotal: dec(0), taxTotal: dec(0), deliveryTotal: dec(0), seller: { commissionRateBps: 1000 } },
      ]);
      tx.sellerPayable.findUnique.mockResolvedValue({ id: 'existing' });
      tx.sellerPayable.create.mockResolvedValue({});
      prisma.$transaction.mockImplementation((cb: any) => cb(tx));
      const n = await service.earnDeliveredSlices(tx as any, 'o1');
      expect(n).toBe(0);
      expect(tx.sellerPayable.create).not.toHaveBeenCalled();
    });
  });

  describe('addAdjustment', () => {
    it('reduces the payable net and records an append-only adjustment', async () => {
      prisma.sellerPayable.findUnique.mockResolvedValue({
        id: 'p1',
        status: 'EARNED',
        netPayable: dec(900),
        adjustments: [{ amount: dec(0) }],
      });
      const tx = fakeTx();
      tx.sellerPayableAdjustment.create.mockResolvedValue({});
      tx.sellerPayable.update.mockResolvedValue({});
      prisma.$transaction.mockImplementation((cb: any) => cb(tx));

      await service.addAdjustment('op1', 'p1', -100, 'customer return of one item');
      expect(tx.sellerPayableAdjustment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ amount: -100, reason: 'customer return of one item' }),
        }),
      );
      const upd = tx.sellerPayable.update.mock.calls[0][0];
      expect(upd.data.adjustmentAmount).toBe(-100);
      expect(upd.data.netPayable).toBe(800);
    });

    it('rejects an adjustment that would make the payable negative', async () => {
      prisma.sellerPayable.findUnique.mockResolvedValue({
        id: 'p1',
        status: 'EARNED',
        netPayable: dec(10),
        adjustments: [],
      });
      await expect(service.addAdjustment('op1', 'p1', -100, 'over-adjust')).rejects.toThrow(BadRequestException);
    });

    it('rejects adjusting a payable that is already in a settlement', async () => {
      prisma.sellerPayable.findUnique.mockResolvedValue({
        id: 'p1',
        status: 'IN_SETTLEMENT',
        netPayable: dec(900),
        adjustments: [],
      });
      await expect(service.addAdjustment('op1', 'p1', -50, 'late')).rejects.toThrow(ConflictException);
    });
  });

  describe('createSettlement', () => {
    it('creates a PENDING settlement summing the selected earned payables and marks them IN_SETTLEMENT', async () => {
      prisma.seller.findUnique.mockResolvedValue({ id: 'rajrani' });
      const tx = fakeTx();
      tx.sellerPayable.findMany.mockResolvedValue([
        { id: 'p1', status: 'EARNED', grossAmount: dec(1000), discountAmount: dec(0), goodsValue: dec(1000), commissionAmount: dec(100), taxAmount: dec(100), deliveryAmount: dec(50), refundAmount: dec(0), adjustmentAmount: dec(0), netPayable: dec(900), sellerOrderId: 'so1' },
        { id: 'p2', status: 'EARNED', grossAmount: dec(500), discountAmount: dec(0), goodsValue: dec(500), commissionAmount: dec(0), taxAmount: dec(0), deliveryAmount: dec(0), refundAmount: dec(0), adjustmentAmount: dec(0), netPayable: dec(500), sellerOrderId: 'so2' },
      ]);
      tx.settlement.create.mockResolvedValue({ id: 'stl1' });
      prisma.$transaction.mockImplementation((cb: any) => cb(tx));
      prisma.settlement.findUnique.mockResolvedValue({
        id: 'stl1',
        settlementReference: 'STL-XXXX',
        sellerId: 'rajrani',
        status: 'PENDING',
        currency: 'INR',
        grossAmount: dec(1500),
        discountAmount: dec(0),
        goodsValue: dec(1500),
        commissionAmount: dec(100),
        taxAmount: dec(100),
        deliveryAmount: dec(50),
        refundAmount: dec(0),
        adjustmentAmount: dec(0),
        netPayable: dec(1400),
        approvedAt: null,
        processedAt: null,
        paidAt: null,
        reconciledAt: null,
        failedAt: null,
        failedReason: null,
        seller: { sellerCode: 'SELL-RAJRANI', displayName: 'Rajrani Select' },
        items: [],
        events: [{ eventType: 'CREATED', actorId: 'op1', reason: 'x', createdAt: new Date() }],
      });
      const out = await service.createSettlement('op1', { sellerId: 'rajrani', payableIds: ['p1', 'p2'] });
      expect(tx.sellerPayable.update).toHaveBeenCalled();
      // all update calls set IN_SETTLEMENT
      expect(tx.sellerPayable.update.mock.calls[0][0].data.status).toBe('IN_SETTLEMENT');
      expect(out.settlementReference).toBe('STL-XXXX');
      expect(out.netPayable).toBe(1400);
    });

    it('refuses to double-include a payable already in a settlement', async () => {
      prisma.seller.findUnique.mockResolvedValue({ id: 'rajrani' });
      const tx = fakeTx();
      tx.sellerPayable.findMany.mockResolvedValue([
        { id: 'p1', status: 'IN_SETTLEMENT', grossAmount: dec(1000), discountAmount: dec(0), goodsValue: dec(1000), commissionAmount: dec(100), taxAmount: dec(100), deliveryAmount: dec(50), refundAmount: dec(0), adjustmentAmount: dec(0), netPayable: dec(900), sellerOrderId: 'so1' },
      ]);
      tx.settlement.create.mockResolvedValue({ id: 'stl1' });
      prisma.$transaction.mockImplementation((cb: any) => cb(tx));
      await expect(
        service.createSettlement('op1', { sellerId: 'rajrani', payableIds: ['p1'] }),
      ).rejects.toThrow(ConflictException);
    });

    it('refuses payables belonging to another seller', async () => {
      prisma.seller.findUnique.mockResolvedValue({ id: 'rajrani' });
      const tx = fakeTx();
      tx.sellerPayable.findMany.mockResolvedValue([{ id: 'p1', status: 'EARNED' }]); // belongs to someone else -> length mismatch
      prisma.$transaction.mockImplementation((cb: any) => cb(tx));
      await expect(
        service.createSettlement('op1', { sellerId: 'rajrani', payableIds: ['p1', 'pX'] }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('advanceSettlement', () => {
    function mk(tx: any, stl: any) {
      prisma.settlement.findUnique.mockResolvedValue(stl);
      tx.settlement.updateMany.mockResolvedValue({ count: 1 });
      tx.settlementItem.findMany.mockResolvedValue([{ sellerPayableId: 'p1' }]);
      tx.sellerPayable.updateMany.mockResolvedValue({});
      prisma.$transaction.mockImplementation((cb: any) => cb(tx));
    }
    it('moves PENDING -> APPROVED -> PROCESSING -> PAID and marks payables SETTLED on PAID', async () => {
      const tx = fakeTx();
      mk(tx, { id: 'stl1', status: SettlementStatus.PENDING });
      await service.advanceSettlement('op1', 'stl1', SettlementStatus.APPROVED);
      expect(tx.settlement.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'APPROVED' }) }),
      );

      tx.settlement.updateMany.mockClear();
      prisma.settlement.findUnique.mockResolvedValue({ id: 'stl1', status: SettlementStatus.APPROVED });
      await service.advanceSettlement('op1', 'stl1', SettlementStatus.PROCESSING);

      tx.settlement.updateMany.mockClear();
      prisma.settlement.findUnique.mockResolvedValue({ id: 'stl1', status: SettlementStatus.PROCESSING });
      await service.advanceSettlement('op1', 'stl1', SettlementStatus.PAID);
      const upd = tx.sellerPayable.updateMany.mock.calls[0][0];
      expect(upd.data.status).toBe('SETTLED');
    });

    it('rejects an illegal jump (PENDING -> PAID)', async () => {
      const tx = fakeTx();
      mk(tx, { id: 'stl1', status: SettlementStatus.PENDING });
      await expect(service.advanceSettlement('op1', 'stl1', SettlementStatus.PAID)).rejects.toThrow(ConflictException);
    });

    it('allows PROCESSING -> FAILED -> PROCESSING (retry)', async () => {
      const tx = fakeTx();
      mk(tx, { id: 'stl1', status: SettlementStatus.PROCESSING });
      await service.advanceSettlement('op1', 'stl1', SettlementStatus.FAILED, 'gateway declined');
      prisma.settlement.findUnique.mockResolvedValue({ id: 'stl1', status: SettlementStatus.FAILED });
      tx.settlement.updateMany.mockClear();
      await service.advanceSettlement('op1', 'stl1', SettlementStatus.PROCESSING);
      expect(tx.settlement.updateMany).toHaveBeenCalled();
    });
  });

  describe('getPayable', () => {
    it('throws 404 for an unknown payable', async () => {
      prisma.sellerPayable.findUnique.mockResolvedValue(null);
      await expect(service.getPayable('nope')).rejects.toThrow(NotFoundException);
    });
  });
});

describe('SettlementService · auto return-debit (Session 13)', () => {
  let prisma: any;
  let service: SettlementService;
  beforeEach(() => {
    prisma = { $transaction: jest.fn((cb: any) => cb({})) };
    service = new SettlementService(prisma as any);
  });

  function payableSliceTx(over: Record<string, any> = {}) {
    const tx = {
      sellerOrder: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'so1',
          seller: { commissionRateBps: 1000 }, // 10%
          payable: {
            id: 'p1',
            status: 'EARNED',
            netPayable: dec(900),
            refundAmount: dec(0),
            adjustmentAmount: dec(0),
          },
          ...over,
        }),
      },
      sellerPayableAdjustment: { create: jest.fn() },
      sellerPayable: { update: jest.fn() },
    };
    return tx;
  }

  it('debits the returned goods net (goods × (1-rate)) from the EARNED payable and records a SYSTEM adjustment', async () => {
    const tx = payableSliceTx();
    const out = await service.debitReturnedGoodsForRefund(
      tx as any,
      [{ sellerOrderId: 'so1', returnedGoodsValue: 100 }],
      { refundReference: 'RFD-1', returnRequestId: 'rr1' },
    );
    expect(out.applied).toBe(90); // 100 goods, 10% => net 90
    expect(tx.sellerPayableAdjustment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ amount: -90, actorType: 'SYSTEM', actorId: 'rr1' }),
      }),
    );
    expect(tx.sellerPayable.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ netPayable: 810, refundAmount: 90, adjustmentAmount: -90 }) }),
    );
  });

  it('never drives a payable below zero (clamps to remaining net)', async () => {
    const tx = payableSliceTx({
      payable: { id: 'p1', status: 'EARNED', netPayable: dec(50), refundAmount: dec(0), adjustmentAmount: dec(0) },
    });
    const out = await service.debitReturnedGoodsForRefund(
      tx as any,
      [{ sellerOrderId: 'so1', returnedGoodsValue: 100 }], // net 90 but only 50 remains
      { refundReference: 'RFD-2' },
    );
    expect(out.applied).toBe(50);
    expect(tx.sellerPayable.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ netPayable: 0, refundAmount: 50 }) }),
    );
  });

  it('skips slices that are not EARNED (already settled) and those without a payable', async () => {
    const tx = payableSliceTx({
      payable: { id: 'p1', status: 'SETTLED', netPayable: dec(900), refundAmount: dec(0), adjustmentAmount: dec(0) },
    });
    const out = await service.debitReturnedGoodsForRefund(
      tx as any,
      [{ sellerOrderId: 'so1', returnedGoodsValue: 100 }],
      {},
    );
    expect(out.applied).toBe(0);
    expect(tx.sellerPayableAdjustment.create).not.toHaveBeenCalled();
  });

  it('treats a 0% seller as debiting the full returned goods value', async () => {
    const tx = payableSliceTx({ seller: { commissionRateBps: 0 } });
    const out = await service.debitReturnedGoodsForRefund(
      tx as any,
      [{ sellerOrderId: 'so1', returnedGoodsValue: 100 }],
      {},
    );
    expect(out.applied).toBe(100);
  });
});

describe('SettlementService · reconciliation + reporting (Session 13)', () => {
  let prisma: any;
  let service: SettlementService;
  beforeEach(() => {
    prisma = {
      order: { findMany: jest.fn() },
      sellerPayableAdjustment: { findMany: jest.fn().mockResolvedValue([]) },
      sellerPayable: { groupBy: jest.fn() },
      seller: { findMany: jest.fn() },
      $transaction: jest.fn(),
    };
    service = new SettlementService(prisma as any);
  });

  function deliveredOrder(over: Record<string, any> = {}) {
    return {
      id: 'o1',
      status: 'DELIVERED',
      grandTotal: dec(710.85),
      sellerOrders: [
        {
          id: 'so1',
          sellerOrderNumber: 'SO-1',
          status: 'ACCEPTED',
          deliveredAt: new Date(),
          grandTotal: dec(396.9),
          seller: { commissionRateBps: 0 },
          payable: {
            id: 'p1',
            goodsValue: dec(378),
            commissionAmount: dec(0),
            netPayable: dec(378),
            taxAmount: dec(18.9),
            deliveryAmount: dec(0),
          },
        },
        {
          id: 'so2',
          sellerOrderNumber: 'SO-2',
          status: 'ACCEPTED',
          deliveredAt: new Date(),
          grandTotal: dec(313.95),
          seller: { commissionRateBps: 1000 },
          payable: {
            id: 'p2',
            goodsValue: dec(299),
            commissionAmount: dec(29.9),
            netPayable: dec(269.1),
            taxAmount: dec(14.95),
            deliveryAmount: dec(0),
          },
        },
      ],
      refunds: [],
      ...over,
    };
  }

  it('reports ok for a clean ledger (split, refund cap, delivered payables, ledger self-consistency)', async () => {
    prisma.order.findMany.mockResolvedValue([deliveredOrder()]);
    const out = await service.runReconciliation();
    expect(out.ok).toBe(true);
    expect(out.discrepancyCount).toBe(0);
    expect(out.checked.deliveredOrders).toBe(1);
    expect(out.checked.payables).toBe(2);
  });

  it('flags an order-split mismatch and a delivered slice missing a payable', async () => {
    prisma.order.findMany.mockResolvedValue([
      deliveredOrder({
        grandTotal: dec(700),
        sellerOrders: [
          {
            id: 'so1',
            sellerOrderNumber: 'SO-1',
            status: 'ACCEPTED',
            deliveredAt: new Date(),
            grandTotal: dec(396.9),
            payable: null, // missing
          },
        ],
        refunds: [],
      }),
    ]);
    const out = await service.runReconciliation();
    const kinds = out.discrepancies.map((d: any) => d.kind);
    expect(kinds).toContain('order_split_mismatch');
    expect(kinds).toContain('delivered_slice_missing_payable');
    expect(out.ok).toBe(false);
  });

  it('flags a payable whose net disagrees with goods - commission + Σadjustments', async () => {
    const order = deliveredOrder();
    order.sellerOrders[0].payable.netPayable = dec(300); // should be 378
    prisma.order.findMany.mockResolvedValue([order]);
    const out = await service.runReconciliation();
    expect(out.discrepancies.map((d: any) => d.kind)).toContain('payable_ledger_mismatch');
  });

  it('reportTotals groups by seller and returns grand totals', async () => {
    prisma.sellerPayable.groupBy.mockResolvedValue([
      { sellerId: 'seller-legacy', _count: { _all: 2 }, _sum: { grossAmount: dec(700), discountAmount: dec(0), goodsValue: dec(700), commissionAmount: dec(0), taxAmount: dec(35), deliveryAmount: dec(0), refundAmount: dec(0), adjustmentAmount: dec(0), netPayable: dec(700) } },
    ]);
    prisma.seller.findMany.mockResolvedValue([{ id: 'seller-legacy', sellerCode: 'SELL-BILOKAT', displayName: 'Bilokat Kitchens' }]);
    const out = await service.reportTotals({});
    expect(out.perSeller).toHaveLength(1);
    expect(out.perSeller[0].netPayable).toBe(700);
    expect(out.totals.netPayable).toBe(700);
    expect(out.totals.commissionAmount).toBe(0);
  });
});

describe('SettlementService · period (from/to) filters (Session 37)', () => {
  let prisma: any;
  let service: SettlementService;
  beforeEach(() => {
    prisma = {
      sellerPayable: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) },
      settlement: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) },
    };
    service = new SettlementService(prisma as any);
  });

  it('listPayables applies an inclusive earnedAt [from, to] window', async () => {
    await service.listPayables({ from: '2026-01-01', to: '2026-01-31' });
    const args: any = prisma.sellerPayable.findMany.mock.calls[0][0];
    expect(args.where.earnedAt.gte).toEqual(new Date('2026-01-01'));
    expect(args.where.earnedAt.lte.getTime()).toBe(new Date('2026-01-31').getTime() + 86399999);
  });

  it('listSettlements applies an inclusive createdAt [from, to] window', async () => {
    await service.listSettlements({ from: '2026-02-01', to: '2026-02-28' });
    const args: any = prisma.settlement.findMany.mock.calls[0][0];
    expect(args.where.createdAt.gte).toEqual(new Date('2026-02-01'));
    expect(args.where.createdAt.lte.getTime()).toBe(new Date('2026-02-28').getTime() + 86399999);
  });
});
