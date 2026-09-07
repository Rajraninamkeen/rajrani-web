import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Cart,
  CartStatus,
  Coupon,
  CouponStatus,
  CouponType,
  Order,
  OrderActor,
  OrderItem,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  Prisma,
} from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  OrderItemPublic,
  OrderListQuery,
  OrderListResult,
  OrderPublic,
  PriceBreakdown,
} from './commerce.types';
import { CheckoutDto } from './dto/checkout.dto';

const TAX_RATE = 0.05; // 5% GST on namkeen (India)
const DELIVERY_FLAT = 49;
const FREE_DELIVERY_ABOVE = 499;

export interface QuoteResult {
  items: OrderItemPublic[];
  price: PriceBreakdown;
}

@Injectable()
export class OrderService {
  constructor(private readonly prisma: PrismaService) {}

  /** Server-authoritative preview/quote for the current cart. */
  async preview(userId: string, cartId: string, couponCode?: string): Promise<QuoteResult> {
    const cart = await this.ownActiveCart(userId, cartId);
    const quote = await this.calcQuote(this.prisma as unknown as Prisma.TransactionClient, cart);
    const coupon = couponCode ? await this.validateCoupon(couponCode, quote.price.subtotal) : undefined;
    if (coupon) this.applyCouponToQuote(coupon, quote);
    return quote;
  }

  /** Place an order transactionally: price, coupon, reserve stock, snapshot, history. */
  async checkout(userId: string, dto: CheckoutDto): Promise<OrderPublic> {
    // Verify ownership + active status up front (distinct from "not found").
    const cart = await this.assertClaimableCart(userId, dto.cartId);

    return this.prisma.$transaction(async (tx) => {
      // Atomically claim the cart (ACTIVE -> CONVERTED). If another concurrent
      // checkout already claimed it, this one aborts. The whole transaction rolls
      // back on any later failure, so a failed checkout leaves the cart ACTIVE.
      const claimed = await tx.cart.updateMany({
        where: { id: cart.id, userId, status: 'ACTIVE' },
        data: { status: 'CONVERTED' },
      });
      if (claimed.count === 0) {
        throw new ConflictException('This cart has already been checked out');
      }

      const quote = await this.calcQuote(tx, cart);

      let coupon: Coupon | undefined;
      if (dto.couponCode) {
        coupon = await this.validateCoupon(dto.couponCode, quote.price.subtotal);
        if (coupon) {
          this.applyCouponToQuote(coupon, quote);
          await tx.coupon.update({
            where: { id: coupon.id },
            data: { usageCount: { increment: 1 } },
          });
        }
      }

      // Reserve stock (atomic decrement guarded by available stock).
      for (const item of quote.items) {
        const res = await tx.product.updateMany({
          where: { id: item.productId, stockOnHand: { gte: item.quantity } },
          data: { stockOnHand: { decrement: item.quantity } },
        });
        if (res.count === 0) {
          throw new BadRequestException(`Insufficient stock for "${item.productName}"`);
        }
      }

      const orderNumber = await this.generateOrderNumber(tx);
      const order = await tx.order.create({
        data: {
          orderNumber,
          userId,
          status: OrderStatus.PLACED,
          subtotal: quote.price.subtotal,
          discountTotal: quote.price.discount,
          taxTotal: quote.price.tax,
          deliveryTotal: quote.price.deliveryCharge,
          grandTotal: quote.price.grandTotal,
          couponCode: quote.price.couponCode,
          couponDiscount: quote.price.couponDiscount,
          paymentMethod: dto.paymentMethod,
          paymentStatus:
            dto.paymentMethod === PaymentMethod.COD ? PaymentStatus.COD_PENDING : PaymentStatus.PENDING,
          addressSnapshot: dto.address as unknown as Prisma.InputJsonValue,
          items: {
            create: quote.items.map((it) => ({
              productId: it.productId,
              productNameSnapshot: it.productName,
              skuSnapshot: it.sku,
              weightSnapshot: it.weight,
              unitPrice: it.unitPrice,
              quantity: it.quantity,
              lineTotal: it.lineTotal,
            })),
          },
          history: {
            create: {
              fromStatus: null,
              toStatus: OrderStatus.PLACED,
              actor: OrderActor.CUSTOMER,
              actorId: userId,
              metadata: { paymentMethod: dto.paymentMethod },
            },
          },
        },
        include: { items: true },
      });

      return this.toPublic(order);
    });
  }

