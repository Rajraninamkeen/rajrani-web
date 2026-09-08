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
  ReplacementStatus,
  ReturnActorType,
  ReturnEventType,
  ReturnResolution,
  ReturnStatus,
} from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SettlementService } from './settlement.service';
import {
  CancelReplacementDto,
  CreateReturnDto,
  DispatchReplacementDto,
  EvidenceUploadDto,
  InspectionDto,
  ReturnDecisionDto,
} from './dto/returns.dto';
import {
  RefundPublic,
  ReplacementPublic,
  ReturnEvidencePublic,
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
  evidence: { orderBy: { uploadedAt: 'asc' as const } },
  replacement: true,
  order: { include: { items: true } },
} as const;

type Full = any;

@Injectable()
export class ReturnsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settlement: SettlementService,
  ) {}

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

    // Session 16: customer may ask for a refund (default) or a replacement/exchange.
    // A REPLACEMENT resolution requires the customer to attach photo evidence.
    const resolution = dto.resolution ?? ReturnResolution.REFUND;
    const isReplacement = resolution === ReturnResolution.REPLACEMENT;
    const evidenceInput = (dto.evidence ?? []).map((e) => ({
      storageObjectId: e.storageObjectId,
      fileName: e.fileName ?? e.storageObjectId,
      mimeType: e.mimeType ?? null,
      sizeBytes: e.sizeBytes ?? null,
      kind: e.kind ?? 'IMAGE',
      uploadedBy: userId,
    }));

    return this.prisma.$transaction(async (tx) => {
      const rr = await tx.returnRequest.create({
        data: {
          orderId,
          reasonCode: dto.reasonCode,
          reasonNote: dto.note,
          resolution,
          evidenceRequired: isReplacement,
          items: {
            create: picks.map((p) => ({
              orderItemId: p.orderItem.id,
              quantity: p.quantity,
              replacementRequested: isReplacement,
            })),
          },
          ...(evidenceInput.length > 0 ? { evidence: { create: evidenceInput } } : {}),
        },
        include: RETURN_INCLUDE,
      });
      await this.eventTx(tx, rr.id, ReturnEventType.REQUESTED, ReturnActorType.CUSTOMER, userId, `Return requested (${dto.reasonCode}, remedy ${resolution.toLowerCase()})`);
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

  // ================= EVIDENCE (Session 16) =================

  /** Customer attaches evidence (photo/video) to their own return request. */
  async uploadEvidenceCustomer(
    userId: string,
    orderId: string,
    returnRequestId: string,
    dto: EvidenceUploadDto,
  ): Promise<ReturnRequestPublic> {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order || order.userId !== userId) throw new NotFoundException('Order not found');
    const rr = await this.prisma.returnRequest.findUnique({
      where: { id: returnRequestId, orderId },
    });
    if (!rr) throw new NotFoundException('Return request not found');
    this.assertEvidenceOpen(rr.status);
    return this.addEvidence(ReturnActorType.CUSTOMER, userId, returnRequestId, dto);
  }

  /** Operator attaches evidence on the customer's behalf (e.g. photographed at the
   *  warehouse / forwarded from the customer). */
  async uploadEvidenceOperator(
    operatorId: string,
    returnRequestId: string,
    dto: EvidenceUploadDto,
  ): Promise<ReturnRequestPublic> {
    const rr = await this.prisma.returnRequest.findUnique({ where: { id: returnRequestId } });
    if (!rr) throw new NotFoundException('Return request not found');
    this.assertEvidenceOpen(rr.status);
    return this.addEvidence(ReturnActorType.OPERATOR, operatorId, returnRequestId, dto);
  }

  private async addEvidence(
    actorType: ReturnActorType,
    actorId: string,
    returnRequestId: string,
    dto: EvidenceUploadDto,
  ) {
    return this.prisma.$transaction(async (tx) => {
      await tx.returnEvidence.create({
        data: {
          returnRequestId,
          storageObjectId: dto.storageObjectId,
          fileName: dto.fileName ?? dto.storageObjectId,
          mimeType: dto.mimeType ?? null,
          sizeBytes: dto.sizeBytes ?? null,
          kind: dto.kind ?? 'IMAGE',
          uploadedBy: actorId,
        },
      });
      await this.eventTx(tx, returnRequestId, ReturnEventType.EVIDENCE_UPLOADED, actorType, actorId, 'Evidence uploaded');
      const updated = await tx.returnRequest.findUniqueOrThrow({ where: { id: returnRequestId }, include: RETURN_INCLUDE });
      return this.toPublic(updated);
    });
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
      const isReplacement = refreshed.resolution === ReturnResolution.REPLACEMENT;
      if (allInspected) {
        if (isReplacement) {
          // Session 16: a REPLACEMENT resolution finalises terminal REPLACEMENT_ISSUED.
          // No Refund is created and no seller payable is auto-debited. Only items that
          // passed inspection (PASS / PARTIAL_PASS) count toward the replacement qty.
          const eligible = refreshed.items.filter(
            (i: any) => i.inspectionResult !== InspectionResult.FAIL,
          );
          const qty = eligible.reduce((s: number, i: any) => s + i.quantity, 0);
          if (qty <= 0) {
            throw new BadRequestException('No return item qualified for a replacement (all failed inspection)');
          }
          const replacementReference = `RPL-${RND()}`;
          await tx.returnRequest.update({
            where: { id: returnRequestId },
            data: { status: ReturnStatus.REPLACEMENT_ISSUED, inspectedAt: new Date() },
          });
          await tx.replacement.create({
            data: {
              returnRequestId,
              orderId: refreshed.orderId,
              sellerOrderId: eligible[0]?.orderItem?.sellerOrderId ?? null,
              replacementReference,
              status: ReplacementStatus.PENDING_DISPATCH,
              quantityTotal: qty,
              issuedBy: operatorId,
            },
          });
          await this.eventTx(tx, returnRequestId, ReturnEventType.REPLACEMENT_ISSUED, ReturnActorType.OPERATOR, operatorId, `Replacement issued for ${qty} unit(s)`);
        } else {
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
        }
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

  // ================= OPERATOR: replacement dispatch (Session 17) =================

  /** Load a return request that has reached terminal REPLACEMENT_ISSUED with a
   *  replacement row present; the outbound leg (ReplacementStatus) is driven from here. */
  private async loadIssuedReplacement(
    returnRequestId: string,
    expectedReplacementStatus?: ReplacementStatus,
  ): Promise<Full> {
    const r = await this.prisma.returnRequest.findUnique({
      where: { id: returnRequestId },
      include: RETURN_INCLUDE,
    });
    if (!r) throw new NotFoundException('Return request not found');
    if (r.status !== ReturnStatus.REPLACEMENT_ISSUED) {
      throw new ConflictException(`Return is in state ${r.status}; replacement dispatch requires REPLACEMENT_ISSUED`);
    }
    if (!r.replacement) throw new ConflictException('No replacement was issued for this return');
    if (expectedReplacementStatus && r.replacement.status !== expectedReplacementStatus) {
      throw new ConflictException(
        `Replacement is in state ${r.replacement.status}, expected ${expectedReplacementStatus}`,
      );
    }
    return r;
  }

  private async replacementTransition(
    operatorId: string,
    returnRequestId: string,
    expected: ReplacementStatus,
    to: ReplacementStatus,
    event: ReturnEventType,
    patch: Record<string, unknown>,
    reason: string,
  ): Promise<ReturnRequestPublic> {
    await this.loadIssuedReplacement(returnRequestId, expected);
    return this.prisma.$transaction(async (tx) => {
      await tx.replacement.update({
        where: { returnRequestId },
        data: { status: to, ...patch },
      });
      await this.eventTx(tx, returnRequestId, event, ReturnActorType.OPERATOR, operatorId, reason);
      const updated = await tx.returnRequest.findUniqueOrThrow({
        where: { id: returnRequestId },
        include: RETURN_INCLUDE,
      });
      return this.toPublic(updated);
    });
  }

  /** PENDING_DISPATCH -> DISPATCHED (outbound replacement shipped). No money/ledger. */
  async dispatchReplacement(
    operatorId: string,
    returnRequestId: string,
    dto: DispatchReplacementDto,
  ): Promise<ReturnRequestPublic> {
    return this.replacementTransition(
      operatorId,
      returnRequestId,
      ReplacementStatus.PENDING_DISPATCH,
      ReplacementStatus.DISPATCHED,
      ReturnEventType.REPLACEMENT_DISPATCHED,
      {
        dispatchedAt: new Date(),
        dispatchBy: operatorId,
        dispatchReference: dto.dispatchReference ?? null,
        dispatchNote: dto.dispatchNote ?? null,
      },
      `Replacement dispatched (${dto.dispatchReference ?? 'no ref'})`,
    );
  }

  /** DISPATCHED -> COMPLETED (delivered/settled with the customer). */
  async completeReplacement(operatorId: string, returnRequestId: string): Promise<ReturnRequestPublic> {
    return this.replacementTransition(
      operatorId,
      returnRequestId,
      ReplacementStatus.DISPATCHED,
      ReplacementStatus.COMPLETED,
      ReturnEventType.REPLACEMENT_COMPLETED,
      { completedAt: new Date() },
      'Replacement delivered to customer',
    );
  }

  /** PENDING_DISPATCH or DISPATCHED -> CANCELLED (e.g. stock unavailable). A reason
   *  is required. */
  async cancelReplacement(
    operatorId: string,
    returnRequestId: string,
    dto: CancelReplacementDto,
  ): Promise<ReturnRequestPublic> {
    if (!dto.reason) throw new BadRequestException('A reason is required to cancel a replacement');
    // Either of two source states may be cancelled.
    const r = await this.loadIssuedReplacement(returnRequestId);
    const s = r.replacement.status;
    if (s !== ReplacementStatus.PENDING_DISPATCH && s !== ReplacementStatus.DISPATCHED) {
      throw new ConflictException(`Replacement is in state ${s}; cannot cancel`);
    }
    return this.replacementTransition(
      operatorId,
      returnRequestId,
      s,
      ReplacementStatus.CANCELLED,
      ReturnEventType.REPLACEMENT_CANCELLED,
      { cancelledAt: new Date(), cancellationReason: dto.reason },
      `Replacement cancelled: ${dto.reason}`,
    );
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

      // Session 13: auto-debit the delivered sellers' earned payables for the goods
      // that were returned & refunded (net-zero rule; only EARNED payables). Group the
      // refunded return lines (those that actually got a refund) by their seller slice.
      const refundedBySlice = new Map<string, number>();
      for (const item of r.items ?? []) {
        const refundable = item.refundAmount && item.refundAmount.toNumber() > 0;
        if (!refundable || !item.orderItem) continue;
        const sellerOrderId = item.orderItem.sellerOrderId as string | undefined;
        if (!sellerOrderId) continue;
        const goods = item.orderItem.unitPrice.toNumber() * item.quantity;
        refundedBySlice.set(sellerOrderId, (refundedBySlice.get(sellerOrderId) ?? 0) + goods);
      }
      if (refundedBySlice.size > 0) {
        await this.settlement.debitReturnedGoodsForRefund(
          tx,
          [...refundedBySlice.entries()].map(([sellerOrderId, returnedGoodsValue]) => ({
            sellerOrderId,
            returnedGoodsValue,
          })),
          { refundReference: refund.refundReference, returnRequestId },
        );
      }

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

  /** Evidence may be added while a request is still resolvable (not yet terminal). */
  private assertEvidenceOpen(status: ReturnStatus) {
    const closed: ReturnStatus[] = [
      ReturnStatus.REPLACEMENT_ISSUED,
      ReturnStatus.COMPLETED,
      ReturnStatus.CANCELLED,
    ];
    if (closed.includes(status)) {
      throw new ConflictException(`Cannot attach evidence to a ${status} return request`);
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
    const evidence: ReturnEvidencePublic[] = (r.evidence ?? []).map((e: any) => ({
      id: e.id,
      storageObjectId: e.storageObjectId,
      fileName: e.fileName ?? null,
      mimeType: e.mimeType ?? null,
      sizeBytes: e.sizeBytes ?? null,
      kind: e.kind,
      uploadedBy: e.uploadedBy ?? null,
      uploadedAt: e.uploadedAt.toISOString(),
    }));
    const replacement: ReplacementPublic | null = r.replacement
      ? {
          id: r.replacement.id,
          replacementReference: r.replacement.replacementReference,
          status: r.replacement.status,
          quantityTotal: r.replacement.quantityTotal,
          issuedBy: r.replacement.issuedBy ?? null,
          issuedAt: r.replacement.issuedAt.toISOString(),
          dispatchedAt: r.replacement.dispatchedAt ? r.replacement.dispatchedAt.toISOString() : null,
          dispatchReference: r.replacement.dispatchReference ?? null,
          dispatchNote: r.replacement.dispatchNote ?? null,
          dispatchBy: r.replacement.dispatchBy ?? null,
          completedAt: r.replacement.completedAt ? r.replacement.completedAt.toISOString() : null,
          cancelledAt: r.replacement.cancelledAt ? r.replacement.cancelledAt.toISOString() : null,
          cancellationReason: r.replacement.cancellationReason ?? null,
        }
      : null;
    return {
      id: r.id,
      orderId: r.orderId,
      orderNumber: r.order?.orderNumber,
      status: r.status,
      resolution: r.resolution ?? ReturnResolution.REFUND,
      reasonCode: r.reasonCode,
      reasonNote: r.reasonNote,
      evidenceRequired: r.evidenceRequired ?? false,
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
      evidence,
      replacement,
      refund,
    };
  }
}
