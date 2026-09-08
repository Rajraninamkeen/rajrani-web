import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import {
  NotificationCategory,
  OrderActor,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  Prisma,
  SellerOrderStatus,
} from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { OrderPublic } from './commerce.types';
import { NotificationService } from './notification.service';
import { OrderService } from './order.service';
import { SettlementService } from './settlement.service';

// Stages at which goods physically leave the warehouse / reach the customer.
// From here every fulfil-required seller slice must have been ACCEPTED, because
// the current delivery model ships the accepted slices of an order together.
const SHIPMENT_STAGES: OrderStatus[] = [
  OrderStatus.SHIPPED,
  OrderStatus.OUT_FOR_DELIVERY,
  OrderStatus.DELIVERED,
];

// Legal forward transitions for the fulfilment/delivery lifecycle (Master-Spec §39,
// mapped onto this repo's leaner OrderStatus set).
const NEXT: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.PLACED]: [OrderStatus.CONFIRMED],
  [OrderStatus.CONFIRMED]: [OrderStatus.PACKED],
  [OrderStatus.PACKED]: [OrderStatus.SHIPPED],
  [OrderStatus.SHIPPED]: [OrderStatus.OUT_FOR_DELIVERY, OrderStatus.DELIVERED],
  [OrderStatus.OUT_FOR_DELIVERY]: [OrderStatus.DELIVERED],
  [OrderStatus.DELIVERED]: [],
  [OrderStatus.CANCELLED]: [],
  [OrderStatus.RETURN_REQUESTED]: [],
  [OrderStatus.RETURNED]: [],
  [OrderStatus.REFUND_PENDING]: [],
  [OrderStatus.REFUNDED]: [],
};

@Injectable()
export class FulfilmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orders: OrderService,
    private readonly settlement: SettlementService,
    // Session 40/41 — optional buyer notice feed (never affects the fulfilment tx).
    @Optional() private readonly notifications?: NotificationService,
  ) {}

  /**
   * Advance an order by one legal fulfilment transition.
   * `actorUserId` is the authenticated operator performing the action.
   */
  async advance(
    actorUserId: string,
    orderId: string,
    to: OrderStatus,
    reason?: string,
  ): Promise<OrderPublic> {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order not found');

    const allowed = NEXT[order.status];
    if (!allowed || !allowed.includes(to)) {
      throw new ConflictException(`Cannot transition order from "${order.status}" to "${to}"`);
    }

    // Confirmation gate: an order may only be confirmed once it is actually paid
    // (PREPAID capture) or its COD OTP verification has passed.
    if (to === OrderStatus.CONFIRMED) {
      if (order.paymentMethod === PaymentMethod.PREPAID && order.paymentStatus !== PaymentStatus.PAID) {
        throw new BadRequestException('Order cannot be confirmed before payment is captured');
      }
      if (order.paymentMethod === PaymentMethod.COD) {
        const cod = await this.prisma.codVerification.findUnique({ where: { orderId } });
        if (!cod || cod.status !== 'CONFIRMED') {
          throw new BadRequestException('Complete COD OTP verification before confirming the order');
        }
      }
    }

    // Per-seller acceptance gate (Session 10): before shipping/delivering, every
    // non-cancelled seller slice must be ACCEPTED. If a seller is still PLACED
    // (hasn't accepted) or REJECTED (declined), the shared shipment can't go out.
    let fulfilRequiredSellers: { id: string }[] = [];
    if (SHIPMENT_STAGES.includes(to)) {
      const slices = await this.prisma.sellerOrder.findMany({
        where: { orderId },
        include: { seller: true },
      });
      const toFulfil = slices.filter((so) => so.status !== SellerOrderStatus.CANCELLED);
      const blockers = toFulfil.filter((so) => so.status !== SellerOrderStatus.ACCEPTED);
      if (blockers.length > 0) {
        const detail = blockers
          .map((so) => `${so.seller.displayName} (${so.status})`)
          .join(', ');
        throw new BadRequestException(
          `Every seller must accept their slice before shipping. Not ready: ${detail}`,
        );
      }
      fulfilRequiredSellers = toFulfil.map((so) => ({ id: so.id }));
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const data: Prisma.OrderUpdateManyMutationInput = { status: to };
      if (to === OrderStatus.DELIVERED) {
        data.deliveredAt = new Date();
        // COD is collected at the door: flip COD_PENDING -> COD_PAID on delivery.
        if (order.paymentMethod === PaymentMethod.COD) {
          data.paymentStatus = PaymentStatus.COD_PAID;
        }
      }

      // Guarded update so only a valid forward move wins (concurrency-safe).
      const res = await tx.order.updateMany({ where: { id: orderId, status: order.status }, data });
      if (res.count === 0) throw new ConflictException('Order state changed; please retry');

      // Stamp each accepted seller slice with the shipment/delivery point-in-time.
      if (to === OrderStatus.SHIPPED && fulfilRequiredSellers.length) {
        await tx.sellerOrder.updateMany({
          where: { orderId, status: SellerOrderStatus.ACCEPTED },
          data: { shippedAt: new Date() },
        });
      } else if (to === OrderStatus.DELIVERED && fulfilRequiredSellers.length) {
        await tx.sellerOrder.updateMany({
          where: { orderId, status: SellerOrderStatus.ACCEPTED },
          data: { deliveredAt: new Date() },
        });
        // Session 12: the accepted slices are now delivered, so each one earns its
        // seller payable (cancelled/REJECTED slices earn nothing). Atomic with the
        // DELIVERED transition because we are inside the same transaction.
        await this.settlement.earnDeliveredSlices(tx, orderId);
      }

      await tx.orderStatusHistory.create({
        data: {
          orderId,
          fromStatus: order.status,
          toStatus: to,
          actor: OrderActor.CONTROL,
          actorId: actorUserId,
          reason: reason ?? `Fulfilment: ${order.status} → ${to}`,
          metadata: { transition: 'fulfilment' },
        },
      });

      return tx.order.findUniqueOrThrow({
        where: { id: orderId },
        include: { items: true },
      });
    });
    // Session 40/41 — best-effort buyer notice when their order is delivered.
    if (to === OrderStatus.DELIVERED && this.notifications) {
      try {
        await this.notifications.enqueue({
          recipientUserId: order.userId,
          category: NotificationCategory.ORDER_STATUS,
          title: 'Order delivered',
          message: `Your order ${order.orderNumber ?? ''} has been delivered${order.paymentMethod === PaymentMethod.COD ? ' — collect the payment from your delivery partner' : ''}.`,
          refKind: 'order',
          refId: orderId,
        });
      } catch { /* best-effort */ }
    }
    return this.orders.toPublicOrder(updated);
  }
}
