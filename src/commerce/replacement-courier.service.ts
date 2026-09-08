import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import {
  DeliveryAssignmentStatus,
  DeliveryPartnerStatus,
  Prisma,
  ReplacementStatus,
  ReturnActorType,
  ReturnEventType,
} from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { COURIER_PROVIDER, type CourierProvider } from './courier/courier-provider.interface';
import type { ReplacementAssignmentPublic } from './commerce.types';

type Tx = Prisma.TransactionClient;

// Assignment statuses that "occupy" the replacement (block a second assignment).
const ACTIVE: DeliveryAssignmentStatus[] = [
  DeliveryAssignmentStatus.ASSIGNED,
  DeliveryAssignmentStatus.ACCEPTED,
  DeliveryAssignmentStatus.PICKED_UP,
  DeliveryAssignmentStatus.OUT_FOR_DELIVERY,
];
// Assignment statuses a DELIVERY partner can drive toward delivery.
const PARTNER_ACTIVE: DeliveryAssignmentStatus[] = [
  DeliveryAssignmentStatus.ACCEPTED,
  DeliveryAssignmentStatus.PICKED_UP,
  DeliveryAssignmentStatus.OUT_FOR_DELIVERY,
];

/**
 * Session 22 — ReplacementCourierService.
 * Last-mile courier leg for a DISPATCHED replacement. OPERATOR assigns the
 * replacement to a DELIVERY partner (a ReplacementAssignment); the partner drives
 * it through the courier lifecycle and its DELIVERED step auto-completes the
 * replacement (DISPATCHED -> COMPLETED). This is a NON-money leg: the replacement
 * never touches the Refund/ledger, no seller payable is created/debited, and the
 * original order status is unchanged (returns happen after the order is DELIVERED).
 */
@Injectable()
export class ReplacementCourierService {
  constructor(
    private readonly prisma: PrismaService,
    // Session 30: external courier-provider (tracking + POD). Optional so legacy
    // unit tests keep their `new ReplacementCourierService(prisma)` shape.
    @Optional() @Inject(COURIER_PROVIDER) private readonly courier?: CourierProvider | null,
  ) {}

  // =============================== OPERATOR / ADMIN ===============================

  /** Assign a DISPATCHED replacement to a DELIVERY partner (creates an ASSIGNED row). */
  async assignCourier(operatorId: string, returnRequestId: string, deliveryPartnerId: string) {
    const repl = await this.requireDispatchable(returnRequestId);
    if (!repl) {
      throw new ConflictException(
        'Replacement must be DISPATCHED and not yet completed/cancelled to assign a courier',
      );
    }
    const partner = await this.prisma.deliveryPartner.findUnique({ where: { id: deliveryPartnerId } });
    if (!partner) throw new NotFoundException('Delivery partner not found');
    if (partner.status !== DeliveryPartnerStatus.ACTIVE) {
      throw new ConflictException('Delivery partner is not ACTIVE');
    }
    const active = await this.prisma.replacementAssignment.findFirst({
      where: { replacementId: repl.id, status: { in: ACTIVE } },
    });
    if (active) {
      throw new ConflictException('This replacement already has an active courier assignment');
    }

    const assignment = await this.prisma.$transaction(async (tx) => {
      const created = await tx.replacementAssignment.create({
        data: {
          replacementId: repl.id,
          orderId: repl.orderId,
          deliveryPartnerId: partner.id,
          assignmentNumber: `RDLA-${randomBytes(4).toString('hex').toUpperCase()}`,
          status: DeliveryAssignmentStatus.ASSIGNED,
        },
      });
      await this.event(tx, repl.returnRequestId, ReturnEventType.REPLACEMENT_COURIER_ASSIGNED,
        ReturnActorType.OPERATOR, operatorId, `Courier ${partner.partnerCode} assigned to deliver replacement`);
      return created;
    });
    return this.toPublic(await this.load(assignment.id));
  }

  /** OPERATOR cancel an active replacement assignment (replacement returns to DISPATCHED pool). */
  async cancelAssignment(operatorId: string, assignmentId: string) {
    const a = await this.load(assignmentId);
    if (!a) throw new NotFoundException('Replacement assignment not found');
    if (!ACTIVE.includes(a.status)) {
      throw new ConflictException(`Only an active assignment can be cancelled (status ${a.status})`);
    }
    return this.prisma.$transaction(async (tx) => {
      await tx.replacementAssignment.update({
        where: { id: a.id },
        data: { status: DeliveryAssignmentStatus.CANCELLED, cancelledAt: new Date() },
      });
      await this.event(tx, a.replacement.returnRequestId, ReturnEventType.REPLACEMENT_COURIER_CANCELLED,
        ReturnActorType.OPERATOR, operatorId, 'Operator cancelled replacement courier assignment');
    });
  }

