import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  OrderActor,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  Prisma,
} from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { OrderPublic } from './commerce.types';
import { OrderService } from './order.service';

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
    return this.orders.toPublicOrder(updated);
  }
}
