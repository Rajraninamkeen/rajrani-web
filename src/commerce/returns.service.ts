import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  InspectionResult,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  Prisma,
  RefundMethod,
  RefundState,
  ReturnActorType,
  ReturnEventType,
  ReturnStatus,
} from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateReturnDto,
  InspectionDto,
  ReturnDecisionDto,
} from './dto/returns.dto';
import {
  RefundPublic,
  ReturnItemPublic,
  ReturnRequestPublic,
} from './commerce.types';
import { INSPECTION_PARTIAL_PASS_RATE, RETURN_WINDOW_DAYS } from './returns.policy';

const DAY_MS = 24 * 60 * 60 * 1000;
const CENTS = (n: number) => Math.round(n * 100) / 100;

const RND = () =>
  `${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

const RETURN_INCLUDE = {
  items: {
    include: { orderItem: true, inspection: true },
  },
  refund: true,
  order: { include: { items: true } },
} as const;

type Full = any;

@Injectable()
export class ReturnsService {
  constructor(private readonly prisma: PrismaService) {}

  // ================= CUSTOMER =================

  /** Request an item-level return on a DELIVERED order. */
  async request(
    userId: string,
    orderId: string,
    dto: CreateReturnDto,
  ): Promise<ReturnRequestPublic> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });
    if (!order || order.userId !== userId) throw new NotFoundException('Order not found');
    this.assertReturnableOrder(order);

    // Remaining returnable qty per order item across non-closed prior requests.
    const closed: ReturnStatus[] = [ReturnStatus.REJECTED, ReturnStatus.CANCELLED];
    const priorItems = await this.prisma.returnItem.findMany({
      where: {
        returnRequest: { orderId, status: { notIn: closed } },
      },
    });
    const used = new Map<string, number>();
    for (const p of priorItems) used.set(p.orderItemId, (used.get(p.orderItemId) ?? 0) + p.quantity);

    // Build the item selection.
    const picks: { orderItem: (typeof order.items)[number]; quantity: number }[] = [];
    if (!dto.items || dto.items.length === 0) {
      for (const oi of order.items) {
        const remaining = oi.quantity - (used.get(oi.id) ?? 0);
        if (remaining > 0) picks.push({ orderItem: oi, quantity: remaining });
      }
    } else {
      const byId = new Map(order.items.map((o) => [o.id, o]));
      for (const it of dto.items) {
        const oi = byId.get(it.orderItemId);
        if (!oi) throw new BadRequestException('One or more items are not part of this order');
        const remaining = oi.quantity - (used.get(oi.id) ?? 0);
        if (it.quantity > remaining) {
          throw new BadRequestException(`Quantity exceeds the remaining returnable units for an item`);
        }
        picks.push({ orderItem: oi, quantity: it.quantity });
      }
    }
    if (picks.length === 0) {
      throw new BadRequestException('There is nothing left to return for this order');
    }

    return this.prisma.$transaction(async (tx) => {
      const rr = await tx.returnRequest.create({
        data: {
          orderId,
          reasonCode: dto.reasonCode,
          reasonNote: dto.note,
          items: {
            create: picks.map((p) => ({
              orderItemId: p.orderItem.id,
              quantity: p.quantity,
            })),
          },
        },
        include: RETURN_INCLUDE,
      });
      await this.eventTx(tx, rr.id, ReturnEventType.REQUESTED, ReturnActorType.CUSTOMER, userId, `Return requested (${dto.reasonCode})`);
      return this.toPublic(rr);
    });
  }

  /** The most recent return request(s) for one of the customer's orders. */
  async getForOrder(userId: string, orderId: string): Promise<ReturnRequestPublic[]> {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order || order.userId !== userId) throw new NotFoundException('Order not found');
    const rows = await this.prisma.returnRequest.findMany({
      where: { orderId },
      orderBy: { createdAt: 'desc' },
      include: RETURN_INCLUDE,
    });
    return rows.map((r) => this.toPublic(r));
  }

  // ================= OPERATOR: decision / pickup =================

  /** Approve (eligibility OK) or reject a REQUESTED return. */
  async decide(
    operatorId: string,
    returnRequestId: string,
    dto: ReturnDecisionDto,
  ): Promise<ReturnRequestPublic> {
    const r = await this.loadStatus(returnRequestId, ReturnStatus.REQUESTED);
    if (!dto.approve && !dto.reason) {
      throw new BadRequestException('A reason is required to reject a return');
    }
    return this.prisma.$transaction(async (tx) => {
      const to = dto.approve ? ReturnStatus.APPROVED : ReturnStatus.REJECTED;
      await tx.returnRequest.update({
        where: { id: returnRequestId },
        data: dto.approve
          ? { status: to, approvedAt: new Date(), decisionBy: operatorId, decisionReason: dto.reason }
          : { status: to, rejectedAt: new Date(), decisionBy: operatorId, decisionReason: dto.reason },
      });
      await this.eventTx(
        tx,
        returnRequestId,
        dto.approve ? ReturnEventType.APPROVED : ReturnEventType.REJECTED,
        ReturnActorType.OPERATOR,
        operatorId,
        dto.approve ? (dto.reason ?? 'Approved') : `Rejected: ${dto.reason}`,
      );
      const updated = await tx.returnRequest.findUniqueOrThrow({ where: { id: returnRequestId }, include: RETURN_INCLUDE });
      return this.toPublic(updated);
    });
  }

  async schedulePickup(operatorId: string, returnRequestId: string) {
    return this.step(
      operatorId,
      returnRequestId,
      ReturnStatus.APPROVED,
      ReturnStatus.PICKUP_SCHEDULED,
      ReturnEventType.PICKUP_SCHEDULED,
      { pickupScheduledAt: new Date() },
    );
  }

  async pickedUp(operatorId: string, returnRequestId: string) {
    return this.step(
      operatorId,
      returnRequestId,
      ReturnStatus.PICKUP_SCHEDULED,
      ReturnStatus.PICKED_UP,
      ReturnEventType.PICKED_UP,
      { pickedUpAt: new Date() },
    );
  }

  /** Record inspection results for provided return items. When every item has a
   *  result the request finalises into APPROVED_FOR_REFUND (refund amounts set). */
  async inspect(operatorId: string, returnRequestId: string, dto: InspectionDto) {
    const r = await this.loadStatus(returnRequestId, ReturnStatus.PICKED_UP);
    const itemIds = new Set(dto.items.map((i) => i.returnItemId));
    const items = r.items.filter((i: any) => itemIds.has(i.id));
    if (items.length !== itemIds.size) {
      throw new BadRequestException('Some return items are not part of this request');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      for (const insp of dto.items) {
        await tx.returnItem.update({
          where: { id: insp.returnItemId },
          data: { inspectionResult: insp.result, conditionNotes: insp.notes },
        });
        await tx.returnInspection.upsert({
          where: { returnItemId: insp.returnItemId },
          create: { returnItemId: insp.returnItemId, inspectorId: operatorId, result: insp.result, conditionNotes: insp.notes },
          update: { result: insp.result, conditionNotes: insp.notes },
        });
      }
      const refreshed = await tx.returnRequest.findUniqueOrThrow({
        where: { id: returnRequestId },
        include: RETURN_INCLUDE,
      });
      const allInspected = refreshed.items.every((i: any) => i.inspectionResult);
      let status = refreshed.status;
      if (allInspected) {
        status = ReturnStatus.APPROVED_FOR_REFUND;
        for (const it of refreshed.items) {
          const amount = this.finalizeItemRefund(it, refreshed.order);
          await tx.returnItem.update({ where: { id: it.id }, data: { refundAmount: amount } });
        }
        await tx.returnRequest.update({
          where: { id: returnRequestId },
          data: { status, inspectedAt: new Date(), approvedForRefundAt: new Date() },
        });
        await this.eventTx(tx, returnRequestId, ReturnEventType.APPROVED_FOR_REFUND, ReturnActorType.OPERATOR, operatorId, 'Inspection complete');
      } else {
        await tx.returnRequest.update({
          where: { id: returnRequestId },
          data: { status: ReturnStatus.INSPECTION, inspectedAt: new Date() },
        });
        await this.eventTx(tx, returnRequestId, ReturnEventType.INSPECTION, ReturnActorType.OPERATOR, operatorId, 'Inspection recorded');
      }
      const final = await tx.returnRequest.findUniqueOrThrow({ where: { id: returnRequestId }, include: RETURN_INCLUDE });
      return this.toPublic(final);
    });
    return result;
  }

  // ================= OPERATOR: refund =================

  /** Create the refund for an APPROVED_FOR_REFUND request. Amount is derived
   *  server-side from the approved return items (proportional allocation). */
  async initiateRefund(operatorId: string, returnRequestId: string) {
    const r = await this.loadStatus(returnRequestId, ReturnStatus.APPROVED_FOR_REFUND);
    if (r.refund) throw new ConflictException('A refund is already initiated for this return');
    const grandTotal = r.order.grandTotal.toNumber();
    let amount = 0;
    for (const it of r.items) {
      amount = CENTS(amount + (it.refundAmount ? it.refundAmount.toNumber() : 0));
    }
    if (amount <= 0) {
      throw new BadRequestException('No refundable amount remains for this return (all items FAILED inspection)');
    }
    // Never over-refund the order across multiple partial returns.
    const refundedSoFar = await this.prisma.refund.aggregate({
      where: { orderId: r.order.id, status: { in: [RefundState.PENDING, RefundState.PROCESSING, RefundState.COMPLETED] } },
      _sum: { amount: true },
    });
    const already = refundedSoFar._sum.amount ? refundedSoFar._sum.amount.toNumber() : 0;
    if (CENTS(already + amount) > CENTS(grandTotal + 0.001)) {
      throw new BadRequestException('Refund would exceed the order grand total');
    }

    const method: RefundMethod =
      r.order.paymentMethod === PaymentMethod.COD ? RefundMethod.COD : RefundMethod.GATEWAY;
    const payment =
      r.order.paymentMethod === PaymentMethod.PREPAID
        ? await this.prisma.payment.findUnique({ where: { orderId: r.order.id } })
        : null;

    return this.prisma.$transaction(async (tx) => {
      await tx.refund.create({
        data: {
          orderId: r.order.id,
          returnRequestId,
          paymentId: payment?.id,
          refundReference: `RFD-${RND()}`,
          amount,
          currency: r.order.currency,
          method,
          status: RefundState.PENDING,
          reason: 'customer return',
          initiatedById: operatorId,
          idempotencyKey: `refund-${returnRequestId}`,
        },
      });
      await this.eventTx(tx, returnRequestId, ReturnEventType.REFUND_INITIATED, ReturnActorType.OPERATOR, operatorId, `Refund ₹${amount.toFixed(2)} initiated`);
      const updated = await tx.returnRequest.findUniqueOrThrow({ where: { id: returnRequestId }, include: RETURN_INCLUDE });
      return this.toPublic(updated);
    });
  }

  /** Sandbox refund completion + ledger + terminal aggregate order update. */
  async completeRefund(operatorId: string, returnRequestId: string) {
    const r = await this.loadStatus(returnRequestId, ReturnStatus.APPROVED_FOR_REFUND);
    if (!r.refund) throw new ConflictException('No refund has been initiated for this return');
    if (r.refund.status !== RefundState.PENDING) {
      throw new ConflictException('Refund is not in a completable state');
    }
    const refund = r.refund;

    return this.prisma.$transaction(async (tx) => {
      const gatewayRef = `sndbox-refund-${RND()}`;
      await tx.refund.update({
        where: { id: refund.id },
        data: { status: RefundState.COMPLETED, gatewayRef, completedAt: new Date() },
      });
      await tx.refundTransaction.create({
        data: {
          refundId: refund.id,
          provider: refund.gatewayProvider ?? 'sandbox',
          providerReference: gatewayRef,
          amount: refund.amount,
          status: 'SUCCESS',
          completedAt: new Date(),
        },
      });
      await tx.returnRequest.update({
        where: { id: returnRequestId },
        data: { status: ReturnStatus.COMPLETED, completedAt: new Date() },
      });
      await this.eventTx(tx, returnRequestId, ReturnEventType.REFUND_COMPLETED, ReturnActorType.OPERATOR, operatorId, `Refund ₹${refund.amount.toNumber().toFixed(2)} completed`);

      // Aggregate: if the order is now fully refunded mark it terminal.
      const agg = await tx.refund.aggregate({
        where: { orderId: r.order.id, status: RefundState.COMPLETED },
        _sum: { amount: true },
      });
      const completed = agg._sum.amount ? agg._sum.amount.toNumber() : 0;
      if (completed >= r.order.grandTotal.toNumber() - 0.001) {
        await tx.order.update({
          where: { id: r.order.id },
          data: { status: OrderStatus.REFUNDED, paymentStatus: PaymentStatus.REFUNDED },
        });
      }
      const updated = await tx.returnRequest.findUniqueOrThrow({ where: { id: returnRequestId }, include: RETURN_INCLUDE });
      return this.toPublic(updated);
    });
  }

  // ================= helpers =================

  private assertReturnableOrder(order: any) {
    // Partial/item returns keep the order DELIVERED; the whole order only moves to
    // REFUNDED at the end (full aggregate refund), so the eligibility gate is:
    if (order.status !== OrderStatus.DELIVERED) {
      throw new BadRequestException('Only a delivered order can be returned');
    }
    if (order.paymentStatus === PaymentStatus.REFUNDED) {
      throw new BadRequestException('This order has already been fully refunded');
    }
    const deliveredAt = order.deliveredAt ?? order.updatedAt;
    if (Date.now() - deliveredAt.getTime() > RETURN_WINDOW_DAYS * DAY_MS) {
      throw new BadRequestException(`Return window closed (${RETURN_WINDOW_DAYS} days from delivery)`);
    }
  }

  private async loadStatus(returnRequestId: string, expected: ReturnStatus): Promise<Full> {
    const r = await this.prisma.returnRequest.findUnique({
      where: { id: returnRequestId },
      include: RETURN_INCLUDE,
    });
    if (!r) throw new NotFoundException('Return request not found');
    if (r.status !== expected) {
      throw new ConflictException(`Return is in state ${r.status}, expected ${expected}`);
    }
    return r;
  }

  private async step(
    operatorId: string,
    id: string,
    from: ReturnStatus,
    to: ReturnStatus,
    event: ReturnEventType,
    extra: Record<string, unknown>,
  ) {
    await this.loadStatus(id, from);
    return this.prisma.$transaction(async (tx) => {
      await tx.returnRequest.update({ where: { id }, data: { status: to, ...extra } });
      await this.eventTx(tx, id, event, ReturnActorType.OPERATOR, operatorId, event.replace(/_/g, ' ').toLowerCase());
      const updated = await tx.returnRequest.findUniqueOrThrow({ where: { id }, include: RETURN_INCLUDE });
      return this.toPublic(updated);
    });
  }

  private eventTx(
    tx: Prisma.TransactionClient,
    returnRequestId: string,
    eventType: ReturnEventType,
    actorType: ReturnActorType,
    actorId: string,
    reason: string,
  ) {
    return tx.returnEvent.create({
      data: { returnRequestId, eventType, actorType, actorId, reason },
    });
  }

  /** Per-item refund = the item's share of the order grand total (allocated by
   *  line value across all items) for the returned quantity, adjusted by the
   *  inspection result (PASS 100% / PARTIAL_PASS policy % / FAIL 0). */
  private finalizeItemRefund(it: Full, order: Full): number {
    const totalLine = order.items.reduce((s: number, oi: any) => s + oi.lineTotal.toNumber(), 0);
    const grand = order.grandTotal.toNumber();
    const oi = it.orderItem;
    const sharePerUnit = totalLine > 0 ? (grand * oi.lineTotal.toNumber()) / totalLine / oi.quantity : 0;
    const alloc = CENTS(sharePerUnit * it.quantity);
    let factor = 1;
    if (it.inspectionResult === InspectionResult.PARTIAL_PASS) factor = INSPECTION_PARTIAL_PASS_RATE;
    else if (it.inspectionResult === InspectionResult.FAIL) factor = 0;
    return CENTS(alloc * factor);
  }

  private toPublic(r: Full): ReturnRequestPublic {
    const refund: RefundPublic | null = r.refund
      ? {
          id: r.refund.id,
          refundReference: r.refund.refundReference,
          amount: r.refund.amount.toNumber(),
          currency: r.refund.currency,
          method: r.refund.method,
          status: r.refund.status,
          gatewayRef: r.refund.gatewayRef,
          initiatedAt: r.refund.initiatedAt.toISOString(),
          completedAt: r.refund.completedAt ? r.refund.completedAt.toISOString() : null,
        }
      : null;
    const items: ReturnItemPublic[] = (r.items ?? []).map((it: any) => ({
      id: it.id,
      orderItemId: it.orderItemId,
      productName: it.orderItem?.productNameSnapshot ?? null,
      quantity: it.quantity,
      conditionNotes: it.conditionNotes,
      inspectionResult: it.inspectionResult,
      refundAmount: it.refundAmount ? it.refundAmount.toNumber() : null,
      replacementRequested: it.replacementRequested,
    }));
    return {
      id: r.id,
      orderId: r.orderId,
      orderNumber: r.order?.orderNumber,
      status: r.status,
      reasonCode: r.reasonCode,
      reasonNote: r.reasonNote,
      requestedAt: r.requestedAt.toISOString(),
      approvedAt: r.approvedAt ? r.approvedAt.toISOString() : null,
      rejectedAt: r.rejectedAt ? r.rejectedAt.toISOString() : null,
      decisionReason: r.decisionReason,
      pickupScheduledAt: r.pickupScheduledAt ? r.pickupScheduledAt.toISOString() : null,
      pickedUpAt: r.pickedUpAt ? r.pickedUpAt.toISOString() : null,
      inspectedAt: r.inspectedAt ? r.inspectedAt.toISOString() : null,
      approvedForRefundAt: r.approvedForRefundAt ? r.approvedForRefundAt.toISOString() : null,
      completedAt: r.completedAt ? r.completedAt.toISOString() : null,
      cancelledAt: r.cancelledAt ? r.cancelledAt.toISOString() : null,
      items,
      refund,
    };
  }
}