  /** OPERATOR/ADMIN list the replacement assignment(s) for a return request (operator view). */
  async listForReturn(returnRequestId: string) {
    const repl = await this.prisma.replacement.findUnique({ where: { returnRequestId } });
    if (!repl) throw new NotFoundException('Replacement not found');
    const rows = await this.prisma.replacementAssignment.findMany({
      where: { replacementId: repl.id },
      orderBy: { createdAt: 'desc' },
      include: { deliveryPartner: { include: { user: { select: { id: true, fullName: true } } } } },
    });
    return rows.map((r) => this.toPublic(r));
  }

  // =============================== DELIVERY partner ===============================

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

  private async owned(userId: string, assignmentId: string) {
    const partner = await this.requirePartner(userId);
    const a = await this.load(assignmentId);
    if (!a) throw new NotFoundException('Replacement assignment not found');
    if (a.deliveryPartnerId !== partner.id) {
      throw new ForbiddenException('This assignment is not yours');
    }
    return a;
  }

  /** My active replacement-delivery tasks (ACCEPTED/PICKED_UP/OUT_FOR_DELIVERY). */
  async partnerTasks(userId: string) {
    const partner = await this.requirePartner(userId);
    const rows = await this.prisma.replacementAssignment.findMany({
      where: { deliveryPartnerId: partner.id, status: { in: PARTNER_ACTIVE } },
      orderBy: { assignedAt: 'asc' },
      include: { replacement: { include: { returnRequest: true } }, order: true, deliveryPartner: { include: { user: { select: { id: true, fullName: true } } } } },
    });
    return rows.map((r) => this.toPublic(r));
  }

  /** Partner views a single replacement task (their own, active). */
  async partnerTask(userId: string, assignmentId: string) {
    const a = await this.owned(userId, assignmentId);
    return this.toPublic(a);
  }

  async accept(userId: string, assignmentId: string) {
    const a = await this.owned(userId, assignmentId);
    if (a.status !== DeliveryAssignmentStatus.ASSIGNED) {
      throw new ConflictException(`Assignment must be ASSIGNED to accept (status ${a.status})`);
    }
    await this.step(userId, a.id, a.replacement.returnRequestId, DeliveryAssignmentStatus.ACCEPTED,
      { acceptedAt: new Date() }, ReturnEventType.REPLACEMENT_COURIER_ACCEPTED, 'Courier accepted replacement');
    return this.toPublic(await this.load(a.id));
  }

  async reject(userId: string, assignmentId: string, reason: string) {
    const a = await this.owned(userId, assignmentId);
    if (a.status !== DeliveryAssignmentStatus.ASSIGNED) {
      throw new ConflictException(`Assignment must be ASSIGNED to reject (status ${a.status})`);
    }
    await this.step(userId, a.id, a.replacement.returnRequestId, DeliveryAssignmentStatus.REJECTED,
      { rejectedAt: new Date(), failureReason: reason }, ReturnEventType.REPLACEMENT_COURIER_REJECTED,
      `Courier rejected replacement: ${reason}`);
    return this.toPublic(await this.load(a.id));
  }

  async pickup(userId: string, assignmentId: string) {
    await this.partnerStep(userId, assignmentId, DeliveryAssignmentStatus.PICKED_UP,
      DeliveryAssignmentStatus.ACCEPTED, 'pickedUpAt', ReturnEventType.REPLACEMENT_COURIER_PICKED_UP, 'Courier collected replacement');
    // Session 30: book a courier-provider shipment (waybill) on collection.
    await this.bookShipment(assignmentId, userId);
    return this.toPublic(await this.load(assignmentId));
  }

