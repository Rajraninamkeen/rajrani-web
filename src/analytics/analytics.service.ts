import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  AnalyticsListQueryDto,
  AnalyticsQueryDto,
  resolveWindow,
} from './dto/analytics-query.dto';

/**
 * Session 42 — AnalyticsService.
 *
 * READ-ONLY business analytics DERIVED FROM the transactional OLTP tables, which
 * remain the source of truth (10-ANALYTICS-SPEC §2). No event lake, no
 * analytical re-write, no mutation — every method only ever reads and aggregates
 * the existing Order/SellerOrder/OrderItem/SellerPayable/ReturnRequest/Courier
 * data. Money is reported in whole rupees (2 dp) and daily series are UTC-dated.
 *
 * Every aggregation accepts an optional `sellerScope` (a seller id). When set the
 * numbers are restricted to orders/slices/products belonging to THAT seller
 * (the SELLER-facing surface). `null` = platform-wide (OPERATOR/ADMIN).
 */
@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Decimal/number -> rounded number (rupees). */
  private num(d: unknown): number {
    if (d === null || d === undefined) return 0;
    const n = typeof d === 'object' && typeof (d as any).toNumber === 'function'
      ? (d as any).toNumber()
      : Number(d);
    return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
  }

  private day(d: Date): string {
    // UTC date key YYYY-MM-DD (deterministic daily buckets).
    return d.toISOString().slice(0, 10);
  }

  private scopeWhere(sellerScope?: string) {
    if (!sellerScope) return {};
    return { sellerOrders: { some: { sellerId: sellerScope } } } as const;
  }

  /** Load all candidate orders in the window (optionally scoped) with enough
   *  denormalised detail to aggregate money/units/seller slices without N+1s. */
  /** Restrict a loaded order set to those containing the seller's slice. */
  private scopedOrders(orders: any[], sellerScope?: string) {
    if (!sellerScope) return orders;
    return orders.filter((o) => o.sellerOrders?.some((s: any) => s.sellerId === sellerScope));
  }

  private async loadOrders(sellerScope?: string) {
    return this.prisma.order.findMany({
      where: this.scopeWhere(sellerScope),
      select: {
        id: true,
        status: true,
        grandTotal: true,
        placedAt: true,
        userId: true,
        items: {
          select: {
            quantity: true,
            lineTotal: true,
            productId: true,
            productNameSnapshot: true,
            sellerOrder: { select: { sellerId: true } },
          },
        },
        sellerOrders: {
          select: {
            id: true,
            sellerId: true,
            status: true,
            grandTotal: true,
            deliveredAt: true,
          },
        },
      },
      orderBy: { placedAt: 'asc' },
    });
  }

  private isCancelled(status: string) {
    return status === 'CANCELLED';
  }

  /** Order-level grand total, or only the matching seller slice(s) when scoped. */
  private sliceGmv(o: any, sellerScope?: string): number {
    if (!sellerScope) return this.num(o.grandTotal);
    return o.sellerOrders
      .filter((s: any) => s.sellerId === sellerScope)
      .reduce((sum: number, s: any) => sum + this.num(s.grandTotal), 0);
  }

  async overview(query: AnalyticsQueryDto, sellerScope?: string) {
    const win = resolveWindow(query.from, query.to);
    if (!win) throw new BadRequestException('Invalid analytics date range');
    let orders = await this.loadOrders(sellerScope);
    orders = orders.filter((o) => {
      const t = new Date(o.placedAt).getTime();
      return t >= win.from.getTime() && t <= win.to.getTime();
    });
    orders = this.scopedOrders(orders, sellerScope);

    const nonCancelled = orders.filter((o) => !this.isCancelled(o.status));
    const statusBreakdown: Record<string, number> = {};
    const buyerSet = new Set<string>();
    let units = 0;
    let gmvBySlice = 0; // platform/seller slice GMV (respects seller scope)
    for (const o of orders) {
      statusBreakdown[o.status] = (statusBreakdown[o.status] ?? 0) + 1;
    }
    for (const o of nonCancelled) {
      buyerSet.add(o.userId);
      for (const it of o.items) {
        if (sellerScope && it.sellerOrder?.sellerId !== sellerScope) continue;
        units += it.quantity;
      }
      // Order-level grandTotal IS the platform GMV; seller slice GMV sums slices.
      for (const so of o.sellerOrders) {
        if (sellerScope && so.sellerId !== sellerScope) continue;
        gmvBySlice += this.num(so.grandTotal);
      }
    }
    // If NOT seller-scoped, slice GMV == sum(order.grandTotal) of non-cancelled;
    // use the direct authoritative order grand total for platform GMV.
    const gmv = Math.round(
      (sellerScope ? gmvBySlice : nonCancelled.reduce((s, o) => s + this.num(o.grandTotal), 0)) * 100,
    ) / 100;
    const deliveredCount = orders.filter((o) => o.status === 'DELIVERED').length;
    const refundedCount = orders.filter((o) => o.status === 'REFUNDED').length;
    const orderCount = nonCancelled.length;
    const aov = orderCount ? Math.round((gmv / orderCount) * 100) / 100 : 0;

    // Returns / refunds in the same window (by request/completion time).
    const rrWin = { gte: win.from, lte: win.to };
    const returnReq = await this.prisma.returnRequest.findMany({
      where: sellerScope
        ? { requestedAt: rrWin, order: { sellerOrders: { some: { sellerId: sellerScope } } } }
        : { requestedAt: rrWin },
      select: { status: true, resolution: true, completedAt: true, refund: { select: { amount: true, status: true, completedAt: true } } },
    });
    const refundWin = await this.prisma.refund.findMany({
      where: sellerScope
        ? { completedAt: rrWin, sellerOrder: { sellerId: sellerScope } }
        : { completedAt: rrWin, status: 'COMPLETED' },
      select: { amount: true, status: true },
    });
    void refundWin;
    const completedRefunds = sellerScope
      ? refundWin.filter((r) => r.status === 'COMPLETED')
      : returnReq.flatMap((r) => (r.refund && r.refund.status === 'COMPLETED' ? [r.refund] : []));
    const refundedAmount = completedRefunds.reduce((s, r) => s + this.num(r.amount), 0);

    return {
      window: { from: win.from.toISOString(), to: win.to.toISOString() },
      currency: 'INR',
      orders: {
        total: orderCount,
        delivered: deliveredCount,
        refunded: refundedCount,
        cancelled: orders.filter((o) => this.isCancelled(o.status)).length,
        statusBreakdown,
      },
      commerce: {
        gmv,
        deliveredGmv: Math.round(
          (nonCancelled.length
            ? nonCancelled
                .filter((o) => o.status === 'DELIVERED')
                .reduce((s, o) => s + this.sliceGmv(o, sellerScope), 0)
            : 0) * 100,
        ) / 100,
        aov,
        unitsSold: units,
        uniqueBuyers: buyerSet.size,
        avgUnitsPerOrder: orderCount ? units / orderCount : 0,
      },
      returns: {
        requested: returnReq.length,
        completed: returnReq.filter((r) => r.status === 'COMPLETED').length,
        rejected: returnReq.filter((r) => r.status === 'REJECTED').length,
        replacements: returnReq.filter((r) => r.resolution === 'REPLACEMENT').length,
        refundedAmount,
      },
    };
  }

  /** Daily (UTC) order/GMV series over the window, zero-filled. */
  async trend(query: AnalyticsQueryDto, sellerScope?: string) {
    const win = resolveWindow(query.from, query.to);
    if (!win) throw new BadRequestException('Invalid analytics date range');
    let orders = await this.loadOrders(sellerScope);
    orders = orders.filter((o) => {
      const t = new Date(o.placedAt).getTime();
      return t >= win.from.getTime() && t <= win.to.getTime();
    });
    orders = this.scopedOrders(orders, sellerScope);
    // bucket date -> { orders, gmv }
    const series: Record<string, { orders: number; gmv: number }> = {};
    for (const o of orders) {
      if (this.isCancelled(o.status)) continue;
      const key = this.day(o.placedAt);
      const g = series[key] ?? { orders: 0, gmv: 0 };
      g.orders += 1;
      if (sellerScope) {
        const soGmv = o.sellerOrders.filter((s) => s.sellerId === sellerScope)
          .reduce((sum, s) => sum + this.num(s.grandTotal), 0);
        g.gmv += soGmv;
      } else {
        g.gmv += this.num(o.grandTotal);
      }
      series[key] = g;
    }
    // zero-fill every day in range
    const out: { date: string; orders: number; gmv: number }[] = [];
    const cursor = new Date(win.from);
    cursor.setUTCHours(0, 0, 0, 0);
    const end = new Date(win.to);
    while (cursor.getTime() <= end.getTime()) {
      const key = cursor.toISOString().slice(0, 10);
      const g = series[key] ?? { orders: 0, gmv: 0 };
      out.push({ date: key, orders: g.orders, gmv: Math.round(g.gmv * 100) / 100 });
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    return { window: { from: win.from.toISOString(), to: win.to.toISOString() }, currency: 'INR', series: out };
  }

  /** Top products by GMV/units sold in the window (optionally seller-scoped). */
  async products(query: AnalyticsListQueryDto, sellerScope?: string) {
    const win = resolveWindow(query.from, query.to);
    if (!win) throw new BadRequestException('Invalid analytics date range');
    const limit = query.limit ?? 10;
    let orders = await this.loadOrders(sellerScope);
    orders = orders.filter((o) => {
      const t = new Date(o.placedAt).getTime();
      return t >= win.from.getTime() && t <= win.to.getTime() && !this.isCancelled(o.status);
    });
    orders = this.scopedOrders(orders, sellerScope);
    const agg = new Map<string, { productId: string; productName: string; units: number; gmv: number }>();
    for (const o of orders) {
      for (const it of o.items) {
        if (sellerScope && it.sellerOrder?.sellerId !== sellerScope) continue;
        const cur = agg.get(it.productId) ?? {
          productId: it.productId,
          productName: it.productNameSnapshot || 'Unknown product',
          units: 0,
          gmv: 0,
        };
        cur.units += it.quantity;
        cur.gmv += this.num(it.lineTotal);
        agg.set(it.productId, cur);
      }
    }
    const rows = [...agg.values()]
      .sort((a, b) => b.gmv - a.gmv || b.units - a.units)
      .slice(0, limit)
      .map((p) => ({ ...p, gmv: Math.round(p.gmv * 100) / 100 }));
    const totalGmv = rows.reduce((s, r) => s + r.gmv, 0);
    return { window: { from: win.from.toISOString(), to: win.to.toISOString() }, currency: 'INR', rows, totalGmv: Math.round(totalGmv * 100) / 100 };
  }

  /** Category breakdown of GMV/units (optionally seller-scoped). */
  async categories(query: AnalyticsQueryDto, sellerScope?: string) {
    const win = resolveWindow(query.from, query.to);
    if (!win) throw new BadRequestException('Invalid analytics date range');
    let orders = await this.loadOrders(sellerScope);
    orders = orders.filter((o) => {
      const t = new Date(o.placedAt).getTime();
      return t >= win.from.getTime() && t <= win.to.getTime() && !this.isCancelled(o.status);
    });
    orders = this.scopedOrders(orders, sellerScope);
    // OrderItem snapshots productId only (no Product relation) — map it to its
    // current category so we can roll GMV/units up per category.
    const prodRows = await this.prisma.product.findMany({
      select: { id: true, category: { select: { id: true, name: true } } },
    });
    const prodCat = new Map<string, { id: string; name: string }>();
    for (const pr of prodRows) {
      if (pr.category) prodCat.set(pr.id, { id: pr.category.id, name: pr.category.name });
    }
    const agg = new Map<string, { categoryId: string; categoryName: string; units: number; gmv: number }>();
    for (const o of orders) {
      for (const it of o.items) {
        if (sellerScope && it.sellerOrder?.sellerId !== sellerScope) continue;
        const cat = prodCat.get(it.productId);
        const key = cat?.id ?? 'uncategorized';
        const cur = agg.get(key) ?? {
          categoryId: key,
          categoryName: cat?.name ?? 'Uncategorized',
          units: 0,
          gmv: 0,
        };
        cur.units += it.quantity;
        cur.gmv += this.num(it.lineTotal);
        agg.set(key, cur);
      }
    }
    const rows = [...agg.values()]
      .sort((a, b) => b.gmv - a.gmv)
      .map((c) => ({ ...c, gmv: Math.round(c.gmv * 100) / 100 }));
    return { window: { from: win.from.toISOString(), to: win.to.toISOString() }, currency: 'INR', rows };
  }

  /** Per-seller money roll-up (OPERATOR/ADMIN only) from the seller payable ledger. */
  async sellers(query: AnalyticsQueryDto) {
    const win = resolveWindow(query.from, query.to);
    if (!win) throw new BadRequestException('Invalid analytics date range');
    const payables = await this.prisma.sellerPayable.findMany({
      where: { earnedAt: { gte: win.from, lte: win.to } },
      include: { seller: { select: { id: true, sellerCode: true, displayName: true, commissionRateBps: true } } },
    });
    const agg = new Map<string, any>();
    for (const p of payables) {
      const sid = p.seller.id;
      const cur = agg.get(sid) ?? {
        sellerId: sid,
        sellerCode: p.seller.sellerCode,
        sellerName: p.seller.displayName,
        commissionRateBps: p.seller.commissionRateBps,
        paidSlices: 0,
        grossAmount: 0,
        goodsValue: 0,
        commissionAmount: 0,
        refundAmount: 0,
        adjustmentAmount: 0,
        netPayable: 0,
        netSettled: 0,
      };
      cur.paidSlices += 1;
      cur.grossAmount += this.num(p.grossAmount);
      cur.goodsValue += this.num(p.goodsValue);
      cur.commissionAmount += this.num(p.commissionAmount);
      cur.refundAmount += this.num(p.refundAmount);
      cur.adjustmentAmount += this.num(p.adjustmentAmount);
      cur.netPayable += this.num(p.netPayable);
      if (p.status === 'SETTLED') cur.netSettled += this.num(p.netPayable);
      agg.set(sid, cur);
    }
    const rows = [...agg.values()]
      .sort((a, b) => b.netPayable - a.netPayable)
      .map((r) => ({
        ...r,
        grossAmount: Math.round(r.grossAmount * 100) / 100,
        goodsValue: Math.round(r.goodsValue * 100) / 100,
        commissionAmount: Math.round(r.commissionAmount * 100) / 100,
        refundAmount: Math.round(r.refundAmount * 100) / 100,
        adjustmentAmount: Math.round(r.adjustmentAmount * 100) / 100,
        netPayable: Math.round(r.netPayable * 100) / 100,
        netSettled: Math.round(r.netSettled * 100) / 100,
      }));
    return { window: { from: win.from.toISOString(), to: win.to.toISOString() }, currency: 'INR', rows };
  }

  /** Resolve the caller's ACTIVE seller id for the SELLER surface. */
  async requireSellerId(userId: string): Promise<string> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.role !== 'SELLER') {
      throw new NotFoundException('Seller account not found');
    }
    if (!user.sellerId) throw new BadRequestException('Account is not linked to a seller organisation');
    const seller = await this.prisma.seller.findFirst({
      where: { id: user.sellerId, status: 'ACTIVE' },
    });
    if (!seller) throw new BadRequestException('Seller is not active');
    return user.sellerId;
  }
}
