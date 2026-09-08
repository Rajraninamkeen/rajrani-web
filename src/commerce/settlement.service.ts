import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import {
  OrderStatus,
  PayableStatus,
  Prisma,
  RefundState,
  SellerOrderStatus,
  SettlementStatus,
} from '../generated/prisma/client';

/** Per-slice seller slice we need for payable computation (Session 09 fields + seller). */
export type PayableSliceInput = {
  subtotal: Prisma.Decimal | number;
  discountTotal: Prisma.Decimal | number;
  taxTotal: Prisma.Decimal | number;
  deliveryTotal: Prisma.Decimal | number;
  seller: { commissionRateBps: number };
};

export interface PayableBreakdown {
  grossAmount: number;
  discountAmount: number;
  goodsValue: number;
  commissionRateBps: number;
  commissionAmount: number;
  taxAmount: number;
  deliveryAmount: number;
  refundAmount: number;
  adjustmentAmount: number;
  netPayable: number;
}

function toNum(v: Prisma.Decimal | number): number {
  return typeof v === 'number' ? v : v.toNumber();
}

/** Owner-selected money rule (Session 12): seller earns goods value minus commission. */
export function computePayableBreakdown(slice: PayableSliceInput): PayableBreakdown {
  const subtotal = toNum(slice.subtotal);
  const discount = toNum(slice.discountTotal);
  const tax = toNum(slice.taxTotal);
  const delivery = toNum(slice.deliveryTotal);
  const bps = slice.seller.commissionRateBps || 0;

  const grossAmount = subtotal;
  const discountAmount = discount;
  const goodsValuePaise = Math.round((subtotal - discount) * 100);
  const commissionPaise = Math.round((goodsValuePaise * bps) / 10000);
  const commissionAmount = commissionPaise / 100;
  const goodsValue = goodsValuePaise / 100;
  const netPayable = (goodsValuePaise - commissionPaise) / 100;

  return {
    grossAmount,
    discountAmount,
    goodsValue,
    commissionRateBps: bps,
    commissionAmount,
    taxAmount: tax,
    deliveryAmount: delivery,
    refundAmount: 0,
    adjustmentAmount: 0,
    netPayable,
  };
}

// Legal forward settlement transitions (spec §104/§84 lean subset used).
const SETTLEMENT_NEXT: Record<SettlementStatus, SettlementStatus[]> = {
  [SettlementStatus.PENDING]: [SettlementStatus.APPROVED],
  [SettlementStatus.APPROVED]: [SettlementStatus.PROCESSING],
  [SettlementStatus.PROCESSING]: [SettlementStatus.PAID, SettlementStatus.FAILED],
  [SettlementStatus.PAID]: [SettlementStatus.RECONCILED],
  [SettlementStatus.RECONCILED]: [],
  [SettlementStatus.FAILED]: [SettlementStatus.PROCESSING], // retry
};

type Tx = Prisma.TransactionClient;

// A minimal paid-type subset shared by list/detail mappers.
type PayableRow = {
  id: string;
  sellerId: string;
  orderId: string;
  sellerOrderId: string;
  grossAmount: Prisma.Decimal;
  discountAmount: Prisma.Decimal;
  goodsValue: Prisma.Decimal;
  commissionRateBps: number;
  commissionAmount: Prisma.Decimal;
  taxAmount: Prisma.Decimal;
  deliveryAmount: Prisma.Decimal;
  refundAmount: Prisma.Decimal;
  adjustmentAmount: Prisma.Decimal;
  netPayable: Prisma.Decimal;
  currency: string;
  status: PayableStatus;
  earnedAt: Date;
  createdAt: Date;
  updatedAt: Date;
  seller?: { sellerCode: string; displayName: string };
  sellerOrder?: { sellerOrderNumber: string };
  order?: { orderNumber: string; status: string };
};

@Injectable()
export class SettlementService {
  constructor(private readonly prisma: PrismaService) {}