  async listUserOrders(userId: string, query: OrderListQuery = {}): Promise<OrderListResult> {
    const page = Math.max(1, Math.floor(query.page ?? 1));
    const limit = Math.min(100, Math.max(1, Math.floor(query.limit ?? 20)));

    const where: Prisma.OrderWhereInput = { userId };
    if (query.status) {
      const valid = Object.values(OrderStatus) as string[];
      if (!valid.includes(query.status)) {
        throw new BadRequestException(`Invalid order status "${query.status}"`);
      }
      where.status = query.status;
    }

    const [rows, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        include: { items: true },
        orderBy: { placedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.order.count({ where }),
    ]);

    return {
      orders: rows.map((o) => this.toPublic(o)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getOrder(userId: string, id: string): Promise<OrderPublic> {
    const order = await this.prisma.order.findFirst({ where: { id, userId }, include: { items: true } });
    if (!order) throw new NotFoundException('Order not found');
    return this.toPublic(order);
  }

  async cancelOrder(userId: string, id: string, reason?: string): Promise<OrderPublic> {
    const order = await this.prisma.order.findFirst({ where: { id, userId } });
    if (!order) throw new NotFoundException('Order not found');
    if (order.status !== OrderStatus.PLACED && order.status !== OrderStatus.CONFIRMED) {
      throw new BadRequestException(`Order in "${order.status}" cannot be cancelled`);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      // Guarded transition: only one cancellation can win, so a concurrent
      // cancel cannot restore stock twice.
      const cancelled = await tx.order.updateMany({
        where: { id, userId, status: { in: [OrderStatus.PLACED, OrderStatus.CONFIRMED] } },
        data: { status: OrderStatus.CANCELLED, cancelledAt: new Date() },
      });
      if (cancelled.count === 0) {
        throw new ConflictException('Order is no longer cancellable');
      }

      const items = await tx.orderItem.findMany({ where: { orderId: id } });
      for (const it of items) {
        await tx.product.update({
          where: { id: it.productId },
          data: { stockOnHand: { increment: it.quantity } },
        });
      }
      await tx.orderStatusHistory.create({
        data: {
          orderId: id,
          fromStatus: order.status,
          toStatus: OrderStatus.CANCELLED,
          actor: OrderActor.CUSTOMER,
          actorId: userId,
          reason: reason ?? 'Cancelled by customer',
        },
      });
      const up = await tx.order.findUniqueOrThrow({ where: { id }, include: { items: true } });
      return up;
    });
    return this.toPublic(updated);
  }

  // ---------- helpers ----------

  private async ownActiveCart(userId: string, cartId: string): Promise<Cart> {
    const cart = await this.prisma.cart.findFirst({
      where: { id: cartId, userId, status: 'ACTIVE' },
    });
    if (!cart) throw new NotFoundException('Cart not found');
    return cart;
  }

  /** Ownership + active check for checkout, distinguishing missing vs stale cart. */
  private async assertClaimableCart(userId: string, cartId: string): Promise<Cart> {
    const cart = await this.prisma.cart.findFirst({ where: { id: cartId, userId } });
    if (!cart) throw new NotFoundException('Cart not found');
    if (cart.status !== CartStatus.ACTIVE) {
      throw new ConflictException('This cart is not active or has already been checked out');
    }
    return cart;
  }

  private async calcQuote(
    db: Prisma.TransactionClient,
    cart: Cart,
  ): Promise<QuoteResult> {
    const rows = await db.cartItem.findMany({
      where: { cartId: cart.id },
      include: { product: true },
    });
    const items: OrderItemPublic[] = [];
    let subtotal = 0;
    for (const r of rows) {
      const p = r.product;
      if (p.status !== 'APPROVED' || p.visibility !== 'LIVE' || p.deletedAt) {
        throw new BadRequestException(`"${p.name}" is no longer available. Please review your cart.`);
      }
      if (p.stockOnHand < r.quantity) {
        throw new BadRequestException(`Only ${p.stockOnHand} units of "${p.name}" are available.`);
      }
      const unit = p.basePrice.toNumber();
      const line = unit * r.quantity;
      subtotal += line;
      items.push({
        productId: p.id,
        productName: p.name,
        sku: p.slug,
        weight: p.weightLabel,
        unitPrice: unit,
        quantity: r.quantity,
        lineTotal: line,
      });
    }
    if (items.length === 0) {
      throw new BadRequestException('Your cart is empty');
    }
    const deliveryCharge = subtotal >= FREE_DELIVERY_ABOVE ? 0 : DELIVERY_FLAT;
    const tax = this.round2(subtotal * TAX_RATE);
    return {
      items,
      price: {
        subtotal,
        discount: 0,
        deliveryCharge,
        tax,
        couponDiscount: 0,
        couponCode: null,
        grandTotal: this.round2(subtotal + tax + deliveryCharge),
      },
    };
  }

  /** Fold an applied coupon into the quote: set discount/code and recompute the payable grand total. */
  private applyCouponToQuote(coupon: Coupon, quote: QuoteResult): void {
    const discount = this.applyCoupon(coupon, quote.price.subtotal);
    quote.price.couponDiscount = discount;
    quote.price.couponCode = coupon.code;
    quote.price.grandTotal = this.round2(
      quote.price.subtotal + quote.price.tax + quote.price.deliveryCharge - discount,
    );
  }

  private async validateCoupon(code: string, subtotal: number): Promise<Coupon | undefined> {
    const coupon = await this.prisma.coupon.findUnique({ where: { code } });
    if (!coupon || coupon.status !== CouponStatus.ACTIVE) {
      throw new BadRequestException('Coupon is invalid or inactive');
    }
    if (coupon.validTo && coupon.validTo < new Date()) {
      throw new BadRequestException('Coupon has expired');
    }
    if (coupon.validFrom && coupon.validFrom > new Date()) {
      throw new BadRequestException('Coupon is not yet active');
    }
    if (coupon.minOrderValue && subtotal < coupon.minOrderValue.toNumber()) {
      throw new BadRequestException(`This coupon needs a minimum order of ₹${coupon.minOrderValue.toNumber()}`);
    }
    if (coupon.usageLimit && coupon.usageCount >= coupon.usageLimit) {
      throw new BadRequestException('This coupon has reached its usage limit');
    }
    return coupon;
  }

  private applyCoupon(coupon: Coupon, subtotal: number): number {
    let discount = 0;
    if (coupon.type === CouponType.PERCENTAGE) {
      discount = (subtotal * coupon.value.toNumber()) / 100;
      if (coupon.maxDiscount) discount = Math.min(discount, coupon.maxDiscount.toNumber());
    } else if (coupon.type === CouponType.FIXED_AMOUNT) {
      discount = coupon.value.toNumber();
    }
    return Math.min(this.round2(discount), subtotal);
  }

  private async generateOrderNumber(tx: Prisma.TransactionClient): Promise<string> {
    return `BK-${Date.now().toString(36).toUpperCase()}`;
  }

  private round2(n: number): number {
    return Math.round(n * 100) / 100;
  }

  private toPublic(order: Order & { items?: OrderItem[] }): OrderPublic {
    const o = order as Order & { items: OrderItem[] };
    const price: PriceBreakdown = {
      subtotal: o.subtotal.toNumber(),
      discount: o.discountTotal.toNumber(),
      deliveryCharge: o.deliveryTotal.toNumber(),
      tax: o.taxTotal.toNumber(),
      couponDiscount: o.couponDiscount.toNumber(),
      couponCode: o.couponCode,
      grandTotal: o.grandTotal.toNumber(),
    };
    return {
      id: o.id,
      orderNumber: o.orderNumber,
      status: o.status,
      paymentMethod: o.paymentMethod,
      paymentStatus: o.paymentStatus,
      placedAt: o.placedAt.toISOString(),
      items: o.items.map((i) => ({
        productId: i.productId,
        productName: i.productNameSnapshot,
        sku: i.skuSnapshot,
        weight: i.weightSnapshot,
        unitPrice: i.unitPrice.toNumber(),
        quantity: i.quantity,
        lineTotal: i.lineTotal.toNumber(),
      })),
      price,
    };
  }
}
