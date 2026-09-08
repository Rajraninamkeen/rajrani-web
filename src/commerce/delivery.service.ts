import {
  BadRequestException,
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
  OrderActor,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  Prisma,
  SellerOrderStatus,
} from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SettlementService } from './settlement.service';
import { COURIER_PROVIDER, type CourierProvider } from './courier/courier-provider.interface';
import { CourierPayoutService } from './courier-payout.service';
import {
  AssignSliceDto,
  DeliveryListQuery,
  FailAssignmentDto,
  RegisterDeliveryPartnerDto,
  RejectAssignmentDto,
} from './delivery.dto';

type Tx = Prisma.TransactionClient;

// Stages an order may be in for courier last-mile (slice delivery) to apply.
const COURIER_ORDER_STAGES: OrderStatus[] = [OrderStatus.SHIPPED, OrderStatus.OUT_FOR_DELIVERY];
// Assignment statuses that occupy a slice (an operator may not reassign until these end).
const ACTIVE_ASSIGNMENT: DeliveryAssignmentStatus[] = [
  DeliveryAssignmentStatus.ASSIGNED,
  DeliveryAssignmentStatus.ACCEPTED,
  DeliveryAssignmentStatus.PICKED_UP,
  DeliveryAssignmentStatus.OUT_FOR_DELIVERY,
];
// Slice assignments a DELIVERY partner can act on.
const PARTNER_ACTIVE: DeliveryAssignmentStatus[] = [
  DeliveryAssignmentStatus.ACCEPTED,
  DeliveryAssignmentStatus.PICKED_UP,
  DeliveryAssignmentStatus.OUT_FOR_DELIVERY,
];