  private async requireSeller(userId: string): Promise<string> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.role !== 'SELLER') throw new ForbiddenException('Seller access only');
    if (!user.sellerId) throw new ForbiddenException('Account is not linked to a seller organisation');
    const seller = await this.prisma.seller.findFirst({ where: { id: user.sellerId, status: 'ACTIVE' } });
    if (!seller) throw new ForbiddenException('Seller is not active');
    return user.sellerId;
  }

  /**
   * Session 37 — optional inclusive [from, to] date filter for a DateTime column.
   * A date-only `to` (YYYY-MM-DD) is expanded to end-of-day so it is inclusive;
   * a full ISO timestamp is used as-is.
   */
  private dateFilter(from?: string, to?: string): { gte?: Date; lte?: Date } | null {
    if (!from && !to) return null;
    const f: { gte?: Date; lte?: Date } = {};
    if (from) {
      const d = new Date(from);
      if (Number.isNaN(d.getTime())) throw new BadRequestException(`Invalid "from" date "${from}"`);
      f.gte = d;
    }
    if (to) {
      const d = new Date(to);
      if (Number.isNaN(d.getTime())) throw new BadRequestException(`Invalid "to" date "${to}"`);
      f.lte = String(to).length <= 10 ? new Date(d.getTime() + 86399999) : d;
    }
    return f;
  }

  /**
   * Auto-earn a seller payable for every ACCEPTED slice of an order that has just
   * reached DELIVERED. Called inside the fulfilment transaction so delivery and
   * earning are atomic. Cancelled/REJECTED/unresolved slices never earn.
   * Idempotent: unique sellerOrderId on seller_payables prevents re-earning.
   */
  async earnDeliveredSlices(tx: Tx, orderId: string): Promise<number> {
    const slices = await tx.sellerOrder.findMany({
      where: { orderId, status: SellerOrderStatus.ACCEPTED },
      include: { seller: true },
    });
    let earned = 0;
    for (const so of slices) {
      const b = computePayableBreakdown(so);
      const exists = await tx.sellerPayable.findUnique({ where: { sellerOrderId: so.id } });
      if (exists) continue;
      await tx.sellerPayable.create({
        data: {
          sellerId: so.sellerId,
          orderId,
          sellerOrderId: so.id,
          grossAmount: b.grossAmount,
          discountAmount: b.discountAmount,
          goodsValue: b.goodsValue,
          commissionRateBps: b.commissionRateBps,
          commissionAmount: b.commissionAmount,
          taxAmount: b.taxAmount,
          deliveryAmount: b.deliveryAmount,
          refundAmount: b.refundAmount,
          adjustmentAmount: b.adjustmentAmount,
          netPayable: b.netPayable,
          currency: 'INR',
          status: PayableStatus.EARNED,
        },
      });
      earned++;
    }
    return earned;
  }

  // ---------------- Query (OPERATOR/ADMIN) ----------------

  async listPayables(query: { status?: string; sellerId?: string; from?: string; to?: string; page?: number; limit?: number }) {
    const page = Math.max(1, Math.floor(query.page ?? 1));
    const limit = Math.min(100, Math.max(1, Math.floor(query.limit ?? 20)));
    const where: Prisma.SellerPayableWhereInput = {};
    if (query.sellerId) where.sellerId = query.sellerId;
    if (query.status) {
      const st = (PayableStatus as Record<string, PayableStatus>)[query.status];
      if (!st) throw new BadRequestException(`Unknown payable status "${query.status}"`);
      where.status = st;
    }
    // Session 37 — optional period filter on earnedAt ([from, to]).
    const earned = this.dateFilter(query.from, query.to);
    if (earned) where.earnedAt = earned;
    const [rows, total] = await Promise.all([
      this.prisma.sellerPayable.findMany({
        where,
        orderBy: { earnedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          seller: { select: { sellerCode: true, displayName: true } },
          sellerOrder: { select: { sellerOrderNumber: true } },
          order: { select: { orderNumber: true, status: true } },
        },
      }),
      this.prisma.sellerPayable.count({ where }),
    ]);
    return {
      payables: rows.map((r) => this.toPublicPayable(r)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getPayable(payableId: string) {
    const p = await this.prisma.sellerPayable.findUnique({
      where: { id: payableId },
      include: {
        seller: { select: { sellerCode: true, displayName: true } },
        sellerOrder: { select: { sellerOrderNumber: true, orderId: true } },
        order: { select: { orderNumber: true, status: true } },
        adjustments: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!p) throw new NotFoundException('Payable not found');
    return { ...this.toPublicPayable(p), adjustments: p.adjustments };
  }

  /** Operator adds a signed adjustment to an EARNED payable (audited, append-only). */
  async addAdjustment(actorUserId: string, payableId: string, amount: number, reason: string) {
    if (!reason || !reason.trim()) throw new BadRequestException('A reason is required for a payable adjustment');
    if (!Number.isFinite(amount) || amount === 0) {
      throw new BadRequestException('Adjustment amount must be a non-zero number');
    }
    const adjustment = Math.round(amount * 100) / 100;
    const payable = await this.prisma.sellerPayable.findUnique({
      where: { id: payableId },
      include: { adjustments: true },
    });
    if (!payable) throw new NotFoundException('Payable not found');
    if (payable.status !== PayableStatus.EARNED) {
      throw new ConflictException('Only an EARNED (unsettled) payable can be adjusted');
    }
    const existingAdjustments = payable.adjustments.reduce((a, ad) => a + ad.amount.toNumber(), 0);
    // adjustment is signed: a negative value reduces the seller's net.
    const newNet = payable.netPayable.toNumber() + adjustment;
    if (newNet < -0.005) {
      throw new BadRequestException('Adjustment would make the seller payable negative');
    }
    const adjustmentAbs = Math.round((existingAdjustments + adjustment) * 100) / 100;
    return this.prisma.$transaction(async (tx) => {
      await tx.sellerPayableAdjustment.create({
        data: {
          sellerPayableId: payableId,
          amount: adjustment,
          reason,
          actorType: 'OPERATOR',
          actorId: actorUserId,
        },
      });
      return tx.sellerPayable.update({
        where: { id: payableId },
        data: {
          adjustmentAmount: adjustmentAbs,
          netPayable: Math.round(newNet * 100) / 100,
        },
      });
    });
  }

  // ---------------- Settlements ----------------

  async createSettlement(actorUserId: string, dto: { sellerId: string; payableIds: string[]; reason?: string }) {
    const seller = await this.prisma.seller.findUnique({ where: { id: dto.sellerId } });
    if (!seller) throw new NotFoundException('Seller not found');
    if (!dto.payableIds || dto.payableIds.length === 0) {
      throw new BadRequestException('Select at least one earned payable to settle');
    }
    const uniqueIds = [...new Set(dto.payableIds)];
    const ref = `STL-${randomBytes(4).toString('hex').toUpperCase()}`;

    const settlement = await this.prisma.$transaction(async (tx) => {
      const payables = await tx.sellerPayable.findMany({
        where: { id: { in: uniqueIds }, sellerId: dto.sellerId },
      });
      if (payables.length !== uniqueIds.length) {
        throw new BadRequestException('Some payables do not belong to this seller');
      }
      const notEarned = payables.filter((p) => p.status !== PayableStatus.EARNED);
      if (notEarned.length > 0) {
        throw new ConflictException('One or more payables are already in a settlement');
      }
      const created = await tx.settlement.create({
        data: {
          sellerId: dto.sellerId,
          settlementReference: ref,
          status: SettlementStatus.PENDING,
          grossAmount: payables.reduce((a, p) => a + p.grossAmount.toNumber(), 0),
          discountAmount: payables.reduce((a, p) => a + p.discountAmount.toNumber(), 0),
          goodsValue: payables.reduce((a, p) => a + p.goodsValue.toNumber(), 0),
          commissionAmount: payables.reduce((a, p) => a + p.commissionAmount.toNumber(), 0),
          taxAmount: payables.reduce((a, p) => a + p.taxAmount.toNumber(), 0),
          deliveryAmount: payables.reduce((a, p) => a + p.deliveryAmount.toNumber(), 0),
          refundAmount: payables.reduce((a, p) => a + p.refundAmount.toNumber(), 0),
          adjustmentAmount: payables.reduce((a, p) => a + p.adjustmentAmount.toNumber(), 0),
          netPayable: payables.reduce((a, p) => a + p.netPayable.toNumber(), 0),
          events: {
            create: {
              eventType: 'CREATED',
              actorId: actorUserId,
              reason: dto.reason ?? `Settlement created for ${payables.length} payables`,
            },
          },
        },
      });
      for (const p of payables) {
        await tx.settlementItem.create({
          data: {
            settlementId: created.id,
            sellerPayableId: p.id,
            sellerOrderId: p.sellerOrderId,
            amount: p.netPayable,
          },
        });
        await tx.sellerPayable.update({
          where: { id: p.id },
          data: { status: PayableStatus.IN_SETTLEMENT },
        });
      }
      return created;
    });
    return this.getSettlement(settlement.id);
  }

  async listSettlements(query: { status?: string; sellerId?: string; from?: string; to?: string; page?: number; limit?: number }) {
    const page = Math.max(1, Math.floor(query.page ?? 1));
    const limit = Math.min(100, Math.max(1, Math.floor(query.limit ?? 20)));
    const where: Prisma.SettlementWhereInput = {};
    if (query.sellerId) where.sellerId = query.sellerId;
    if (query.status) {
      const st = (SettlementStatus as Record<string, SettlementStatus>)[query.status];
      if (!st) throw new BadRequestException(`Unknown settlement status "${query.status}"`);
      where.status = st;
    }
    // Session 37 — optional period filter on createdAt ([from, to]).
    const created = this.dateFilter(query.from, query.to);
    if (created) where.createdAt = created;
    const [rows, total] = await Promise.all([
      this.prisma.settlement.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          seller: { select: { sellerCode: true, displayName: true } },
          _count: { select: { items: true } },
        },
      }),
      this.prisma.settlement.count({ where }),
    ]);
    return {
      settlements: rows.map((s) => ({ ...this.toPublicSettlement(s), itemCount: s._count.items })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getSettlement(settlementId: string) {
    const s = await this.prisma.settlement.findUnique({
      where: { id: settlementId },
      include: {
        seller: { select: { sellerCode: true, displayName: true } },
        items: {
          include: {
            sellerPayable: {
              include: {
                sellerOrder: { select: { sellerOrderNumber: true } },
                order: { select: { orderNumber: true } },
              },
            },
          },
        },
        events: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!s) throw new NotFoundException('Settlement not found');
    return this.toPublicSettlement(s);
  }

  /** Advance a settlement through its audited status machine. */
  async advanceSettlement(
    actorUserId: string,
    settlementId: string,
    to: SettlementStatus,
    reason?: string,
  ) {
    const settlement = await this.prisma.settlement.findUnique({ where: { id: settlementId } });
    if (!settlement) throw new NotFoundException('Settlement not found');
    const allowed = SETTLEMENT_NEXT[settlement.status];
    if (!allowed || !allowed.includes(to)) {
      throw new ConflictException(`Cannot move settlement from "${settlement.status}" to "${to}"`);
    }
    const now = new Date();
    const data: Prisma.SettlementUpdateManyMutationInput = { status: to };
    if (to === SettlementStatus.APPROVED) data.approvedAt = now;
    if (to === SettlementStatus.PROCESSING) data.processedAt = now;
    if (to === SettlementStatus.PAID) {
      data.paidAt = now;
      data.failedAt = null;
      data.failedReason = null;
    }
    if (to === SettlementStatus.RECONCILED) data.reconciledAt = now;
    if (to === SettlementStatus.FAILED) {
      data.failedAt = now;
      data.failedReason = reason ?? null;
    }
    if (to === SettlementStatus.PROCESSING && settlement.status === SettlementStatus.FAILED) {
      data.failedAt = null;
      data.failedReason = null;
    }

    await this.prisma.$transaction(async (tx) => {
      const res = await tx.settlement.updateMany({
        where: { id: settlementId, status: settlement.status },
        data,
      });
      if (res.count === 0) throw new ConflictException('Settlement state changed; please retry');
      await tx.settlementEvent.create({
        data: {
          settlementId,
          eventType: to,
          actorId: actorUserId,
          reason: reason ?? `Settlement: ${settlement.status} -> ${to}`,
        },
      });
      if (to === SettlementStatus.PAID) {
        const items = await tx.settlementItem.findMany({ where: { settlementId } });
        await tx.sellerPayable.updateMany({
          where: { id: { in: items.map((i) => i.sellerPayableId) } },
          data: { status: PayableStatus.SETTLED },
        });
      }
    });
    return this.getSettlement(settlementId);
  }

  // ---------------- Seller-facing read of their own money ----------------

  async myPayables(userId: string, query: { status?: string; page?: number; limit?: number }) {
    const sellerId = await this.requireSeller(userId);
    return this.listPayables({ ...query, sellerId });
  }

  async mySettlements(userId: string, query: { status?: string; page?: number; limit?: number }) {
    const sellerId = await this.requireSeller(userId);
    return this.listSettlements({ ...query, sellerId });
  }

  async mySettlement(userId: string, settlementId: string) {
    const sellerId = await this.requireSeller(userId);
    const s = await this.prisma.settlement.findFirst({
      where: { id: settlementId, sellerId },
      include: {
        seller: { select: { sellerCode: true, displayName: true } },
        items: {
          include: {
            sellerPayable: {
              include: {
                sellerOrder: { select: { sellerOrderNumber: true } },
                order: { select: { orderNumber: true } },
              },
            },
          },
        },
        events: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!s) throw new NotFoundException('Settlement not found');
    return this.toPublicSettlement(s);
  }

  // ---------------- Session 13: auto return-debit, reconciliation, reporting ----------------

  /**
   * Auto-debit delivered seller payables when a customer return/refund completes.
   * Owner-selected rule (net-zero on full return): the seller keeps nothing for
   * returned goods, so debit the returned goods' NET earnings =
   * returnedGoodsValue × (1 − sellerCommissionRate), floored at the payable's
   * remaining net (a payable is never driven below zero). Recorded as an audited,
   * append-only SellerPayableAdjustment (actorType SYSTEM). Only EARNED payables
   * are auto-debited — a payable already in a settlement/paid is out of this path
   * and surfaced by reconciliation instead.
   * Returns the total seller-borne debit applied across the returned slices.
   */
  async debitReturnedGoodsForRefund(
    tx: Tx,
    slices: { sellerOrderId: string; returnedGoodsValue: number }[],
    context: { refundReference?: string; returnRequestId?: string },
  ): Promise<{ applied: number; debits: { sellerOrderId: string; amount: number }[] }> {
    const debits: { sellerOrderId: string; amount: number }[] = [];
    for (const s of slices) {
      if (!s.returnedGoodsValue || s.returnedGoodsValue <= 0) continue;
      const sellerOrder = await tx.sellerOrder.findUnique({
        where: { id: s.sellerOrderId },
        include: { seller: true, payable: true },
      });
      if (!sellerOrder?.payable) continue; // no earned payable for this slice
      const payable = sellerOrder.payable;
      if (payable.status !== PayableStatus.EARNED) continue; // already settled/in settlement
      const rateBps = sellerOrder.seller.commissionRateBps || 0;
      const grossPaise = Math.round(s.returnedGoodsValue * 100);
      const netPaise = Math.round((grossPaise * (10000 - rateBps)) / 10000);
      const debit = netPaise / 100;
      const remainingPaise = Math.round(payable.netPayable.toNumber() * 100);
      const appliedPaise = Math.max(0, Math.min(Math.round(debit * 100), remainingPaise));
      if (appliedPaise <= 0) continue;
      const applied = appliedPaise / 100;
      const reason = `Seller return debit for ${context.returnRequestId ?? 'return'} (${context.refundReference ?? 'refund'})`;
      await tx.sellerPayableAdjustment.create({
        data: {
          sellerPayableId: payable.id,
          amount: -applied,
          reason,
          actorType: 'SYSTEM',
          actorId: context.returnRequestId ?? context.refundReference ?? null,
        },
      });
      await tx.sellerPayable.update({
        where: { id: payable.id },
        data: {
          refundAmount: payable.refundAmount.toNumber() + applied,
          adjustmentAmount:
            Math.round((payable.adjustmentAmount.toNumber() - applied) * 100) / 100,
          netPayable: (remainingPaise - appliedPaise) / 100,
        },
      });
      debits.push({ sellerOrderId: s.sellerOrderId, amount: applied });
    }
    return { applied: debits.reduce((a, d) => a + d.amount, 0), debits };
  }

  // ---------------- Reconciliation (read-only integrity checks) ----------------

  /**
   * Run ledger-integrity reconciliation across the finance domain. Read-only; never
   * mutates. Reports any discrepancies against the documented invariants. Query
   * shape returned is { checked, discrepancies: [{ kind, orderId?, payableId?, sellerId?,
   * detail }], totals: {...} }.
   */
  async runReconciliation() {
    const discrepancies: any[] = [];
    // Load the finance domain in one pass (dev scale; bounded by delivered orders).
    const orders = await this.prisma.order.findMany({
      where: { status: { in: [OrderStatus.DELIVERED, OrderStatus.REFUNDED] } },
      include: { sellerOrders: { include: { seller: true, payable: true, items: true } }, refunds: true },
    });

    let splitChecked = 0;
    let payableChecked = 0;

    for (const order of orders) {
      // 1. Order split invariant: SUM(seller_orders.grandTotal) == order.grandTotal.
      splitChecked++;
      const sumSlices = order.sellerOrders.reduce((a: number, so: any) => a + so.grandTotal.toNumber(), 0);
      if (Math.abs(sumSlices - order.grandTotal.toNumber()) > 0.005) {
        discrepancies.push({
          kind: 'order_split_mismatch',
          orderId: order.id,
          detail: `Σ seller_orders (${sumSlices.toFixed(2)}) != order.grandTotal (${order.grandTotal.toNumber().toFixed(2)})`,
        });
      }

      // 2. Refund cap: cumulative completed refunds never exceed order.grandTotal.
      const refunded = order.refunds.reduce((a: number, rf: any) => {
        return rf.status === RefundState.COMPLETED ? a + rf.amount.toNumber() : a;
      }, 0);
      if (refunded > order.grandTotal.toNumber() + 0.005) {
        discrepancies.push({
          kind: 'over_refund',
          orderId: order.id,
          detail: `completed refunds ₹${refunded.toFixed(2)} > order grand ₹${order.grandTotal.toNumber().toFixed(2)}`,
        });
      }

      // 3. Every ACCEPTED+delivered slice has a payable; every CANCELLED/rejected slice has none.
      for (const so of order.sellerOrders) {
        const delivered = !!so.deliveredAt;
        const acceptedDelivered = so.status === SellerOrderStatus.ACCEPTED && delivered;
        if (acceptedDelivered && !so.payable) {
          discrepancies.push({
            kind: 'delivered_slice_missing_payable',
            orderId: order.id,
            sellerOrderId: so.id,
            detail: `ACCEPTED+delivered slice ${so.sellerOrderNumber} has no seller payable`,
          });
        }
        if (so.status === SellerOrderStatus.CANCELLED && so.payable) {
          discrepancies.push({
            kind: 'payable_on_cancelled_slice',
            orderId: order.id,
            sellerOrderId: so.id,
            detail: `cancelled slice ${so.sellerOrderNumber} has a payable`,
          });
        }

        // 4. Payable net never negative; 5. ledger self-consistency recomputed from the
        // append-only adjustment ledger: net == goodsValue - commission + Σ(adjustments).
        if (so.payable) {
          payableChecked++;
          const p = so.payable;
          if (p.netPayable.toNumber() < -0.005) {
            discrepancies.push({
              kind: 'negative_payable',
              orderId: order.id,
              sellerOrderId: so.id,
              payableId: p.id,
              detail: `payable net ₹${p.netPayable.toNumber().toFixed(2)} < 0`,
            });
          }
          const adjustments = await this.prisma.sellerPayableAdjustment.findMany({
            where: { sellerPayableId: p.id },
          });
          const adjSum = adjustments.reduce((a: number, ad: any) => a + ad.amount.toNumber(), 0);
          const expected = Math.round((p.goodsValue.toNumber() - p.commissionAmount.toNumber() + adjSum) * 100) / 100;
          const actual = p.netPayable.toNumber();
          if (Math.abs(expected - actual) > 0.005) {
            discrepancies.push({
              kind: 'payable_ledger_mismatch',
              orderId: order.id,
              sellerOrderId: so.id,
              payableId: p.id,
              detail: `net ${actual.toFixed(2)} != goods ${p.goodsValue.toNumber().toFixed(2)} - comm ${p.commissionAmount.toNumber().toFixed(2)} + Σadj ${adjSum.toFixed(2)} = ${expected.toFixed(2)}`,
            });
          }
        }
      }
    }

    return {
      checked: { deliveredOrders: splitChecked, payables: payableChecked },
      discrepancies,
      discrepancyCount: discrepancies.length,
      ok: discrepancies.length === 0,
      generatedAt: new Date().toISOString(),
    };
  }

  /** Per-seller finance totals over payables earned in [from, to] (reporting). */
  async reportTotals(query: { from?: string; to?: string; sellerId?: string }) {
    const where: Prisma.SellerPayableWhereInput = {};
    if (query.sellerId) where.sellerId = query.sellerId;
    if (query.from || query.to) {
      where.earnedAt = {};
      if (query.from) where.earnedAt.gte = new Date(query.from);
      if (query.to) where.earnedAt.lte = new Date(query.to);
    }
    const rows = await this.prisma.sellerPayable.groupBy({
      by: ['sellerId'],
      where,
      _sum: {
        grossAmount: true,
        discountAmount: true,
        goodsValue: true,
        commissionAmount: true,
        taxAmount: true,
        deliveryAmount: true,
        refundAmount: true,
        adjustmentAmount: true,
        netPayable: true,
      },
      _count: { _all: true },
    });
    const sellers = await this.prisma.seller.findMany({
      where: { id: { in: rows.map((r: any) => r.sellerId) } },
    });
    const byId = new Map(sellers.map((s) => [s.id, s]));
    const perSeller = rows.map((r: any) => ({
      sellerId: r.sellerId,
      sellerCode: byId.get(r.sellerId)?.sellerCode,
      sellerName: byId.get(r.sellerId)?.displayName,
      payables: r._count._all,
      grossAmount: Number(r._sum.grossAmount ?? 0),
      discountAmount: Number(r._sum.discountAmount ?? 0),
      goodsValue: Number(r._sum.goodsValue ?? 0),
      commissionAmount: Number(r._sum.commissionAmount ?? 0),
      taxAmount: Number(r._sum.taxAmount ?? 0),
      deliveryAmount: Number(r._sum.deliveryAmount ?? 0),
      refundAmount: Number(r._sum.refundAmount ?? 0),
      adjustmentAmount: Number(r._sum.adjustmentAmount ?? 0),
      netPayable: Number(r._sum.netPayable ?? 0),
    }));
    const totals = perSeller.reduce(
      (a, x) => {
        a.payables += x.payables;
        a.grossAmount += x.grossAmount;
        a.discountAmount += x.discountAmount;
        a.goodsValue += x.goodsValue;
        a.commissionAmount += x.commissionAmount;
        a.taxAmount += x.taxAmount;
        a.deliveryAmount += x.deliveryAmount;
        a.refundAmount += x.refundAmount;
        a.adjustmentAmount += x.adjustmentAmount;
        a.netPayable += x.netPayable;
        return a;
      },
      {
        payables: 0,
        grossAmount: 0,
        discountAmount: 0,
        goodsValue: 0,
        commissionAmount: 0,
        taxAmount: 0,
        deliveryAmount: 0,
        refundAmount: 0,
        adjustmentAmount: 0,
        netPayable: 0,
      },
    );
    return { perSeller, totals, generatedAt: new Date().toISOString() };
  }

  // ---------------- Mappers ----------------

  private toPublicPayable(p: PayableRow) {
    return {
      id: p.id,
      sellerId: p.sellerId,
      orderId: p.orderId,
      sellerOrderId: p.sellerOrderId,
      sellerCode: p.seller?.sellerCode,
      sellerName: p.seller?.displayName,
      sellerOrderNumber: p.sellerOrder?.sellerOrderNumber,
      orderNumber: p.order?.orderNumber,
      orderStatus: p.order?.status,
      grossAmount: p.grossAmount.toNumber(),
      discountAmount: p.discountAmount.toNumber(),
      goodsValue: p.goodsValue.toNumber(),
      commissionRateBps: p.commissionRateBps,
      commissionAmount: p.commissionAmount.toNumber(),
      taxAmount: p.taxAmount.toNumber(),
      deliveryAmount: p.deliveryAmount.toNumber(),
      refundAmount: p.refundAmount.toNumber(),
      adjustmentAmount: p.adjustmentAmount.toNumber(),
      netPayable: p.netPayable.toNumber(),
      currency: p.currency,
      status: p.status,
      earnedAt: p.earnedAt.toISOString(),
    };
  }

  private toPublicSettlement(s: any) {
    return {
      id: s.id,
      settlementReference: s.settlementReference,
      sellerId: s.sellerId,
      sellerCode: s.seller?.sellerCode,
      sellerName: s.seller?.displayName,
      status: s.status,
      currency: s.currency,
      grossAmount: Number(s.grossAmount),
      discountAmount: Number(s.discountAmount),
      goodsValue: Number(s.goodsValue),
      commissionAmount: Number(s.commissionAmount),
      taxAmount: Number(s.taxAmount),
      deliveryAmount: Number(s.deliveryAmount),
      refundAmount: Number(s.refundAmount),
      adjustmentAmount: Number(s.adjustmentAmount),
      netPayable: Number(s.netPayable),
      approvedAt: s.approvedAt?.toISOString?.() ?? null,
      processedAt: s.processedAt?.toISOString?.() ?? null,
      paidAt: s.paidAt?.toISOString?.() ?? null,
      reconciledAt: s.reconciledAt?.toISOString?.() ?? null,
      failedAt: s.failedAt?.toISOString?.() ?? null,
      failedReason: s.failedReason ?? null,
      items:
        s.items?.map((i: any) => ({
          id: i.id,
          sellerPayableId: i.sellerPayableId,
          sellerOrderId: i.sellerOrderId,
          amount: Number(i.amount),
          orderNumber: i.sellerPayable?.order?.orderNumber ?? null,
          sellerOrderNumber: i.sellerPayable?.sellerOrder?.sellerOrderNumber ?? null,
        })) ?? [],
      events: s.events?.map((e: any) => ({
        eventType: e.eventType,
        actorId: e.actorId,
        reason: e.reason,
        createdAt: e.createdAt.toISOString(),
      })) ?? [],
    };
  }
}