  /** Session 30 — book a courier-provider shipment for a replacement on collection. Best-effort. */
  private async bookShipment(assignmentId: string, actorId: string) {
    if (!this.courier) return;
    const a = await this.load(assignmentId);
    if (!a || a.trackingNumber) return;
    const addr = (a.order?.addressSnapshot ?? null) as any;
    try {
      const ship = await this.courier.createShipment({
        ref: a.assignmentNumber,
        kind: 'replacement',
        description: a.replacement?.replacementReference
          ? `Replacement ${a.replacement.replacementReference}`
          : null,
        recipientName: a.order?.user?.fullName ?? addr?.name ?? null,
        phone: addr?.phone ?? null,
        line1: addr?.line1 ?? null,
        city: addr?.city ?? null,
        state: addr?.state ?? null,
        pincode: addr?.pincode ?? null,
      });
      await this.prisma.replacementAssignment.update({
        where: { id: a.id },
        data: { carrier: ship.carrier, trackingNumber: ship.trackingNumber, trackingUrl: ship.trackingUrl ?? null },
      });
      await this.event(null, a.replacement.returnRequestId, ReturnEventType.REPLACEMENT_COURIER_PICKED_UP,
        ReturnActorType.DELIVERY, actorId,
        `Replacement handed to ${ship.carrier} (waybill ${ship.trackingNumber})`);
    } catch (e) {
      await this.event(null, a.replacement.returnRequestId, ReturnEventType.REPLACEMENT_COURIER_FAILED,
        ReturnActorType.DELIVERY, actorId,
        `Courier booking failed for replacement: ${(e as Error).message}`);
    }
  }

  async outForDelivery(userId: string, assignmentId: string) {
    return this.partnerStep(userId, assignmentId, DeliveryAssignmentStatus.OUT_FOR_DELIVERY,
      DeliveryAssignmentStatus.PICKED_UP, 'outForDeliveryAt', ReturnEventType.REPLACEMENT_COURIER_OUT_FOR_DELIVERY, 'Replacement out for delivery');
  }

  private async partnerStep(
    userId: string,
    assignmentId: string,
    to: DeliveryAssignmentStatus,
    expected: DeliveryAssignmentStatus,
    field: 'pickedUpAt' | 'outForDeliveryAt',
    event: ReturnEventType,
    note: string,
  ) {
    const a = await this.owned(userId, assignmentId);
    if (a.status !== expected) {
      throw new ConflictException(`Cannot ${note.toLowerCase()}: assignment is ${a.status}`);
    }
    await this.step(userId, a.id, a.replacement.returnRequestId, to, { [field]: new Date() } as Prisma.ReplacementAssignmentUpdateInput,
      event, note);
    return this.toPublic(await this.load(a.id));
  }

