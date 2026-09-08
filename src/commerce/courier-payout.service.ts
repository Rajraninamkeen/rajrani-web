import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CourierPayoutStatus,
  DeliveryPartnerStatus,
  Prisma,
} from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

type Tx = Prisma.TransactionClient;

/**
 * Session 32 — courier delivery-fee payout (the money leg).
 *
 * Per successful courier last-mile delivery the platform owes the DELIVERY partner
 * a per-leg delivery fee. One EARNED `CourierPayout` row is accrued atomically in
 * the SAME transaction that marks the courier assignment DELIVERED (so a payout is
 * never owed for a leg that is not actually delivered). Back-office pays a partner's
 * EARNED rows out (EARNED → SETTLED). A DELIVERY partner can read their own earnings.
 *
 * This is a separate platform→courier payable. It deliberately never touches a
 * Refund, a seller payable, or COD money (Session 22's "courier steps are non-money"
 * invariant is extended here ONLY to accrue this courier fee — nothing else changes).
 *
 * Fees come from `COURIER_FEE_PARCEL` / `COURIER_FEE_REPLACEMENT` (env, defaults 35/40)
 * under `configuration.ts` `courier.fees`. A zero/missing partner id yields no payout.
 */
const DEFAULT_FEES = { parcelFee: 35, replacementFee: 40 };

@Injectable()
export class CourierPayoutService {
  constructor(
    private readonly prisma: PrismaService,
    // Optional so historical unit tests keep `new CourierPayoutService(prisma)`.
    @Optional() private readonly config?: ConfigService,
  ) {}

  private feeFor(kind: 'parcel' | 'replacement'): number {
    const f = this.config?.get<{ parcelFee?: number; replacementFee?: number }>('courier.fees');
    const base = f ?? {};
    const n = kind === 'replacement' ? base.replacementFee : base.parcelFee;
    const fee = Number.isFinite(n) ? Number(n) : (kind === 'replacement' ? DEFAULT_FEES.replacementFee : DEFAULT_FEES.parcelFee);
    return Math.max(0, Math.round(fee * 100) / 100);
  }

  /**
   * Accrue an EARNED courier payout for a delivered courier leg. Must be called
   * inside the caller's DB transaction (it runs on `db`, not `this.prisma`). Idempotent
   * via the unique assignment column; returns null when there is no partner, no fee, or
   * the leg already earned.
   */
  async earnCourierDelivery(
    db: Tx,
    args: {
      deliveryPartnerId: string | null;
      kind: 'parcel' | 'replacement';
      orderId: string;
      sellerOrderId?: string | null;
      deliveryAssignmentId?: string | null;
      replacementAssignmentId?: string | null;
    },
  ) {
    if (!args.deliveryPartnerId) return null;
    const feeAmount = this.feeFor(args.kind);
    if (feeAmount <= 0) return null;
    const existing = await db.courierPayout.findFirst({
      where: {
        OR: [
          { deliveryAssignmentId: args.deliveryAssignmentId ?? undefined },
          { replacementAssignmentId: args.replacementAssignmentId ?? undefined },
        ].filter((o) => Object.values(o)[0] !== undefined),
      },
    });
    if (existing) return null;
    return db.courierPayout.create({
      data: {
        deliveryPartnerId: args.deliveryPartnerId,
        kind: args.kind,
        orderId: args.orderId,
        sellerOrderId: args.sellerOrderId ?? null,
        deliveryAssignmentId: args.deliveryAssignmentId ?? null,
        replacementAssignmentId: args.replacementAssignmentId ?? null,
        feeAmount,
        status: CourierPayoutStatus.EARNED,
      },
    });
  }

  // =============================== DELIVERY partner (self-service reads) ===============================

