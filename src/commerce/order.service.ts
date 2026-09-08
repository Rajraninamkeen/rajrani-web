import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
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
  RefundMethod,
  RefundState,
  Seller,
  SellerOrder,
  SellerOrderStatus,
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

/** A purchasable line carrying its owning seller (Session 09 split-checkout). */
interface QuoteLine {
  product: Product;
  sellerId: string;
  sellerName: string;
  quantity: number;
}

export interface QuoteResult {
  items: OrderItemPublic[];
  price: PriceBreakdown;
  /** group items by seller to create one SellerOrder per seller */
  sellers: { sellerId: string; sellerName: string }[];
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
    const product = await this.prisma.product.findFirst({
      where: { ...purchasableWhere, id: productId },
      include: { seller: true },
    });
    if (!product) throw new NotFoundException('Product not available');
    const quote = this.quoteFromLines([
      { product, sellerId: product.seller.id, sellerName: product.seller.displayName, quantity },
    ]);
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
      const product = await tx.product.findFirst({
        where: { ...purchasableWhere, id: dto.productId },
        include: { seller: true },
      });
      if (!product) throw new NotFoundException('Product not available');

      const quote = this.quoteFromLines([
        { product, sellerId: product.seller.id, sellerName: product.seller.displayName, quantity: dto.quantity },
      ]);
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

