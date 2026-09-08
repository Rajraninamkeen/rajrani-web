import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { DeliveryAssignmentStatus, Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { COURIER_PROVIDER, type CourierProvider } from './courier/courier-provider.interface';

/**
 * Session 31 — customer/operator-facing courier **tracking-read** surface.
 *
 * The courier leg (slice parcel on a DeliveryAssignment, or an outbound
 * replacement dispatch on a ReplacementAssignment) stores a provider waybill
 * (`trackingNumber`) the moment the parcel is picked up (Session 30). This
 * service turns an order into a list of courier legs and calls the configured
 * CourierProvider's `track(trackingNumber)` LIVE for each one that has a waybill,
 * so the caller sees the current courier-company status (CREATED / IN_TRANSIT /
 * OUT_FOR_DELIVERY / DELIVERED / FAILED) and its event timeline merged with the
 * locally-persisted leg state + POD.
 *
 * Read-only & NON-money: this never books a shipment, never confirms delivery and
 * never touches a Refund / seller payable / ledger. Provider calls are best-effort
 * (a provider outage yields a leg with `provider: null` and the local state intact).
 *
 * Entitlement: the order OWNER (CUSTOMER) may read their own order's tracking;
 * OPERATOR/ADMIN may read any order. Callers of any other role are forbidden.
 */
/** One courier "leg" of an order — a slice parcel OR an outbound replacement dispatch. */
export interface CourierTrackingEventPublic {
  status: string;
  at: string;
  note: string | null;
}
export interface CourierTrackingLeg {
  legType: 'parcel' | 'replacement';
  title: string;
  reference: string | null; // sellerOrderNumber (parcel) / replacementReference (replacement)
  assignmentId: string;
  assignmentNumber: string;
  status: string; // local DeliveryAssignmentStatus
  carrier: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  assignedAt: string | null;
  acceptedAt: string | null;
  pickedUpAt: string | null;
  outForDeliveryAt: string | null;
  deliveredAt: string | null;
  failureReason: string | null;
  podRef: string | null;
  podSignedBy: string | null;
  podAt: string | null;
  /** Live courier-provider status (best-effort). Null when no provider/waybill/unreachable. */
  provider: { carrier: string | null; status: string; events: CourierTrackingEventPublic[] } | null;
}
export interface OrderCourierTracking {
  orderId: string;
  orderNumber: string;
  legs: CourierTrackingLeg[];
}

const TRACK_ROLES = new Set(['CUSTOMER', 'OPERATOR', 'ADMIN']);
// Statuses that no longer represent a live courier movement for this order.
const FILTERED = new Set<DeliveryAssignmentStatus>([
  DeliveryAssignmentStatus.REJECTED,
  DeliveryAssignmentStatus.FAILED,
  DeliveryAssignmentStatus.CANCELLED,
]);

@Injectable()
export class CourierTrackingService {
  constructor(
    private readonly prisma: PrismaService,
    // Optional so historical unit tests keep their `new CourierTrackingService(prisma)` shape.
    @Optional() @Inject(COURIER_PROVIDER) private readonly courier?: CourierProvider | null,
  ) {}

  /**
   * Live courier tracking for an order, aggregated across its courier legs:
   * one leg per seller slice (latest DeliveryAssignment) + one leg per issued
   * replacement (latest ReplacementAssignment), each merged with the provider's
   * current `track` result when a waybill exists.
   */
  async trackOrder(actorUserId: string, orderId: string): Promise<OrderCourierTracking> {
    const user = await this.prisma.user.findUnique({ where: { id: actorUserId } });
    if (!user || !TRACK_ROLES.has(user.role)) {
      throw new ForbiddenException('You do not have permission to view courier tracking');
    }
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, orderNumber: true, userId: true, status: true },
    });
    if (!order) throw new NotFoundException('Order not found');
    // Customers are scoped to their own order (404 so no cross-customer leak).
    if (user.role === 'CUSTOMER' && order.userId !== actorUserId) {
      throw new NotFoundException('Order not found');
    }

    const [sliceRows, replacementRows] = await Promise.all([
      this.prisma.deliveryAssignment.findMany({
        where: { orderId: order.id },
        orderBy: { createdAt: 'desc' },
        include: {
          sellerOrder: { select: { id: true, sellerOrderNumber: true, seller: { select: { displayName: true } } } },
        },
      }),
      this.prisma.replacementAssignment.findMany({
        where: { orderId: order.id },
        orderBy: { createdAt: 'desc' },
        include: { replacement: { select: { id: true, replacementReference: true } } },
      }),
    ]);

    const legs: CourierTrackingLeg[] = [];
    const seenSlice = new Set<string>();
    for (const a of sliceRows) {
      if (!a.sellerOrder || seenSlice.has(a.sellerOrder.id)) continue; // latest assignment per slice
      seenSlice.add(a.sellerOrder.id);
      if (FILTERED.has(a.status)) continue;
      legs.push(await this.toSliceLeg(a));
    }
    const seenReplacement = new Set<string>();
    for (const a of replacementRows) {
      if (!a.replacement || seenReplacement.has(a.replacement.id)) continue;
      seenReplacement.add(a.replacement.id);
      if (FILTERED.has(a.status)) continue;
      legs.push(await this.toReplacementLeg(a));
    }

    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      legs,
    };
  }

  // ---- slice (parcel) legs ----

  private async toSliceLeg(a: any): Promise<CourierTrackingLeg> {
    const provider = await this.liveTrack(a.trackingNumber, a.carrier);
    return {
      legType: 'parcel' as const,
      title: `Delivery · ${a.sellerOrder?.seller?.displayName ?? 'Seller'}`,
      reference: a.sellerOrder?.sellerOrderNumber ?? null,
      assignmentId: a.id,
      assignmentNumber: a.assignmentNumber,
      status: a.status,
      carrier: a.carrier ?? null,
      trackingNumber: a.trackingNumber ?? null,
      trackingUrl: a.trackingUrl ?? null,
      assignedAt: iso(a.assignedAt),
      acceptedAt: iso(a.acceptedAt),
      pickedUpAt: iso(a.pickedUpAt),
      outForDeliveryAt: iso(a.outForDeliveryAt),
      deliveredAt: iso(a.deliveredAt),
      failureReason: a.failureReason ?? null,
      podRef: a.podRef ?? null,
      podSignedBy: a.podSignedBy ?? null,
      podAt: iso(a.podAt),
      provider,
    };
  }

  private async toReplacementLeg(a: any): Promise<CourierTrackingLeg> {
    const provider = await this.liveTrack(a.trackingNumber, a.carrier);
    return {
      legType: 'replacement' as const,
      title: 'Replacement delivery',
      reference: a.replacement?.replacementReference ?? null,
      assignmentId: a.id,
      assignmentNumber: a.assignmentNumber,
      status: a.status,
      carrier: a.carrier ?? null,
      trackingNumber: a.trackingNumber ?? null,
      trackingUrl: a.trackingUrl ?? null,
      assignedAt: iso(a.assignedAt),
      acceptedAt: iso(a.acceptedAt),
      pickedUpAt: iso(a.pickedUpAt),
      outForDeliveryAt: iso(a.outForDeliveryAt),
      deliveredAt: iso(a.deliveredAt),
      failureReason: a.failureReason ?? null,
      podRef: a.podRef ?? null,
      podSignedBy: a.podSignedBy ?? null,
      podAt: iso(a.podAt),
      provider,
    };
  }

  /**
   * Best-effort LIVE provider lookup for a waybill. Returns null when there is
   * no provider configured, no waybill yet (not picked up), or the provider is
   * temporarily unreachable — the caller then relies on local leg state.
   */
  private async liveTrack(trackingNumber: string | null, carrier: string | null) {
    if (!this.courier || !trackingNumber) return null;
    try {
      const t = await this.courier.track(trackingNumber);
      return {
        carrier: t.carrier ?? carrier,
        status: t.status,
        trackingUrl: null,
        events: (t.events ?? []).map((e) => ({
          status: e.status,
          at: e.at,
          note: e.note ?? null,
        })),
      };
    } catch {
      return null;
    }
  }
}

function iso(d: Date | null | undefined): string | null {
  return d instanceof Date ? d.toISOString() : null;
}