  /** Resolve the authenticated DELIVERY user's ACTIVE partner profile. */
  private async requirePartner(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.role !== 'DELIVERY') throw new ForbiddenException('Delivery-partner account required');
    const partner = await this.prisma.deliveryPartner.findUnique({ where: { userId } });
    if (!partner) throw new ForbiddenException('No delivery-partner profile bound to this account');
    if (partner.status !== DeliveryPartnerStatus.ACTIVE) {
      throw new ConflictException('Delivery partner is not ACTIVE');
    }
    return partner;
  }

  /** A DELIVERY partner's own courier payouts (their earnings history). */
  async partnerPayouts(userId: string, query: { status?: string; page?: number; limit?: number } = {}) {
    const partner = await this.requirePartner(userId);
    const page = Math.max(1, Math.floor(query.page ?? 1));
    const limit = Math.min(100, Math.max(1, Math.floor(query.limit ?? 20)));
    const where: Prisma.CourierPayoutWhereInput = { deliveryPartnerId: partner.id };
    if (query.status) {
      if (!(Object.values(CourierPayoutStatus) as string[]).includes(query.status)) {
        throw new NotFoundException(`Invalid payout status "${query.status}"`);
      }
      where.status = query.status as CourierPayoutStatus;
    }
    const [rows, total] = await Promise.all([
      this.prisma.courierPayout.findMany({
        where,
        orderBy: { earnedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.courierPayout.count({ where }),
    ]);
    return {
      payouts: rows.map((p) => this.public(p)),
      summary: await this.partnerSummary(partner.id),
      page,
      limit,
      total,
    };
  }

  /** Totals for a partner: earned/paid-out/settled amounts (INR). */
  async partnerSummary(partnerId: string) {
    const agg = (status: CourierPayoutStatus) =>
      this.prisma.courierPayout.aggregate({
        where: { deliveryPartnerId: partnerId, status },
        _sum: { feeAmount: true },
        _count: true,
      });
    const [earnedAgg, settledAgg, cancelledAgg] = await Promise.all([
      agg(CourierPayoutStatus.EARNED),
      agg(CourierPayoutStatus.SETTLED),
      agg(CourierPayoutStatus.CANCELLED),
    ]);
    const sum = (a: { feeAmount: Prisma.Decimal | null } | undefined) => (a?.feeAmount?.toNumber() ?? 0);
    const pending = sum(earnedAgg._sum);
    const paid = sum(settledAgg._sum);
    const cancelledAmt = sum(cancelledAgg._sum);
    const round = (n: number) => Math.round(n * 100) / 100;
    return {
      currency: 'INR',
      pendingAmount: round(pending),
      paidAmount: round(paid),
      cancelledAmount: round(cancelledAmt),
      totalEarnedAmount: round(pending + paid),
      counts: {
        pending: earnedAgg._count,
        paid: settledAgg._count,
        cancelled: cancelledAgg._count,
      },
    };
  }

  // =============================== Back-office (OPERATOR/ADMIN) ===============================

  /** Staff list of courier payouts (optional filters). */
  async staffList(query: { status?: string; deliveryPartnerId?: string; kind?: string; page?: number; limit?: number } = {}) {
    const page = Math.max(1, Math.floor(query.page ?? 1));
    const limit = Math.min(100, Math.max(1, Math.floor(query.limit ?? 20)));
    const where: Prisma.CourierPayoutWhereInput = {};
    if (query.status) where.status = query.status as CourierPayoutStatus;
    if (query.deliveryPartnerId) where.deliveryPartnerId = query.deliveryPartnerId;
    if (query.kind) where.kind = query.kind;
    const [rows, total] = await Promise.all([
      this.prisma.courierPayout.findMany({
        where,
        orderBy: { earnedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { deliveryPartner: { include: { user: { select: { id: true, fullName: true, email: true } } } } },
      }),
      this.prisma.courierPayout.count({ where }),
    ]);
    return { payouts: rows.map((p) => this.public(p)), page, limit, total };
  }

  /** Back-office summary across all partners (pending/paid totals). */
  async staffSummary() {
    const [earned, settled, cancelled, byPartner] = await Promise.all([
      this.prisma.courierPayout.aggregate({ where: { status: CourierPayoutStatus.EARNED }, _sum: { feeAmount: true } }),
      this.prisma.courierPayout.aggregate({ where: { status: CourierPayoutStatus.SETTLED }, _sum: { feeAmount: true } }),
      this.prisma.courierPayout.aggregate({ where: { status: CourierPayoutStatus.CANCELLED }, _sum: { feeAmount: true } }),
      this.prisma.courierPayout.groupBy({ by: ['deliveryPartnerId'], where: { status: CourierPayoutStatus.EARNED }, _sum: { feeAmount: true }, _count: { _all: true } }),
    ]);
    const partners = await this.prisma.deliveryPartner.findMany({
      where: { id: { in: byPartner.map((b) => b.deliveryPartnerId) } },
      include: { user: { select: { id: true, fullName: true, email: true } } },
    });
    const byId = new Map(partners.map((p) => [p.id, p]));
    const round = (n: number) => Math.round(n * 100) / 100;
    return {
      currency: 'INR',
      pendingAmount: round(earned._sum.feeAmount?.toNumber() ?? 0),
      paidAmount: round(settled._sum.feeAmount?.toNumber() ?? 0),
      cancelledAmount: round(cancelled._sum.feeAmount?.toNumber() ?? 0),
      partners: byPartner.map((b) => ({
        deliveryPartnerId: b.deliveryPartnerId,
        partnerCode: byId.get(b.deliveryPartnerId)?.partnerCode ?? null,
        name: byId.get(b.deliveryPartnerId)?.user?.fullName ?? byId.get(b.deliveryPartnerId)?.partnerCode ?? null,
        pendingAmount: round(b._sum.feeAmount?.toNumber() ?? 0),
        pendingCount: b._count._all,
      })),
    };
  }

  /** Pay out a partner's EARNED courier payouts (EARNED → SETTLED) in one tx. */
  async settlePartnerEarned(actorId: string, deliveryPartnerId: string) {
    const partner = await this.prisma.deliveryPartner.findUnique({ where: { id: deliveryPartnerId } });
    if (!partner) throw new NotFoundException('Delivery partner not found');
    const result = await this.prisma.$transaction(async (tx) => {
      const target = await tx.courierPayout.findMany({
        where: { deliveryPartnerId, status: CourierPayoutStatus.EARNED },
      });
      if (target.length === 0) {
        return { settled: 0, totalAmount: 0 };
      }
      const total = Math.round(target.reduce((s, p) => s + p.feeAmount.toNumber(), 0) * 100) / 100;
      await tx.courierPayout.updateMany({
        where: { deliveryPartnerId, status: CourierPayoutStatus.EARNED },
        data: { status: CourierPayoutStatus.SETTLED, settledAt: new Date(), settledById: actorId },
      });
      return { settled: target.length, totalAmount: total };
    });
    return result;
  }

  private public(p: any) {
    return {
      id: p.id,
      deliveryPartnerId: p.deliveryPartnerId,
      partnerCode: p.deliveryPartner?.partnerCode ?? null,
      partnerName: p.deliveryPartner?.user?.fullName ?? p.deliveryPartner?.partnerCode ?? null,
      kind: p.kind,
      orderId: p.orderId,
      sellerOrderId: p.sellerOrderId ?? null,
      deliveryAssignmentId: p.deliveryAssignmentId ?? null,
      replacementAssignmentId: p.replacementAssignmentId ?? null,
      feeAmount: p.feeAmount.toNumber(),
      currency: p.currency,
      status: p.status,
      earnedAt: p.earnedAt?.toISOString?.() ?? null,
      settledAt: p.settledAt?.toISOString?.() ?? null,
      settledById: p.settledById ?? null,
      cancelledAt: p.cancelledAt?.toISOString?.() ?? null,
    };
  }
}