  /**
   * Courier DELIVERS the replacement. Marks the assignment DELIVERED and
   * auto-completes the replacement (DISPATCHED -> COMPLETED) in one transaction.
   * Non-money: no Refund, no payable, no order-status change.
   */
  async deliver(userId: string, assignmentId: string) {
    const a = await this.owned(userId, assignmentId);
    if (a.status !== DeliveryAssignmentStatus.OUT_FOR_DELIVERY) {
      throw new ConflictException(`Replacement must be OUT_FOR_DELIVERY to deliver (status ${a.status})`);
    }
    if (a.replacement.status !== ReplacementStatus.DISPATCHED) {
      throw new ConflictException(
        `Replacement must be DISPATCHED to be delivered (it is ${a.replacement.status})`,
      );
    }

    // Session 30: capture POD from the courier provider OUTSIDE the DB transaction
    // (best-effort; a provider hiccup must never roll back the local completion).
    let pod: { podRef?: string | null; podSignedBy?: string | null; podAt?: Date | null } = {};
    if (this.courier && a.trackingNumber) {
      try {
        const p = await this.courier.confirmDelivery(a.trackingNumber);
        pod = {
          podRef: p.podRef ?? null,
          podSignedBy: p.signedBy ?? null,
          podAt: p.at ? new Date(p.at) : new Date(),
        };
      } catch {
        /* best-effort POD */
      }
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.replacementAssignment.update({
        where: { id: a.id },
        data: { status: DeliveryAssignmentStatus.DELIVERED, deliveredAt: new Date(), ...pod },
      });
      await tx.replacement.update({
        where: { id: a.replacementId },
        data: { status: ReplacementStatus.COMPLETED, completedAt: new Date() },
      });
      await this.event(tx, a.replacement.returnRequestId, ReturnEventType.REPLACEMENT_COMPLETED,
        ReturnActorType.DELIVERY, userId,
        `Replacement delivered to customer by courier (${a.assignmentNumber})`);
    });
    return this.toPublic(await this.load(a.id));
  }

  async fail(userId: string, assignmentId: string, reason: string) {
    const a = await this.owned(userId, assignmentId);
    if (!PARTNER_ACTIVE.includes(a.status)) {
      throw new ConflictException(`Cannot fail an assignment in status ${a.status}`);
    }
    await this.step(userId, a.id, a.replacement.returnRequestId, DeliveryAssignmentStatus.FAILED,
      { failureReason: reason }, ReturnEventType.REPLACEMENT_COURIER_FAILED,
      `Courier reported failed delivery: ${reason}`);
    return this.toPublic(await this.load(a.id));
  }

  // =============================== helpers ===============================

  /** Load the replacement to assign a courier to: must be DISPATCHED and not terminal. */
  private async requireDispatchable(returnRequestId: string) {
    const r = await this.prisma.returnRequest.findUnique({
      where: { id: returnRequestId },
      include: { replacement: true },
    });
    if (!r) throw new NotFoundException('Return request not found');
    if (!r.replacement) throw new ConflictException('No replacement was issued for this return');
    if (r.replacement.status !== ReplacementStatus.DISPATCHED) {
      return null;
    }
    return r.replacement;
  }

  private async step(
    actorId: string,
    id: string,
    returnRequestId: string,
    status: DeliveryAssignmentStatus,
    extra: Prisma.ReplacementAssignmentUpdateInput,
    event: ReturnEventType,
    note: string,
  ) {
    await this.prisma.replacementAssignment.update({ where: { id }, data: { status, ...extra } });
    await this.event(null, returnRequestId, event, ReturnActorType.DELIVERY, actorId, note);
  }

  private async event(
    tx: Tx | null,
    returnRequestId: string,
    eventType: ReturnEventType,
    actorType: ReturnActorType,
    actorId: string | null,
    note: string | null,
  ) {
    const data = { returnRequestId, eventType, actorType, actorId, reason: note };
    if (tx) await tx.returnEvent.create({ data });
    else await this.prisma.returnEvent.create({ data });
  }

  private async load(id: string) {
    return this.prisma.replacementAssignment.findUnique({
      where: { id },
      include: {
        // Replacement carries returnRequestId/replacementReference/status/quantityTotal.
        replacement: true,
        order: { include: { user: { select: { fullName: true } } } },
        deliveryPartner: { include: { user: { select: { id: true, fullName: true } } } },
      },
    });
  }

  private toPublic(a: any): ReplacementAssignmentPublic {
    const partner = a.deliveryPartner;
    const addr = (a.order?.addressSnapshot ?? null) as any;
    return {
      id: a.id,
      assignmentNumber: a.assignmentNumber,
      replacementId: a.replacementId,
      replacementReference: a.replacement?.replacementReference ?? null,
      returnRequestId: a.replacement?.returnRequestId ?? null,
      orderId: a.orderId,
      status: a.status,
      quantityTotal: a.replacement?.quantityTotal ?? null,
      deliveryPartner: partner
        ? { id: partner.id, partnerCode: partner.partnerCode, name: partner.user?.fullName ?? partner.partnerCode }
        : null,
      assignedAt: a.assignedAt?.toISOString?.() ?? null,
      acceptedAt: a.acceptedAt?.toISOString?.() ?? null,
      pickedUpAt: a.pickedUpAt?.toISOString?.() ?? null,
      outForDeliveryAt: a.outForDeliveryAt?.toISOString?.() ?? null,
      deliveredAt: a.deliveredAt?.toISOString?.() ?? null,
      rejectedAt: a.rejectedAt?.toISOString?.() ?? null,
      failureReason: a.failureReason ?? null,
      cancelledAt: a.cancelledAt?.toISOString?.() ?? null,
      // Session 30 — external courier tracking + POD.
      carrier: a.carrier ?? null,
      trackingNumber: a.trackingNumber ?? null,
      trackingUrl: a.trackingUrl ?? null,
      podRef: a.podRef ?? null,
      podSignedBy: a.podSignedBy ?? null,
      podAt: a.podAt?.toISOString?.() ?? null,
      // Operational delivery detail from the original order's address snapshot.
      customer: addr
        ? {
            name: a.order?.user?.fullName ?? addr.name ?? addr.recipientName ?? null,
            phone: addr.phone ?? addr.mobile ?? null,
            address: addr,
          }
        : null,
    };
  }
}
