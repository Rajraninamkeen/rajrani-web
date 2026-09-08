import { BadRequestException } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';

describe('AnalyticsService (Session 42 — read-only OLTP analytics)', () => {
  let prisma: any;
  let service: AnalyticsService;

  const day = (offsetDays: number, base = new Date('2026-08-15T00:00:00Z')) =>
    new Date(base.getTime() + offsetDays * 86400000);

  const dec = (n: number) => ({ toNumber: () => n });

  /** Order row in the shape loadOrders returns (select-only subset). */
  const order = (over: any) => ({
    id: 'o1',
    status: 'DELIVERED',
    grandTotal: dec(1000),
    placedAt: day(0),
    userId: 'u1',
    items: [
      { quantity: 2, lineTotal: dec(800), productId: 'p1', productNameSnapshot: 'Achar', sellerOrder: { sellerId: 's1' } },
    ],
    sellerOrders: [
      { id: 'so1', sellerId: 's1', status: 'ACCEPTED', grandTotal: dec(1000), deliveredAt: day(1) },
    ],
    ...over,
  });

  const q = () => ({ from: day(-2).toISOString(), to: day(2).toISOString() });

  beforeEach(() => {
    prisma = {
      user: { findUnique: jest.fn() },
      seller: { findFirst: jest.fn() },
      product: { findMany: jest.fn() },
      returnRequest: { findMany: jest.fn() },
      refund: { findMany: jest.fn() },
      sellerPayable: { findMany: jest.fn() },
      order: { findMany: jest.fn() },
    };
    service = new AnalyticsService(prisma as any);
  });

  describe('overview (platform)', () => {
    it('aggregates GMV/AOV/units/buyers over the window, excluding cancelled', async () => {
      prisma.order.findMany.mockResolvedValue([
        order({ id: 'a', userId: 'u1' }), // 1000
        order({ id: 'b', userId: 'u2', grandTotal: dec(500), sellerOrders: [{ id: 'so2', sellerId: 's1', grandTotal: dec(500) }] }), // 500
        order({ id: 'c', userId: 'u3', status: 'CANCELLED', grandTotal: dec(999) }), // excluded
        order({ id: 'd', userId: 'u1', status: 'PLACED', grandTotal: dec(250), sellerOrders: [{ id: 'so4', sellerId: 's1', grandTotal: dec(250) }] }), // 250
      ]);
      prisma.returnRequest.findMany.mockResolvedValue([]);
      const out: any = await service.overview(q());
      expect(out.currency).toBe('INR');
      expect(out.orders.total).toBe(3); // a,b,d
      expect(out.orders.cancelled).toBe(1);
      expect(out.commerce.gmv).toBe(1750); // 1000+500+250
      expect(out.commerce.aov).toBe(583.33); // rounded to 2dp (1750/3)
      expect(out.commerce.unitsSold).toBe(6); // 2 per non-cancelled order
      expect(out.commerce.uniqueBuyers).toBe(2); // u1 (a,d), u2 (b); u3 only in cancelled c
      expect(out.orders.delivered).toBe(2); // a,b delivered
    });

    it('rejects an invalid window', async () => {
      await expect(service.overview({ from: 'not-a-date' })).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('overview (seller-scoped)', () => {
    it('restricts GMV/units to the seller\'s slices only', async () => {
      prisma.order.findMany.mockResolvedValue([
        order({ id: 'a', sellerOrders: [{ id: 'so1', sellerId: 's1', grandTotal: dec(1000) }] }),
        // another seller's order must not leak in
        order({
          id: 'b', sellerOrders: [{ id: 'so2', sellerId: 'OTHER', grandTotal: dec(500) }],
          items: [{ quantity: 2, lineTotal: dec(500), productId: 'p9', productNameSnapshot: 'X', sellerOrder: { sellerId: 'OTHER' } }],
        }),
      ]);
      prisma.returnRequest.findMany.mockResolvedValue([]);
      prisma.refund.findMany.mockResolvedValue([]);
      const out: any = await service.overview(q(), 's1');
      expect(out.commerce.gmv).toBe(1000);
      expect(out.commerce.unitsSold).toBe(2); // only order a's line counts
      expect(out.orders.total).toBe(1);
    });
  });

  describe('trend', () => {
    it('zero-fills every day in the window and buckets GMV by placed date', async () => {
      prisma.order.findMany.mockResolvedValue([
        order({ id: 'a', placedAt: day(0) }),
        order({ id: 'b', status: 'CANCELLED', placedAt: day(0) }), // excluded
        order({ id: 'c', placedAt: day(2), grandTotal: dec(300) }),
      ]);
      const out: any = await service.trend(q());
      expect(out.series.length).toBe(5); // -2..+2 = 5 days
      const d0 = out.series.find((s: any) => s.date === day(0).toISOString().slice(0, 10));
      expect(d0.orders).toBe(1);
      expect(d0.gmv).toBe(1000);
      const empty = out.series.find((s: any) => s.date === day(-1).toISOString().slice(0, 10));
      expect(empty.orders).toBe(0);
      expect(empty.gmv).toBe(0);
    });
  });

  describe('products', () => {
    it('ranks top products by GMV and respects seller scope', async () => {
      prisma.order.findMany.mockResolvedValue([
        order({ id: 'a', items: [
          { quantity: 1, lineTotal: dec(100), productId: 'p1', productNameSnapshot: 'A', sellerOrder: { sellerId: 's1' } },
          { quantity: 3, lineTotal: dec(900), productId: 'p2', productNameSnapshot: 'B', sellerOrder: { sellerId: 's1' } },
        ] }),
      ]);
      const out: any = await service.products({ from: q().from, to: q().to, limit: 10 }, 's1');
      expect(out.rows[0].productId).toBe('p2');
      expect(out.rows[0].gmv).toBe(900);
      expect(out.rows[1].productId).toBe('p1');
    });
  });

  describe('categories', () => {
    it('rolls line totals up per product category via the product lookup', async () => {
      prisma.order.findMany.mockResolvedValue([
        order({ id: 'a', items: [
          { quantity: 1, lineTotal: dec(100), productId: 'p1', productNameSnapshot: 'A', sellerOrder: { sellerId: 's1' } },
          { quantity: 1, lineTotal: dec(50), productId: 'p3', productNameSnapshot: 'C', sellerOrder: { sellerId: 's1' } },
        ] }),
      ]);
      prisma.product.findMany.mockResolvedValue([
        { id: 'p1', category: { id: 'c1', name: 'Masala' } },
        { id: 'p3', category: { id: 'c2', name: 'Oil' } },
      ]);
      const out: any = await service.categories(q());
      expect(out.rows.find((r: any) => r.categoryId === 'c1').gmv).toBe(100);
      expect(out.rows.find((r: any) => r.categoryId === 'c2').gmv).toBe(50);
    });
  });

  describe('sellers', () => {
    it('rolls up payables per seller from the earned ledger', async () => {
      prisma.sellerPayable.findMany.mockResolvedValue([
        { id: 'pay1', status: 'SETTLED', grossAmount: dec(1000), goodsValue: dec(900), commissionAmount: dec(90), refundAmount: dec(0), adjustmentAmount: dec(0), netPayable: dec(810), seller: { id: 's1', sellerCode: 'SC1', displayName: 'Seller 1', commissionRateBps: 1000 } },
        { id: 'pay2', status: 'EARNED', grossAmount: dec(500), goodsValue: dec(400), commissionAmount: dec(40), refundAmount: dec(50), adjustmentAmount: dec(0), netPayable: dec(310), seller: { id: 's1', sellerCode: 'SC1', displayName: 'Seller 1', commissionRateBps: 1000 } },
      ]);
      const out: any = await service.sellers(q());
      expect(out.rows).toHaveLength(1);
      expect(out.rows[0].paidSlices).toBe(2);
      expect(out.rows[0].netPayable).toBe(1120); // 810+310
      expect(out.rows[0].netSettled).toBe(810);
      expect(out.rows[0].refundAmount).toBe(50);
    });
  });

  describe('requireSellerId', () => {
    it('resolves only an ACTIVE seller bound to the caller', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u1', role: 'SELLER', sellerId: 's1' });
      prisma.seller.findFirst.mockResolvedValue({ id: 's1', status: 'ACTIVE' });
      await expect(service.requireSellerId('u1')).resolves.toBe('s1');
    });
    it('rejects a non-seller caller', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u1', role: 'OPERATOR', sellerId: null });
      await expect(service.requireSellerId('u1')).rejects.toBeTruthy();
    });
  });
});
