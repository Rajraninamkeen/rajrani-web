import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  OrderActor,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  PaymentTransactionType,
  Prisma,
  RefundMethod,
  RefundState,
  ReturnStatus,
} from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateReturnDto,
  InitiateRefundDto,
  ReturnDecisionDto,
} from './dto/returns.dto';
import { ReturnRequestPublic } from './commerce.types';
import { RETURN_WINDOW_DAYS } from './returns.policy';

const DAY_MS = 24 * 60 * 60 * 1000;

const RND = () =>
  `${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

@Injectable()
export class ReturnsService {
  constructor(private readonly prisma: PrismaService) {}

  // ---------- customer ----------

  /** Customer requests a return on a delivered order (whole-order return slice). */
  async request(
    userId: string,
    orderId: string,
    dto: CreateReturnDto,
  ): Promise<ReturnRequestPublic> {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order || order.userId !== userId) throw new NotFoundException('Order not found');
    if (order.status !== OrderStatus.DELIVERED) {
      throw new BadRequestException('Only a delivered order can be returned');
    }
    if (order.paymentStatus === PaymentStatus.REFUNDED || order.paymentStatus === PaymentStatus.FAILED) {
      throw new BadRequestException('This order is not eligible for a return');
    }

    // Return window: within N days of delivery (server-authoritative).
    const deliveredAt = order.deliveredAt ?? order.updatedAt;
    if (Date.now() - deliveredAt.getTime() > RETURN_WINDOW_DAYS * DAY_MS) {
      throw new BadRequestException(
        `Return window closed (${RETURN_WINDOW_DAYS} days from delivery)`,
      );
    }

    const prior = await this.prisma.returnRequest.findFirst({
      where: { orderId, status: { not: ReturnStatus.REJECTED } },
    });
    if (prior) {
      throw new ConflictException('A return is already open for this order');
    }

    return this.prisma.$transaction(async (tx) => {
      const res = await tx.order.updateMany({
        where: { id: orderId, status: OrderStatus.DELIVERED },
        data: { status: OrderStatus.RETURN_REQUESTED },
      });
      if (res.count === 0) throw new ConflictException('Order state changed; please retry');

      const created = await tx.returnRequest.create({
        data: {
          orderId,
          reasonCode: dto.reasonCode,
          reasonNote: dto.note,
        },
        include: { refund: true },
      });

      await tx.orderStatusHistory.create({
        data: {
          orderId,
          fromStatus: OrderStatus.DELIVERED,
          toStatus: OrderStatus.RETURN_REQUESTED,
          actor: OrderActor.CUSTOMER,
          actorId: userId,
          reason: `Return requested (${dto.reasonCode})`,
          metadata: { returnRequestId: created.id },
        },
      });

      return this.toPublic(created, order.orderNumber);
    });
  }

  /** The open/active return for one of the customer's orders. */
  async getForOrder(userId: string, orderId: string): Promise<ReturnRequestPublic | null> {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order || order.userId !== userId) throw new NotFoundException('Order not found');
    const r = await this.prisma.returnRequest.findFirst({
      where: { orderId },
      orderBy: { createdAt: 'desc' },
      include: { refund: true },
    });
    return r ? this.toPublic(r, order.orderNumber) : null;
  }

  // ---------- operator decision / refund ----------

  /** Operator approves (→RETURNED) or rejects (→back to DELIVERED) a return. */
  async decide(
    operatorId: string,
    returnRequestId: string,
    dto: ReturnDecisionDto,
  ): Promise<ReturnRequestPublic> {
    const r = await this.loadOpenReturn(returnRequestId);
    const order = r.order;

    if (dto.approve) {
      return this.prisma.$transaction(async (tx) => {
        await this.move(tx, order.id, OrderStatus.RETURN_REQUESTED, OrderStatus.RETURNED, {
          actor: OrderActor.CONTROL,
          actorId: operatorId,
          reason: dto.reason ?? 'Return approved',
          metadata: { returnRequestId },
        });
        await tx.returnRequest.update({
          where: { id: returnRequestId },
          data: { status: ReturnStatus.APPROVED, approvedAt: new Date(), decisionBy: operatorId, decisionReason: dto.reason },
        });
        const updated = await tx.returnRequest.findUniqueOrThrow({
          where: { id: returnRequestId },
          include: { refund: true },
        });
        return this.toPublic(updated, order.orderNumber);
      });
    }

    // Reject requires a reason (spec: rejection reason mandatory for decisions).
    if (!dto.reason) {
      throw new BadRequestException('A reason is required to reject a return');
    }
    return this.prisma.$transaction(async (tx) => {
      await this.move(tx, order.id, OrderStatus.RETURN_REQUESTED, OrderStatus.DELIVERED, {
        actor: OrderActor.CONTROL,
        actorId: operatorId,
        reason: `Return rejected: ${dto.reason}`,
        metadata: { returnRequestId },
      });
      await tx.returnRequest.update({
        where: { id: returnRequestId },
        data: { status: ReturnStatus.REJECTED, rejectedAt: new Date(), decisionBy: operatorId, decisionReason: dto.reason },
      });
      const updated = await tx.returnRequest.findUniqueOrThrow({
        where: { id: returnRequestId },
        include: { refund: true },
      });
      return this.toPublic(updated, order.orderNumber);
    });
  }

  /** Operator initiates a refund for an approved (RETURNED) return. */
  async initiateRefund(
    operatorId: string,
    returnRequestId: string,
    dto: InitiateRefundDto,
  ): Promise<ReturnRequestPublic> {
    const r = await this.loadOpenReturn(returnRequestId);
    const order = r.order;
    if (r.status !== ReturnStatus.APPROVED) {
      throw new ConflictException('Return must be approved before refunding');
    }
    if (order.status !== OrderStatus.RETURNED) {
      throw new ConflictException('Order is not in RETURNED state');
    }
    if (order.paymentStatus === PaymentStatus.REFUNDED) {
      throw new ConflictException('This order has already been refunded');
    }

    const grandTotal = order.grandTotal.toNumber();
    const amount =
      dto.amount !== undefined
        ? Math.round(dto.amount * 100) / 100
        : Math.round(grandTotal * 100) / 100;
    if (amount > grandTotal + 0.001) {
      throw new BadRequestException('Refund amount exceeds the order grand total');
    }

    const method: RefundMethod =
      order.paymentMethod === PaymentMethod.COD ? RefundMethod.COD : RefundMethod.GATEWAY;

    // Link the original payment for PREPAID orders (money returns to that source).
    const payment =
      order.paymentMethod === PaymentMethod.PREPAID
        ? await this.prisma.payment.findUnique({ where: { orderId: order.id } })
        : null;

    return this.prisma.$transaction(async (tx) => {
      await this.move(tx, order.id, OrderStatus.RETURNED, OrderStatus.REFUND_PENDING, {
        actor: OrderActor.CONTROL,
        actorId: operatorId,
        reason: 'Refund initiated',
        metadata: { returnRequestId },
      });

      await tx.refund.create({
        data: {
          orderId: order.id,
          returnRequestId,
          paymentId: payment?.id,
          refundReference: `RFD-${RND()}`,
          amount,
          currency: order.currency,
          method,
          status: RefundState.PENDING,
          reason: 'customer return',
          initiatedById: operatorId,
          idempotencyKey: `refund-${returnRequestId}`,
        },
      });

      const updated = await tx.returnRequest.findUniqueOrThrow({
        where: { id: returnRequestId },
        include: { refund: true },
      });
      return this.toPublic(updated, order.orderNumber);
    });
  }

  /**
   * Sandbox refund completion. Backend authority only — real gateway completion
   * would replace this with a provider call keyed by the same Refund record.
   */
  async completeRefund(
    operatorId: string,
    returnRequestId: string,
  ): Promise<ReturnRequestPublic> {
    const r = await this.prisma.returnRequest.findUnique({
      where: { id: returnRequestId },
      include: { order: true, refund: true },
    });
    if (!r) throw new NotFoundException('Return request not found');
    if (!r.refund) throw new ConflictException('No refund has been initiated for this return');
    if (r.refund.status !== RefundState.PENDING) {
      throw new ConflictException('Refund is not in a completable state');
    }
    if (r.order.status !== OrderStatus.REFUND_PENDING) {
      throw new ConflictException('Order is not awaiting refund');
    }
    const refund = r.refund;

    return this.prisma.$transaction(async (tx) => {
      await this.move(tx, r.order.id, OrderStatus.REFUND_PENDING, OrderStatus.REFUNDED, {
        actor: OrderActor.CONTROL,
        actorId: operatorId,
        reason: 'Refund completed',
        metadata: { returnRequestId, refundId: refund.id },
      });

      await tx.order.update({
        where: { id: r.order.id },
        data: { paymentStatus: PaymentStatus.REFUNDED },
      });

      await tx.refund.update({
        where: { id: refund.id },
        data: {
          status: RefundState.COMPLETED,
          gatewayRef: `sndbox-refund-${RND()}`,
          completedAt: new Date(),
        },
      });

      // Finance trail on the original payment (PREPAID gateway refunds).
      if (refund.paymentId) {
        await tx.paymentTransaction.create({
          data: {
            paymentId: refund.paymentId,
            transactionType: PaymentTransactionType.REFUND,
            amount: refund.amount,
            currency: refund.currency,
            providerReference: refund.gatewayRef,
            status: 'SUCCESS',
            metadata: { refundId: refund.id },
          },
        });
      }

      await tx.returnRequest.update({
        where: { id: returnRequestId },
        data: { status: ReturnStatus.COMPLETED, completedAt: new Date() },
      });

      const updated = await tx.returnRequest.findUniqueOrThrow({
        where: { id: returnRequestId },
        include: { refund: true },
      });
      return this.toPublic(updated, r.order.orderNumber);
    });
  }

  // ---------- helpers ----------

  private async loadOpenReturn(returnRequestId: string) {
    const r = await this.prisma.returnRequest.findUnique({
      where: { id: returnRequestId },
      include: { order: true },
    });
    if (!r) throw new NotFoundException('Return request not found');
    if (r.status === ReturnStatus.COMPLETED || r.status === ReturnStatus.REJECTED) {
      throw new ConflictException('Return is already closed');
    }
    return r;
  }

  /** Guarded order status move + audited history row inside an existing tx. */
  private async move(
    tx: Prisma.TransactionClient,
    orderId: string,
    from: OrderStatus,
    to: OrderStatus,
    meta: {
      actor: OrderActor;
      actorId?: string;
      reason?: string;
      metadata?: Prisma.InputJsonValue;
    },
  ): Promise<void> {
    const res = await tx.order.updateMany({
      where: { id: orderId, status: from },
      data: { status: to },
    });
    if (res.count === 0) throw new ConflictException('Order state changed; please retry');
    await tx.orderStatusHistory.create({
      data: {
        orderId,
        fromStatus: from,
        toStatus: to,
        actor: meta.actor,
        actorId: meta.actorId,
        reason: meta.reason,
        metadata: (meta.metadata as Prisma.InputJsonObject) ?? undefined,
      },
    });
  }

  private toPublic(r: any, orderNumber: string): ReturnRequestPublic {
    const refund = r.refund
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
    return {
      id: r.id,
      orderId: r.orderId,
      orderNumber,
      status: r.status,
      reasonCode: r.reasonCode,
      reasonNote: r.reasonNote,
      requestedAt: r.requestedAt.toISOString(),
      approvedAt: r.approvedAt ? r.approvedAt.toISOString() : null,
      rejectedAt: r.rejectedAt ? r.rejectedAt.toISOString() : null,
      decisionReason: r.decisionReason,
      refund,
    };
  }
}
