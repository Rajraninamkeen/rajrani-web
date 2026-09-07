import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, SellerOrderStatus } from '../generated/prisma/client';
import { SellerOrderListQuery } from './dto/seller.dto';

type SellerOrderWithCtx = Prisma.SellerOrderGetPayload<{
  include: {
    order: { select: { orderNumber: true; placedAt: true; status: true } };
    items: true;
  };
}>;

// Seller-ops core (Session 09 split-checkout). A SELLER-role user must be bound
// to a seller (users.sellerId) to operate; every action is scoped to that seller.
@Injectable()
export class SellerOpsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Resolve the caller's seller org id, enforcing SELLER role + binding. */
  private async requireSeller(userId: string): Promise<string> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.role !== 'SELLER') throw new ForbiddenException('Seller access only');
    if (!user.sellerId) throw new ForbiddenException('Account is not linked to a seller organisation');
    const seller = await this.prisma.seller.findFirst({
      where: { id: user.sellerId, status: 'ACTIVE' },
    });
    if (!seller) throw new ForbiddenException('Seller is not active');
    return user.sellerId;
  }

  async mySeller(userId: string) {
    const sellerId = await this.requireSeller(userId);
    const s = await this.prisma.seller.findUniqueOrThrow({ where: { id: sellerId } });
    return { id: s.id, sellerCode: s.sellerCode, displayName: s.displayName, status: s.status };
  }

  /** Products in the seller's own catalog. */
  async myProducts(userId: string) {
    const sellerId = await this.requireSeller(userId);
    const products = await this.prisma.product.findMany({
      where: { sellerId, deletedAt: null },
      orderBy: { createdAt: 'asc' },
    });
    return products.map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      basePrice: p.basePrice.toNumber(),
      stockOnHand: p.stockOnHand,
      stockStatus: p.stockStatus,
      status: p.status,
      visibility: p.visibility,
    }));
  }

  /** Seller_order slices belonging to the seller (with a bit of order context). */
  async listSellerOrders(userId: string, query: SellerOrderListQuery = {}) {
    const sellerId = await this.requireSeller(userId);
    const page = Math.max(1, Math.floor(query.page ?? 1));
    const limit = Math.min(100, Math.max(1, Math.floor(query.limit ?? 20)));

    const where: { sellerId: string; status?: SellerOrderStatus } = { sellerId };
    if (query.status) where.status = query.status;

    const [rows, total] = await Promise.all([
      this.prisma.sellerOrder.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { order: { select: { orderNumber: true, placedAt: true, status: true } }, items: true },
      }),
      this.prisma.sellerOrder.count({ where }),
    ]);

    return {
      items: rows.map((so) => this.project(so)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /** Detail of one of the seller's seller_orders. */
  async getSellerOrder(userId: string, sellerOrderId: string) {
    const sellerId = await this.requireSeller(userId);
    const so = await this.prisma.sellerOrder.findFirst({
      where: { id: sellerOrderId, sellerId },
      include: { order: { select: { orderNumber: true, placedAt: true, status: true } }, items: true },
    });
    if (!so) throw new NotFoundException('Seller order not found');
    return this.project(so);
  }

  /** Seller confirms they will fulfil their slice. */
  async accept(userId: string, sellerOrderId: string) {
    const sellerId = await this.requireSeller(userId);
    const res = await this.prisma.sellerOrder.updateMany({
      where: { id: sellerOrderId, sellerId, status: SellerOrderStatus.PLACED },
      data: { status: SellerOrderStatus.ACCEPTED, acceptedAt: new Date() },
    });
    if (res.count === 0) {
      const exists = await this.prisma.sellerOrder.findFirst({ where: { id: sellerOrderId, sellerId } });
      if (!exists) throw new NotFoundException('Seller order not found');
      throw new BadRequestException(`Seller order cannot be accepted from "${exists.status}" (only PLACED)`);
    }
    return this.getSellerOrder(userId, sellerOrderId);
  }

  /** Seller declines their slice (reason required). */
  async reject(userId: string, sellerOrderId: string, reason: string) {
    const sellerId = await this.requireSeller(userId);
    if (!reason || !reason.trim()) throw new BadRequestException('A reason is required to reject');
    const res = await this.prisma.sellerOrder.updateMany({
      where: { id: sellerOrderId, sellerId, status: SellerOrderStatus.PLACED },
      data: { status: SellerOrderStatus.REJECTED, rejectedAt: new Date(), rejectionReason: reason },
    });
    if (res.count === 0) {
      const exists = await this.prisma.sellerOrder.findFirst({ where: { id: sellerOrderId, sellerId } });
      if (!exists) throw new NotFoundException('Seller order not found');
      throw new BadRequestException(`Seller order cannot be rejected from "${exists.status}" (only PLACED)`);
    }
    return this.getSellerOrder(userId, sellerOrderId);
  }

  private project(so: SellerOrderWithCtx) {
    return {
      id: so.id,
      sellerOrderNumber: so.sellerOrderNumber,
      status: so.status,
      orderId: so.orderId,
      orderNumber: so.order?.orderNumber,
      orderPlacedAt: so.order?.placedAt?.toISOString(),
      orderStatus: so.order?.status,
      subtotal: so.subtotal.toNumber(),
      grandTotal: so.grandTotal.toNumber(),
      sellerAmount: so.sellerAmount.toNumber(),
      acceptedAt: so.acceptedAt?.toISOString() ?? null,
      rejectedAt: so.rejectedAt?.toISOString() ?? null,
      rejectionReason: so.rejectionReason ?? null,
      items: (so.items ?? []).map((i) => ({
        orderItemId: i.id,
        productName: i.productNameSnapshot,
        quantity: i.quantity,
        lineTotal: i.lineTotal.toNumber(),
      })),
    };
  }
}