  /** Staff (OPERATOR/ADMIN) read: any order in the system, no user scoping. */
  async listOrders(query: OrderListQuery = {}): Promise<OrderListResult> {
    const page = Math.max(1, Math.floor(query.page ?? 1));
    const limit = Math.min(100, Math.max(1, Math.floor(query.limit ?? 20)));

    const where: Prisma.OrderWhereInput = {};
    if (query.status) {
      const valid = Object.values(OrderStatus) as string[];
      if (!valid.includes(query.status)) throw new BadRequestException(`Invalid order status "${query.status}"`);
      where.status = query.status;
    }

    const [rows, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        include: { items: true, sellerOrders: { include: { seller: true } } },
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

  /** Staff (OPERATOR/ADMIN) read of a single order by id. */
  async getOrderStaff(orderId: string): Promise<OrderPublic> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true, sellerOrders: { include: { seller: true } } },
    });
    if (!order) throw new NotFoundException('Order not found');
    return this.toPublic(order);
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
        include: { items: true, sellerOrders: { include: { seller: true } } },
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
    const order = await this.prisma.order.findFirst({
      where: { id, userId },
      include: { items: true, sellerOrders: { include: { seller: true } } },
    });
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

      // Full order cancellation: cancel every slice that is not already cancelled,
      // and only release stock for items of those slices (never double-release an
      // item belonging to a slice that was already cancelled by partial resolution).
      const slices = await tx.sellerOrder.findMany({
        where: { orderId: id, status: { not: SellerOrderStatus.CANCELLED } },
      });
      const releaseSliceIds = slices.map((s) => s.id);
      if (releaseSliceIds.length) {
        await tx.sellerOrder.updateMany({
          where: { id: { in: releaseSliceIds } },
          data: {
            status: SellerOrderStatus.CANCELLED,
            cancelledAt: new Date(),
            cancellationReason: 'Order cancelled',
          },
        });
      }
      const items = await tx.orderItem.findMany({ where: { orderId: id } });
      for (const it of items) {
        if (releaseSliceIds.includes(it.sellerOrderId)) {
          await tx.product.update({ where: { id: it.productId }, data: { stockOnHand: { increment: it.quantity } } });
        }
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
      const up = await tx.order.findUniqueOrThrow({
        where: { id },
        include: { items: true, sellerOrders: { include: { seller: true } } },
      });
      return up;
    });
    return this.toPublic(updated);
  }

  /**
   * Partial fulfilment resolution (Session 11). When a seller has REJECTED their
   * slice before shipping, an OPERATOR resolves it into a CANCELLATION: that
   * seller's items are dropped from the shipment and their stock is released.
   * For a PREPAID order the customer is refunded this slice's grand-total share
   * (so the remaining ACCEPTED slices still ship together as one delivery).
   * Returns the updated order with sellerOrders.
   */
  async resolveRejectedSlice(
    actorUserId: string,
    orderId: string,
    sellerOrderId: string,
    reason?: string,
  ): Promise<OrderPublic> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { sellerOrders: { include: { seller: true } }, items: true },
    });
    if (!order) throw new NotFoundException('Order not found');

    // Must be pre-shipment (a slice can only be pulled before the order ships).
    const resolvable: OrderStatus[] = [OrderStatus.PLACED, OrderStatus.CONFIRMED, OrderStatus.PACKED];
    if (!resolvable.includes(order.status)) {
      throw new BadRequestException(
        `A rejected slice can only be resolved while the order is PLACED/CONFIRMED/PACKED, not "${order.status}"`,
      );
    }
    const slice = order.sellerOrders.find((s) => s.id === sellerOrderId);
    if (!slice) throw new NotFoundException('Seller slice not found on this order');
    if (slice.status !== SellerOrderStatus.REJECTED) {
      throw new BadRequestException(`Only a REJECTED slice can be resolved (this one is "${slice.status}")`);
    }

    // PREPAID partial refund requires the money to already be captured.
    const refundAmount = slice.grandTotal.toNumber();
    if (order.paymentMethod === PaymentMethod.PREPAID && order.paymentStatus !== PaymentStatus.PAID) {
      throw new BadRequestException(
        'Confirm (capture) payment first — a PREPAID order must be PAID before resolving a rejected slice so the slice can be refunded',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      // mark slice cancelled + release its stock
      await tx.sellerOrder.update({
        where: { id: slice.id },
        data: {
          status: SellerOrderStatus.CANCELLED,
          cancelledAt: new Date(),
          cancellationReason: reason ?? 'Rejected by seller — cancelled for partial fulfilment',
        },
      });
      const sliceItems = order.items.filter((i) => i.sellerOrderId === slice.id);
      for (const it of sliceItems) {
        await tx.product.update({ where: { id: it.productId }, data: { stockOnHand: { increment: it.quantity } } });
      }

      let refundId: string | null = null;
      if (order.paymentMethod === PaymentMethod.PREPAID) {
        // Guard: cumulative refunds must not exceed the order grand total.
        const agg = await tx.refund.aggregate({
          where: { orderId, status: { in: [RefundState.PENDING, RefundState.PROCESSING, RefundState.COMPLETED] } },
          _sum: { amount: true },
        });
        const already = agg._sum.amount ? agg._sum.amount.toNumber() : 0;
        if (this.round2(already + refundAmount) > this.round2(order.grandTotal.toNumber() + 0.001)) {
          throw new BadRequestException('Refunding this slice would exceed the order grand total');
        }
        const payment = await tx.payment.findUnique({ where: { orderId } });
        const reference = `RFD-${randomBytes(6).toString('hex').toUpperCase()}`;
        const gatewayRef = `sndbox-cancel-${randomBytes(6).toString('hex')}`;
        const refund = await tx.refund.create({
          data: {
            orderId,
            sellerOrderId: slice.id,
            paymentId: payment?.id ?? null,
            refundReference: reference,
            amount: refundAmount,
            method: RefundMethod.GATEWAY,
            status: RefundState.COMPLETED,
            gatewayProvider: 'sandbox',
            gatewayRef,
            reason: reason ?? 'Seller rejected slice — auto partial refund',
            initiatedById: actorUserId,
            initiatedAt: new Date(),
            completedAt: new Date(),
            transactions: {
              create: {
                provider: 'sandbox',
                providerReference: gatewayRef,
                amount: refundAmount,
                status: 'SUCCESS',
                completedAt: new Date(),
              },
            },
          },
        });
        refundId = refund.id;
      }

      await tx.orderStatusHistory.create({
        data: {
          orderId,
          fromStatus: order.status,
          toStatus: order.status, // order status unchanged
          actor: OrderActor.CONTROL,
          actorId: actorUserId,
          reason:
            reason ??
            `Resolved rejected seller slice "${slice.seller.displayName}" to CANCELLED${
              refundId ? '; partial refund recorded' : ''
            }`,
          metadata: { transition: 'seller-slice-resolution', sellerOrderId: slice.id, refundId, refundAmount },
        },
      });

      return tx.order.findUniqueOrThrow({
        where: { id: orderId },
        include: { items: true, sellerOrders: { include: { seller: true } } },
      });
    }).then((updated) => this.toPublic(updated));
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
    const rows = await db.cartItem.findMany({
      where: { cartId: cart.id },
      include: { product: { include: { seller: true } } },
    });
    if (rows.length === 0) throw new BadRequestException('Your cart is empty');
    return this.quoteFromLines(
      rows.map((r) => ({
        product: r.product,
        sellerId: r.product.seller.id,
        sellerName: r.product.seller.displayName,
        quantity: r.quantity,
      })),
      (name) => `"${name}" is no longer available. Please review your cart.`,
    );
  }

  private quoteFromLines(
    lines: QuoteLine[],
    unavailableMsg: (name: string) => string = (name) => `"${name}" is no longer available`,
  ): QuoteResult {
    const items: OrderItemPublic[] = [];
    const sellers: { sellerId: string; sellerName: string }[] = [];
    const seen = new Set<string>();
    let subtotal = 0;
    for (const line of lines) {
      const p = line.product;
      if (p.status !== 'APPROVED' || p.visibility !== 'LIVE' || p.deletedAt) {
        throw new BadRequestException(unavailableMsg(p.name));
      }
      if (p.stockOnHand < line.quantity) {
        throw new BadRequestException(`Only ${p.stockOnHand} units of "${p.name}" are available.`);
      }
      if (!seen.has(line.sellerId)) {
        seen.add(line.sellerId);
        sellers.push({ sellerId: line.sellerId, sellerName: line.sellerName });
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
        sellerId: line.sellerId,
        sellerName: line.sellerName,
      });
    }
    const deliveryCharge = subtotal >= FREE_DELIVERY_ABOVE ? 0 : DELIVERY_FLAT;
    const tax = this.round2(subtotal * TAX_RATE);
    return {
      items,
      sellers,
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

    // ---- Session 09: split the order into one seller_order per seller ----
    // The customer Order keeps its authoritative totals/payment. Each SellerOrder
    // receives that seller's real subtotal (sum of its lines) and a proportional
    // share of the order-level tax/discount/delivery/grand allocated by line-value
    // share (f_S), with the last seller taking the rounding remainder so that
    // SUM(seller_orders.grandTotal) === orders.grandTotal exactly.
    const sellerTotals = this.sellerAllocation(args.quote);
    const sellerOrderIdBySeller = new Map<string, string>();

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
        history: {
          create: {
            fromStatus: null,
            toStatus: OrderStatus.PLACED,
            actor: OrderActor.CUSTOMER,
            actorId: args.userId,
            metadata: { paymentMethod: args.paymentMethod, sellerCount: sellerTotals.length },
          },
        },
      },
    });

    for (const s of sellerTotals) {
      const so = await tx.sellerOrder.create({
        data: {
          orderId: order.id,
          sellerId: s.sellerId,
          sellerOrderNumber: await this.genSellerOrderNumber(tx),
          status: SellerOrderStatus.PLACED,
          subtotal: s.subtotal,
          discountTotal: s.discountTotal,
          taxTotal: s.taxTotal,
          deliveryTotal: s.deliveryTotal,
          grandTotal: s.grandTotal,
          sellerAmount: s.grandTotal,
        },
      });
      sellerOrderIdBySeller.set(s.sellerId, so.id);
    }

    for (const it of args.quote.items) {
      const soId = sellerOrderIdBySeller.get(it.sellerId ?? '');
      if (!soId) throw new Error(`No seller_order allocated for seller of "${it.productName}"`);
      await tx.orderItem.create({
        data: {
          orderId: order.id,
          sellerOrderId: soId,
          productId: it.productId,
          productNameSnapshot: it.productName,
          sellerNameSnapshot: it.sellerName ?? null,
          skuSnapshot: it.sku,
          weightSnapshot: it.weight,
          unitPrice: it.unitPrice,
          quantity: it.quantity,
          lineTotal: it.lineTotal,
        },
      });
    }

    const created = await tx.order.findUniqueOrThrow({
      where: { id: order.id },
      include: { items: true, sellerOrders: { include: { seller: true } } },
    });
    return created;
  }

  /**
   * Compute per-seller money attribution for a quote. Guarantees the seller
   * grandTotals sum exactly to the order grandTotal (last seller absorbs rounding).
   */
  private sellerAllocation(quote: QuoteResult) {
    const p = quote.price;
    const orderSubtotal = p.subtotal;
    // real subtotal per seller (sum of that seller's lines)
    const subBySeller = new Map<string, number>();
    for (const it of quote.items) {
      const k = it.sellerId ?? '';
      subBySeller.set(k, (subBySeller.get(k) ?? 0) + it.lineTotal);
    }
    const sellers = quote.sellers;
    const result: {
      sellerId: string;
      subtotal: number;
      discountTotal: number;
      taxTotal: number;
      deliveryTotal: number;
      grandTotal: number;
    }[] = [];
    let allocated = 0;
    for (let i = 0; i < sellers.length; i++) {
      const seller = sellers[i];
      const sub = subBySeller.get(seller.sellerId) ?? 0;
      const f = orderSubtotal > 0 ? sub / orderSubtotal : 1;
      let grand: number;
      if (i === sellers.length - 1) {
        grand = Math.round((p.grandTotal - allocated) * 100) / 100; // remainder
      } else {
        grand = Math.round(p.grandTotal * f * 100) / 100;
        allocated += grand;
      }
      result.push({
        sellerId: seller.sellerId,
        subtotal: Math.round(sub * 100) / 100,
        discountTotal: Math.round((p.discount + p.couponDiscount) * f * 100) / 100,
        taxTotal: Math.round(p.tax * f * 100) / 100,
        deliveryTotal: Math.round(p.deliveryCharge * f * 100) / 100,
        grandTotal: grand,
      });
    }
    return result;
  }

  private async genSellerOrderNumber(tx: Prisma.TransactionClient): Promise<string> {
    return `SO-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 10000)}`;
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

  private toPublic(
    order: Order & { items?: OrderItem[]; sellerOrders?: (SellerOrder & { seller: Seller })[] },
  ): OrderPublic {
    const o = order as Order & { items?: OrderItem[]; sellerOrders?: (SellerOrder & { seller: Seller })[] };
    const price: PriceBreakdown = {
      subtotal: o.subtotal.toNumber(),
      discount: o.discountTotal.toNumber(),
      deliveryCharge: o.deliveryTotal.toNumber(),
      tax: o.taxTotal.toNumber(),
      couponDiscount: o.couponDiscount.toNumber(),
      couponCode: o.couponCode,
      grandTotal: o.grandTotal.toNumber(),
    };
    const out: OrderPublic = {
      id: o.id,
      orderNumber: o.orderNumber,
      status: o.status,
      paymentMethod: o.paymentMethod,
      paymentStatus: o.paymentStatus,
      placedAt: o.placedAt.toISOString(),
      items: (o.items ?? []).map((i) => ({
        orderItemId: i.id,
        productId: i.productId,
        productName: i.productNameSnapshot,
        sku: i.skuSnapshot,
        weight: i.weightSnapshot,
        unitPrice: i.unitPrice.toNumber(),
        quantity: i.quantity,
        lineTotal: i.lineTotal.toNumber(),
        sellerName: i.sellerNameSnapshot,
      })),
      price,
    };
    if (o.sellerOrders && o.sellerOrders.length > 0) {
      out.sellerOrders = o.sellerOrders.map((so) => ({
        id: so.id,
        sellerOrderNumber: so.sellerOrderNumber,
        sellerId: so.sellerId,
        sellerName: so.seller.displayName,
        status: so.status,
        itemCount: (o.items ?? []).filter((i) => i.sellerOrderId === so.id).length,
        subtotal: so.subtotal.toNumber(),
        grandTotal: so.grandTotal.toNumber(),
        acceptedAt: so.acceptedAt?.toISOString() ?? null,
        rejectedAt: so.rejectedAt?.toISOString() ?? null,
        rejectionReason: so.rejectionReason ?? null,
        shippedAt: so.shippedAt?.toISOString() ?? null,
        deliveredAt: so.deliveredAt?.toISOString() ?? null,
        cancelledAt: so.cancelledAt?.toISOString() ?? null,
        cancellationReason: so.cancellationReason ?? null,
      }));
    }
    return out;
  }
}
