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
  Product,
} from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  OrderItemPublic,
  OrderListQuery,
  OrderListResult,
  OrderPaymentResult,
  OrderPublic,
  PriceBreakdown,
} from './commerce.types';
import { CheckoutDto } from './dto/checkout.dto';
import { BuyNowDto } from './dto/payment.dto';
import { PaymentService } from './payment.service';

const TAX_RATE = 0.05; // 5% GST on namkeen (India)
const DELIVERY_FLAT = 49;
const FREE_DELIVERY_ABOVE = 499;

// Only APPROVED + LIVE products may be purchased (Master-Spec §28).
const purchasableWhere: Prisma.ProductWhereInput = {
  status: 'APPROVED',
  visibility: 'LIVE',
  deletedAt: null,
};

export interface QuoteResult {
  items: OrderItemPublic[];
  price: PriceBreakdown;
}

@Injectable()
export class OrderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly payments: PaymentService,
  ) {}

  /** Server-authoritative preview/quote for the current cart. */
  async preview(userId: string, cartId: string, couponCode?: string): Promise<QuoteResult> {
    const cart = await this.ownActiveCart(userId, cartId);
    const quote = await this.calcQuote(this.prisma as unknown as Prisma.TransactionClient, cart);
    const coupon = couponCode ? await this.validateCoupon(couponCode, quote.price.subtotal) : undefined;
    if (coupon) this.applyCouponToQuote(coupon, quote);
    return quote;
  }

  /** Quote for a direct buy-now purchase (single product, no cart). */
  async quoteBuyNow(userId: string, productId: string, quantity: number, couponCode?: string): Promise<QuoteResult> {
    const product = await this.prisma.product.findFirst({ where: { ...purchasableWhere, id: productId } });
    if (!product) throw new NotFoundException('Product not available');
    const quote = this.quoteFromLines([{ product, quantity }]);
    const coupon = couponCode ? await this.validateCoupon(couponCode, quote.price.subtotal) : undefined;
    if (coupon) this.applyCouponToQuote(coupon, quote);
    return quote;
  }

  /** Place an order from the cart (cart-checkout). */
  async checkout(userId: string, dto: CheckoutDto): Promise<OrderPublic> {
    const cart = await this.assertClaimableCart(userId, dto.cartId);

    return this.prisma.$transaction(async (tx) => {
      const claimed = await tx.cart.updateMany({
        where: { id: cart.id, userId, status: 'ACTIVE' },
        data: { status: 'CONVERTED' },
      });
      if (claimed.count === 0) throw new ConflictException('This cart has already been checked out');

      const quote = await this.calcQuote(tx, cart);
      await this.applyCouponInTx(tx, dto.couponCode, quote);

      const order = await this.createOrderFromQuote(tx, {
        userId,
        quote,
        paymentMethod: dto.paymentMethod,
        address: dto.address,
      });

      if (dto.paymentMethod === PaymentMethod.PREPAID) {
        await this.payments.createIntentTx(tx, order.id, order.grandTotal.toNumber(), `order-${order.id}`);
      }
      return this.toPublic(order);
    });
  }

  /** Direct (no-cart) buy-now order placement. */
  async buyNow(userId: string, dto: BuyNowDto): Promise<OrderPaymentResult> {
    return this.prisma.$transaction(async (tx) => {
      const product = await tx.product.findFirst({ where: { ...purchasableWhere, id: dto.productId } });
      if (!product) throw new NotFoundException('Product not available');

      const quote = this.quoteFromLines([{ product, quantity: dto.quantity }]);
      await this.applyCouponInTx(tx, dto.couponCode, quote);

      const order = await this.createOrderFromQuote(tx, {
        userId,
        quote,
        paymentMethod: dto.paymentMethod,
        address: dto.address,
      });

      let payment = null;
      if (dto.paymentMethod === PaymentMethod.PREPAID) {
        payment = await this.payments.createIntentTx(tx, order.id, order.grandTotal.toNumber(), `order-${order.id}`);
      }
      return { order: this.toPublic(order), payment };
    });
  }

  async listUserOrders(userId: string, query: OrderListQuery = {}): Promise<OrderListResult> {
    const page = Math.max(1, Math.floor(query.page ?? 1));
    const limit = Math.min(100, Math.max(1, Math.floor(query.limit ?? 20)));

    const where: Prisma.OrderWhereInput = { userId };
    if (query.status) {
      const valid = Object.values(OrderStatus) as string[];
      if (!valid.includes(query.status)) throw new BadRequestException(`Invalid order status "${query.status}"`);
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

  /** Full status-history for one of the caller's own orders (for customer timeline). */
  async orderHistory(userId: string, id: string) {
    const order = await this.prisma.order.findFirst({ where: { id, userId } });
    if (!order) throw new NotFoundException('Order not found');
    const rows = await this.prisma.orderStatusHistory.findMany({
      where: { orderId: id },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((h) => ({
      id: h.id,
      fromStatus: h.fromStatus,
      toStatus: h.toStatus,
      actor: h.actor,
      reason: h.reason,
      createdAt: h.createdAt.toISOString(),
    }));
  }

  /** Public mapper exposed for internal modules (e.g. fulfilment). */
  toPublicOrder(order: Order & { items?: OrderItem[] }): OrderPublic {
    return this.toPublic(order);
  }

  async cancelOrder(userId: string, id: string, reason?: string): Promise<OrderPublic> {
    const order = await this.prisma.order.findFirst({ where: { id, userId } });
    if (!order) throw new NotFoundException('Order not found');
    if (order.status !== OrderStatus.PLACED && order.status !== OrderStatus.CONFIRMED) {
      throw new BadRequestException(`Order in "${order.status}" cannot be cancelled`);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const cancelled = await tx.order.updateMany({
        where: { id, userId, status: { in: [OrderStatus.PLACED, OrderStatus.CONFIRMED] } },
        data: { status: OrderStatus.CANCELLED, cancelledAt: new Date() },
      });
      if (cancelled.count === 0) throw new ConflictException('Order is no longer cancellable');

      const items = await tx.orderItem.findMany({ where: { orderId: id } });
      for (const it of items) {
        await tx.product.update({ where: { id: it.productId }, data: { stockOnHand: { increment: it.quantity } } });
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

  private async assertClaimableCart(userId: string, cartId: string): Promise<Cart> {
    const cart = await this.prisma.cart.findFirst({ where: { id: cartId, userId } });
    if (!cart) throw new NotFoundException('Cart not found');
    if (cart.status !== CartStatus.ACTIVE) {
      throw new ConflictException('This cart is not active or has already been checked out');
    }
    return cart;
  }

  /** Validate (service-level) and apply a coupon, incrementing usage inside the tx. */
  private async applyCouponInTx(
    tx: Prisma.TransactionClient,
    couponCode: string | undefined,
    quote: QuoteResult,
  ): Promise<void> {
    if (!couponCode) return;
    const coupon = await this.validateCoupon(couponCode, quote.price.subtotal);
    if (!coupon) return;
    this.applyCouponToQuote(coupon, quote);
    await tx.coupon.update({ where: { id: coupon.id }, data: { usageCount: { increment: 1 } } });
  }

  private async calcQuote(db: Prisma.TransactionClient, cart: Cart): Promise<QuoteResult> {
    const rows = await db.cartItem.findMany({ where: { cartId: cart.id }, include: { product: true } });
    if (rows.length === 0) throw new BadRequestException('Your cart is empty');
    return this.quoteFromLines(
      rows.map((r) => ({ product: r.product, quantity: r.quantity })),
      (name) => `"${name}" is no longer available. Please review your cart.`,
    );
  }

  private quoteFromLines(
    lines: { product: Product; quantity: number }[],
    unavailableMsg: (name: string) => string = (name) => `"${name}" is no longer available`,
  ): QuoteResult {
    const items: OrderItemPublic[] = [];
    let subtotal = 0;
    for (const line of lines) {
      const p = line.product;
      if (p.status !== 'APPROVED' || p.visibility !== 'LIVE' || p.deletedAt) {
        throw new BadRequestException(unavailableMsg(p.name));
      }
      if (p.stockOnHand < line.quantity) {
        throw new BadRequestException(`Only ${p.stockOnHand} units of "${p.name}" are available.`);
      }
      const unit = p.basePrice.toNumber();
      const lineTotal = unit * line.quantity;
      subtotal += lineTotal;
      items.push({
        productId: p.id,
        productName: p.name,
        sku: p.slug,
        weight: p.weightLabel,
        unitPrice: unit,
        quantity: line.quantity,
        lineTotal,
      });
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

  private async createOrderFromQuote(
    tx: Prisma.TransactionClient,
    args: {
      userId: string;
      quote: QuoteResult;
      paymentMethod: PaymentMethod;
      address: unknown;
    },
  ): Promise<Order & { items: OrderItem[] }> {
    for (const item of args.quote.items) {
      const res = await tx.product.updateMany({
        where: { id: item.productId, stockOnHand: { gte: item.quantity } },
        data: { stockOnHand: { decrement: item.quantity } },
      });
      if (res.count === 0) throw new BadRequestException(`Insufficient stock for "${item.productName}"`);
    }

    const orderNumber = await this.generateOrderNumber(tx);
    const paymentStatus =
      args.paymentMethod === PaymentMethod.COD ? PaymentStatus.COD_PENDING : PaymentStatus.PENDING;

    const order = await tx.order.create({
      data: {
        orderNumber,
        userId: args.userId,
        status: OrderStatus.PLACED,
        subtotal: args.quote.price.subtotal,
        discountTotal: args.quote.price.discount,
        taxTotal: args.quote.price.tax,
        deliveryTotal: args.quote.price.deliveryCharge,
        grandTotal: args.quote.price.grandTotal,
        couponCode: args.quote.price.couponCode,
        couponDiscount: args.quote.price.couponDiscount,
        paymentMethod: args.paymentMethod,
        paymentStatus,
        addressSnapshot: args.address as Prisma.InputJsonValue,
        items: {
          create: args.quote.items.map((it) => ({
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
            actorId: args.userId,
            metadata: { paymentMethod: args.paymentMethod },
          },
        },
      },
      include: { items: true },
    });
    return order;
  }

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
    if (coupon.validTo && coupon.validTo < new Date()) throw new BadRequestException('Coupon has expired');
    if (coupon.validFrom && coupon.validFrom > new Date()) throw new BadRequestException('Coupon is not yet active');
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
        orderItemId: i.id,
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