@Injectable()
export class DeliveryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settlement: SettlementService,
    // Session 30: external courier-provider (tracking + POD). Optional so legacy
    // unit tests that `new DeliveryService(prisma, settlement)` keep working.
    @Optional() @Inject(COURIER_PROVIDER) private readonly courier?: CourierProvider | null,
    // Session 32: courier delivery-fee payout (money leg). Optional test seam.
    // Explicit @Inject token: the `| null` union erases the class from design:paramtypes,
    // so without it Nest cannot resolve the dependency and @Optional would inject undefined.
    @Optional() @Inject(CourierPayoutService) private readonly courierPayout?: CourierPayoutService | null,
  ) {}

  // =============================== Partner registry (OPERATOR/ADMIN) ===============================

  /** Bind a DELIVERY-role user to a delivery-partner profile so they can receive tasks. */
  async registerPartner(actorId: string, dto: RegisterDeliveryPartnerDto) {
    const user = await this.prisma.user.findUnique({ where: { id: dto.userId } });
    if (!user) throw new NotFoundException('User not found');
    if (user.role !== 'DELIVERY') {
      throw new BadRequestException('A delivery partner profile requires a DELIVERY-role user');
    }
    const existing = await this.prisma.deliveryPartner.findUnique({ where: { userId: user.id } });
    if (existing) throw new ConflictException('This user already has a delivery-partner profile');
    const partnerCode = dto.partnerCode ?? `DLV-${randomBytes(4).toString('hex').toUpperCase()}`;
    const partner = await this.prisma.deliveryPartner.create({
      data: {
        userId: user.id,
        partnerCode,
        status: DeliveryPartnerStatus.ACTIVE,
        vehicleType: dto.vehicleType ?? null,
      },
    });
    return this.partnerPublic(partner);
  }

  async listPartners() {
    const rows = await this.prisma.deliveryPartner.findMany({
      orderBy: { createdAt: 'asc' },
      include: { user: { select: { id: true, email: true, fullName: true, role: true, status: true } } },
    });
    return rows.map((p) => this.partnerPublic(p));
  }

  async setPartnerStatus(actorId: string, partnerId: string, status: DeliveryPartnerStatus) {
    const p = await this.prisma.deliveryPartner.findUnique({ where: { id: partnerId } });
    if (!p) throw new NotFoundException('Delivery partner not found');
    const updated = await this.prisma.deliveryPartner.update({ where: { id: partnerId }, data: { status } });
    return this.partnerPublic(updated);
  }

  // =============================== Operator assignment management (OPERATOR/ADMIN) ===============================

  /** Assign an accepted, not-yet-delivered seller slice to a DELIVERY partner. */
  async assignSlice(actorId: string, sellerOrderId: string, dto: AssignSliceDto) {
    const so = await this.prisma.sellerOrder.findUnique({
      where: { id: sellerOrderId },
      include: { order: true, seller: true },
    });
    if (!so) throw new NotFoundException('Seller order not found');
    if (so.status !== SellerOrderStatus.ACCEPTED) {
      throw new ConflictException(`Only an ACCEPTED seller slice can be dispatched; slice is ${so.status}`);
    }
    if (so.deliveredAt) throw new ConflictException('This slice is already delivered');
    if (!COURIER_ORDER_STAGES.includes(so.order.status)) {
      throw new ConflictException(
        `Order must be SHIPPED or OUT_FOR_DELIVERY for courier assignment; it is ${so.order.status}`,
      );
    }
    const partner = await this.prisma.deliveryPartner.findUnique({ where: { id: dto.deliveryPartnerId } });
    if (!partner) throw new NotFoundException('Delivery partner not found');
    if (partner.status !== DeliveryPartnerStatus.ACTIVE) {
      throw new ConflictException('Delivery partner is not ACTIVE');
    }
    const active = await this.prisma.deliveryAssignment.findFirst({
      where: { sellerOrderId, status: { in: ACTIVE_ASSIGNMENT } },
    });
    if (active) throw new ConflictException('This slice already has an active courier assignment');

    const assignment = await this.prisma.$transaction(async (tx) => {
      const created = await tx.deliveryAssignment.create({
        data: {
          orderId: so.orderId,
          sellerOrderId: so.id,
          deliveryPartnerId: partner.id,
          assignmentNumber: `DLVA-${randomBytes(4).toString('hex').toUpperCase()}`,
          status: DeliveryAssignmentStatus.ASSIGNED,
        },
      });
      await this.audit(tx, created.id, 'ASSIGNED', 'CONTROL', actorId,
        `Assigned slice to ${partner.partnerCode}`);
      return created;
    });
    return this.assignmentPublic(await this.loadAssignment(assignment.id));
  }

  /** OPERATOR reassign a slice that a partner REJECTED / FAILED (creates a fresh assignment). */
  async reassignSlice(actorId: string, sellerOrderId: string, dto: AssignSliceDto) {
    return this.assignSlice(actorId, sellerOrderId, dto);
  }

  /** OPERATOR cancels an active assignment (slice returns to undelivered pool). */
  async cancelAssignment(actorId: string, assignmentId: string) {
    const a = await this.loadAssignment(assignmentId);
    if (!a) throw new NotFoundException('Assignment not found');
    if (!ACTIVE_ASSIGNMENT.includes(a.status)) {
      throw new ConflictException(`Only an active assignment can be cancelled (status ${a.status})`);
    }
    return this.prisma.$transaction(async (tx) => {
      await tx.deliveryAssignment.update({
        where: { id: a.id },
        data: { status: DeliveryAssignmentStatus.CANCELLED, cancelledAt: new Date() },
      });
      await this.audit(tx, a.id, 'CANCELLED', 'CONTROL', actorId, 'Operator cancelled assignment');
    });
  }

  async listAssignments(query: DeliveryListQuery) {
    const page = Math.max(1, Math.floor(query.page ?? 1));
    const limit = Math.min(100, Math.max(1, Math.floor(query.limit ?? 20)));
    const where: Prisma.DeliveryAssignmentWhereInput = {};
    if (query.status) where.status = query.status;
    if (query.deliveryPartnerId) where.deliveryPartnerId = query.deliveryPartnerId;
    if (query.orderId) where.orderId = query.orderId;
    if (query.sellerOrderId) where.sellerOrderId = query.sellerOrderId;
    const [rows, total] = await Promise.all([
      this.prisma.deliveryAssignment.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { sellerOrder: { select: { id: true, sellerOrderNumber: true, status: true, deliveredAt: true } } },
      }),
      this.prisma.deliveryAssignment.count({ where }),
    ]);
    return { assignments: rows.map((r) => this.assignmentPublic(r)), total, page, limit };
  }

  async getAssignment(assignmentId: string) {
    const a = await this.loadAssignment(assignmentId);
    if (!a) throw new NotFoundException('Assignment not found');
    const events = await this.prisma.deliveryEvent.findMany({
      where: { deliveryAssignmentId: a.id },
      orderBy: { createdAt: 'asc' },
    });
    return { ...this.assignmentPublic(a), events: events.map((e) => this.eventPublic(e)) };
  }

  // =============================== DELIVERY partner task surface ===============================

  /** Resolve the authenticated DELIVERY user's partner profile. */
  private async requirePartner(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.role !== 'DELIVERY') throw new ForbiddenException('Delivery-partner account required');
    const partner = await this.prisma.deliveryPartner.findUnique({ where: { userId } });
    if (!partner) throw new ForbiddenException('No delivery-partner profile bound to this account');
    if (partner.status !== DeliveryPartnerStatus.ACTIVE) {
      throw new ConflictException('Delivery partner is not ACTIVE');
    }
    return { user, partner };
  }

  private async ownedAssignment(userId: string, assignmentId: string) {
    const a = await this.loadAssignment(assignmentId);
    if (!a) throw new NotFoundException('Assignment not found');
    if (a.deliveryPartnerId !== (await this.requirePartner(userId)).partner.id) {
      throw new ForbiddenException('This assignment is not yours');
    }
    return a;
  }

  // Session 29: courier console needs order/customer/items context on the slice-task
  // surface (the replacement surface already carries customer + address). The list and
  // the new detail both render through `courierTaskPublic` so the console is not hollow.
  private async loadCourierTask(assignmentId: string) {
    return this.prisma.deliveryAssignment.findUnique({
      where: { id: assignmentId },
      include: {
        deliveryPartner: { include: { user: { select: { id: true, fullName: true, email: true } } } },
        order: {
          select: {
            id: true, orderNumber: true, paymentMethod: true, addressSnapshot: true,
            user: { select: { fullName: true, phone: true } },
          },
        },
        sellerOrder: {
          select: {
            id: true, sellerOrderNumber: true, status: true, shippedAt: true, deliveredAt: true,
            seller: { select: { displayName: true, sellerCode: true } },
            items: {
              select: {
                id: true, productNameSnapshot: true, weightSnapshot: true, quantity: true, skuSnapshot: true,
              },
            },
          },
        },
      },
    });
  }

  private courierTaskPublic(a: any) {
    const base = this.assignmentPublic(a);
    const order = a.order;
    const addr = (order?.addressSnapshot ?? null) as any;
    const items = (a.sellerOrder?.items ?? []).map((i: any) => ({
      id: i.id,
      productName: i.productNameSnapshot,
      weight: i.weightSnapshot ?? null,
      sku: i.skuSnapshot ?? null,
      quantity: i.quantity,
    }));
    return {
      ...base,
      orderNumber: order?.orderNumber ?? null,
      paymentMethod: order?.paymentMethod ?? null,
      sellerName: a.sellerOrder?.seller?.displayName ?? null,
      sellerCode: a.sellerOrder?.seller?.sellerCode ?? null,
      items,
      customer: addr
        ? {
            name: order?.user?.fullName ?? addr.name ?? addr.recipientName ?? null,
            phone: addr.phone ?? addr.mobile ?? null,
            address: addr,
          }
        : null,
    };
  }

  async partnerTasks(userId: string) {
    const { partner } = await this.requirePartner(userId);
    const rows = await this.prisma.deliveryAssignment.findMany({
      where: { deliveryPartnerId: partner.id, status: { in: PARTNER_ACTIVE } },
      orderBy: { createdAt: 'asc' },
      include: {
        sellerOrder: { select: { id: true, sellerOrderNumber: true, deliveredAt: true, items: { select: { quantity: true } } } },
        order: { select: { orderNumber: true, addressSnapshot: true, user: { select: { fullName: true, phone: true } } } },
      },
    });
    // Enrich each list row with order + customer context so the courier can scan what/where.
    return rows.map((r) => {
      const addr = (r.order?.addressSnapshot ?? null) as any;
      return {
        ...this.assignmentPublic(r),
        orderNumber: r.order?.orderNumber ?? null,
        itemCount: (r.sellerOrder?.items ?? []).reduce((s: number, i: any) => s + (i.quantity ?? 0), 0),
        customer: addr
          ? {
              name: r.order?.user?.fullName ?? addr.name ?? addr.recipientName ?? null,
              phone: addr.phone ?? addr.mobile ?? null,
              city: addr.city ?? null,
            }
          : null,
      };
    });
  }

  /** Courier views one of their own slice tasks (own, active) with full delivery context. */
  async partnerTask(userId: string, assignmentId: string) {
    const a = await this.loadCourierTask(assignmentId);
    if (!a) throw new NotFoundException('Assignment not found');
    if (a.deliveryPartnerId !== (await this.requirePartner(userId)).partner.id) {
      throw new ForbiddenException('This assignment is not yours');
    }
    if (!PARTNER_ACTIVE.includes(a.status)) {
      throw new ConflictException(`This assignment is not active (status ${a.status})`);
    }
    const events = await this.prisma.deliveryEvent.findMany({
      where: { deliveryAssignmentId: a.id },
      orderBy: { createdAt: 'asc' },
    });
    return { ...this.courierTaskPublic(a), events: events.map((e) => this.eventPublic(e)) };
  }

  async acceptTask(userId: string, assignmentId: string) {
    const a = await this.ownedAssignment(userId, assignmentId);
    if (a.status !== DeliveryAssignmentStatus.ASSIGNED) {
      throw new ConflictException(`Assignment must be ASSIGNED to accept (status ${a.status})`);
    }
    await this.setAssignment(userId, a.id, DeliveryAssignmentStatus.ACCEPTED, { acceptedAt: new Date() }, 'Accepted');
    return this.assignmentPublic((await this.loadAssignment(a.id))!);
  }

  async rejectTask(userId: string, assignmentId: string, dto: RejectAssignmentDto) {
    const a = await this.ownedAssignment(userId, assignmentId);
    if (a.status !== DeliveryAssignmentStatus.ASSIGNED) {
      throw new ConflictException(`Assignment must be ASSIGNED to reject (status ${a.status})`);
    }
    await this.setAssignment(userId, a.id, DeliveryAssignmentStatus.REJECTED,
      { rejectedAt: new Date(), failureReason: dto.reason }, `Rejected: ${dto.reason}`);
    return this.assignmentPublic((await this.loadAssignment(a.id))!);
  }

  async pickup(userId: string, assignmentId: string) {
    await this.partnerStep(userId, assignmentId, DeliveryAssignmentStatus.PICKED_UP, 'pickedUpAt', 'Pickup');
    // Session 30: hand the parcel to the courier provider (book a tracking waybill).
    await this.bookShipment(assignmentId, userId);
    return this.assignmentPublic((await this.loadAssignment(assignmentId))!);
  }

  /**
   * Session 30 — book a courier-provider shipment (waybill/tracking number) the
   * moment a partner picks the parcel up. Best-effort: a provider outage must
   * never fail the pickup — it is logged as a DeliveryEvent and the parcel is
   * still tracked locally. No-op when no provider is configured or a waybill
   * already exists.
   */
  private async bookShipment(assignmentId: string, actorId: string) {
    if (!this.courier) return;
    const a = await this.loadCourierTask(assignmentId);
    if (!a || a.trackingNumber) return;
    const addr = (a.order?.addressSnapshot ?? null) as any;
    try {
      const ship = await this.courier.createShipment({
        ref: a.assignmentNumber,
        kind: 'parcel',
        description: a.sellerOrder?.sellerOrderNumber ? `Slice ${a.sellerOrder.sellerOrderNumber}` : null,
        recipientName: a.order?.user?.fullName ?? addr?.name ?? null,
        phone: addr?.phone ?? null,
        line1: addr?.line1 ?? null,
        city: addr?.city ?? null,
        state: addr?.state ?? null,
        pincode: addr?.pincode ?? null,
      });
      await this.prisma.deliveryAssignment.update({
        where: { id: a.id },
        data: {
          carrier: ship.carrier,
          trackingNumber: ship.trackingNumber,
          trackingUrl: ship.trackingUrl ?? null,
        },
      });
      await this.audit(null, a.id, 'SHIPMENT_BOOKED', 'SYSTEM', actorId,
        `Courier ${ship.carrier} waybill ${ship.trackingNumber}`);
    } catch (e) {
      await this.audit(null, a.id, 'SHIPMENT_BOOK_FAILED', 'SYSTEM', actorId,
        `Courier booking failed: ${(e as Error).message}`);
    }
  }

  async outForDelivery(userId: string, assignmentId: string) {
    return this.partnerStep(userId, assignmentId, DeliveryAssignmentStatus.OUT_FOR_DELIVERY, 'outForDeliveryAt', 'Out for delivery');
  }

  private async partnerStep(
    userId: string,
    assignmentId: string,
    to: DeliveryAssignmentStatus,
    field: 'pickedUpAt' | 'outForDeliveryAt',
    label: string,
  ) {
    const a = await this.ownedAssignment(userId, assignmentId);
    const expected = to === DeliveryAssignmentStatus.PICKED_UP
      ? DeliveryAssignmentStatus.ACCEPTED
      : DeliveryAssignmentStatus.PICKED_UP;
    if (a.status !== expected) {
      throw new ConflictException(`Cannot ${label.toLowerCase()}: assignment is ${a.status}`);
    }
    await this.setAssignment(userId, a.id, to, { [field]: new Date() } as Prisma.DeliveryAssignmentUpdateInput, label);
    return this.assignmentPublic((await this.loadAssignment(a.id))!);
  }

  /** Deliver a slice; if it was the last outstanding slice, finalize the order to DELIVERED. */
  async deliver(userId: string, assignmentId: string) {
    const a = await this.ownedAssignment(userId, assignmentId);
    if (a.status !== DeliveryAssignmentStatus.OUT_FOR_DELIVERY) {
      throw new ConflictException(`Slice must be OUT_FOR_DELIVERY to deliver (status ${a.status})`);
    }
    const { order } = await this.prisma.sellerOrder.findUniqueOrThrow({
      where: { id: a.sellerOrderId },
      include: { order: true },
    });
    if (!COURIER_ORDER_STAGES.includes(order.status)) {
      throw new ConflictException(`Order is not in a courier-delivery stage (${order.status})`);
    }

    // Session 30: capture proof-of-delivery (POD) from the courier provider. This
    // external call stays OUTSIDE the DB transaction so a provider hiccup can never
    // roll back the local finalization. Best-effort when a provider/waybill exists.
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
        /* best-effort POD — delivery still finalises locally */
      }
    }

    await this.prisma.$transaction(async (tx) => {
      // Mark the slice delivered.
      await tx.sellerOrder.update({
        where: { id: a.sellerOrderId },
        data: { deliveredAt: new Date() },
      });
      await tx.deliveryAssignment.update({
        where: { id: a.id },
        data: { status: DeliveryAssignmentStatus.DELIVERED, deliveredAt: new Date(), ...pod },
      });
      await this.audit(tx, a.id, 'DELIVERED', 'DELIVERY', userId, 'Slice delivered');

      // Session 32 (money leg): accrue the platform's per-slice delivery fee owed to
      // this courier, atomically with the delivery (only for the actually-delivered leg).
      await this.courierPayout?.earnCourierDelivery(tx, {
        deliveryPartnerId: a.deliveryPartnerId,
        kind: 'parcel',
        orderId: order.id,
        sellerOrderId: a.sellerOrderId,
        deliveryAssignmentId: a.id,
      });

      // Finalize the order once every non-cancelled slice is delivered.
      const outstanding = await tx.sellerOrder.findMany({
        where: { orderId: order.id, status: { not: SellerOrderStatus.CANCELLED }, deliveredAt: null },
      });
      if (outstanding.length === 0) {
        const updated = await tx.order.updateMany({
          where: { id: order.id, status: { in: COURIER_ORDER_STAGES } },
          data: {
            status: OrderStatus.DELIVERED,
            deliveredAt: new Date(),
            ...(order.paymentMethod === PaymentMethod.COD
              ? { paymentStatus: PaymentStatus.COD_PAID }
              : {}),
          },
        });
        if (updated.count > 0) {
          await tx.orderStatusHistory.create({
            data: {
              orderId: order.id,
              fromStatus: order.status,
              toStatus: OrderStatus.DELIVERED,
              actor: OrderActor.CONTROL,
              actorId: userId,
              reason: 'Delivered by courier (last slice)',
              metadata: { transition: 'courier-delivery', assignmentId: a.id },
            },
          });
          // Session 12/13 unchanged: accepted slices earn their payables at order DELIVERED.
          await this.settlement.earnDeliveredSlices(tx, order.id);
        }
      }
    });
    return this.assignmentPublic((await this.loadAssignment(a.id))!);
  }

  async fail(userId: string, assignmentId: string, dto: FailAssignmentDto) {
    const a = await this.ownedAssignment(userId, assignmentId);
    if (!PARTNER_ACTIVE.includes(a.status)) {
      throw new ConflictException(`Cannot fail an assignment in status ${a.status}`);
    }
    await this.setAssignment(userId, a.id, DeliveryAssignmentStatus.FAILED,
      { failureReason: dto.reason }, `Failed: ${dto.reason}`);
    return this.assignmentPublic((await this.loadAssignment(a.id))!);
  }

  // =============================== helpers ===============================

  private async setAssignment(
    actorId: string,
    id: string,
    status: DeliveryAssignmentStatus,
    extra: Prisma.DeliveryAssignmentUpdateInput,
    note: string,
  ) {
    await this.prisma.deliveryAssignment.update({ where: { id }, data: { status, ...extra } });
    await this.audit(null, id, status, 'DELIVERY', actorId, note);
  }

  private async loadAssignment(id: string) {
    return this.prisma.deliveryAssignment.findUnique({
      where: { id },
      include: {
        deliveryPartner: { include: { user: { select: { id: true, fullName: true, email: true } } } },
        sellerOrder: { select: { id: true, sellerOrderNumber: true, sellerId: true, status: true, shippedAt: true, deliveredAt: true } },
      },
    });
  }

  /** Log an audit row on the assignment (inside a tx if given, else standalone). */
  private async audit(
    tx: Tx | null,
    deliveryAssignmentId: string | null,
    eventType: string,
    actorType: string,
    actorId: string | null,
    note: string | null,
  ) {
    if (!deliveryAssignmentId) return;
    const data = { deliveryAssignmentId, eventType, actorType, actorId, note };
    if (tx) await tx.deliveryEvent.create({ data });
    else await this.prisma.deliveryEvent.create({ data });
  }

  private partnerPublic(p: any) {
    return {
      id: p.id,
      userId: p.userId,
      partnerCode: p.partnerCode,
      status: p.status,
      vehicleType: p.vehicleType,
      user: p.user ? { id: p.user.id, email: p.user.email, fullName: p.user.fullName, role: p.user.role } : undefined,
    };
  }

  private assignmentPublic(a: any) {
    return {
      id: a.id,
      assignmentNumber: a.assignmentNumber,
      orderId: a.orderId,
      status: a.status,
      sellerOrderId: a.sellerOrderId,
      sellerOrder: a.sellerOrder
        ? {
            sellerOrderNumber: a.sellerOrder.sellerOrderNumber,
            status: a.sellerOrder.status,
            shippedAt: a.sellerOrder.shippedAt?.toISOString?.() ?? null,
            deliveredAt: a.sellerOrder.deliveredAt?.toISOString?.() ?? null,
          }
        : undefined,
      deliveryPartner: a.deliveryPartner
        ? {
            id: a.deliveryPartner.id,
            partnerCode: a.deliveryPartner.partnerCode,
            name: a.deliveryPartner.user?.fullName ?? a.deliveryPartner.partnerCode,
          }
        : null,
      assignedAt: a.assignedAt?.toISOString?.() ?? null,
      acceptedAt: a.acceptedAt?.toISOString?.() ?? null,
      pickedUpAt: a.pickedUpAt?.toISOString?.() ?? null,
      outForDeliveryAt: a.outForDeliveryAt?.toISOString?.() ?? null,
      deliveredAt: a.deliveredAt?.toISOString?.() ?? null,
      rejectedAt: a.rejectedAt?.toISOString?.() ?? null,
      failureReason: a.failureReason,
      cancelledAt: a.cancelledAt?.toISOString?.() ?? null,
      // Session 30 — external courier tracking + POD.
      carrier: a.carrier ?? null,
      trackingNumber: a.trackingNumber ?? null,
      trackingUrl: a.trackingUrl ?? null,
      podRef: a.podRef ?? null,
      podSignedBy: a.podSignedBy ?? null,
      podAt: a.podAt?.toISOString?.() ?? null,
    };
  }

  private eventPublic(e: any) {
    return { eventType: e.eventType, actorType: e.actorType, actorId: e.actorId, note: e.note, createdAt: e.createdAt.toISOString() };
  }
}
