import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Cart, CartItem, Product, Prisma, CartStatus } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AddCartItemDto, UpdateCartItemDto } from './dto/cart.dto';
import { CartLinePublic, CartPublic } from './commerce.types';

export interface CartContext {
  userId?: string;
  guestSessionId?: string;
}

// Only APPROVED + LIVE products may be added to a cart (Master-Spec §28).
const purchasableWhere: Prisma.ProductWhereInput = {
  status: 'APPROVED',
  visibility: 'LIVE',
  deletedAt: null,
};

@Injectable()
export class CartService {
  constructor(private readonly prisma: PrismaService) {}

  /** Resolve the active cart for a user and/or guest; merge + create as needed. */
  async resolveCart(ctx: CartContext): Promise<Cart> {
    if (ctx.userId) {
      let userCart = await this.prisma.cart.findFirst({
        where: { userId: ctx.userId, status: CartStatus.ACTIVE },
      });

      // Merge a guest cart into the user cart on first login if one is supplied.
      if (!userCart && ctx.guestSessionId) {
        userCart = await this.migrateGuestToUser(ctx.guestSessionId, ctx.userId);
      }
      if (!userCart) {
        userCart = await this.prisma.cart.create({
          data: { userId: ctx.userId, status: CartStatus.ACTIVE },
        });
      }
      return userCart;
    }

    if (ctx.guestSessionId) {
      const guestCart = await this.prisma.cart.findUnique({
        where: { guestSessionId: ctx.guestSessionId },
      });
      if (guestCart) return guestCart;
      return this.prisma.cart.create({
        data: { guestSessionId: ctx.guestSessionId, status: CartStatus.ACTIVE },
      });
    }

    throw new BadRequestException('A user session or guest session is required');
  }

  private async migrateGuestToUser(guestSessionId: string, userId: string): Promise<Cart> {
    const guestCart = await this.prisma.cart.findUnique({
      where: { guestSessionId },
      include: { items: true },
    });
    // If there is no guest cart, just create a fresh user cart below.
    if (!guestCart) {
      return this.prisma.cart.create({
        data: { userId, status: CartStatus.ACTIVE },
      });
    }
    const newCart = await this.prisma.cart.create({
      data: { userId, status: CartStatus.ACTIVE },
    });
    for (const item of guestCart.items) {
      await this.upsertItem(newCart.id, item.productId, item.quantity);
    }
    await this.prisma.cart.update({
      where: { id: guestCart.id },
      data: { status: CartStatus.MERGED },
    });
    return newCart;
  }

  /** Add (or increment) an item. Validates product availability + inventory. */
  async addItem(ctx: CartContext, dto: AddCartItemDto): Promise<CartPublic> {
    const cart = await this.resolveCart(ctx);
    const product = await this.prisma.product.findFirst({
      where: { ...purchasableWhere, id: dto.productId },
    });
    if (!product) throw new NotFoundException('Product not available');

    // Combine existing qty (if any) with the new quantity before stock check.
    const existing = await this.prisma.cartItem.findUnique({
      where: { cartId_productId: { cartId: cart.id, productId: dto.productId } },
    });
    const targetQty = (existing?.quantity ?? 0) + dto.quantity;
    this.assertStock(product, targetQty);

    await this.upsertItem(cart.id, dto.productId, targetQty);
    return this.getPublic(cart.id);
  }

  async updateItem(ctx: CartContext, itemId: string, dto: UpdateCartItemDto): Promise<CartPublic> {
    const cart = await this.resolveCart(ctx);
    const item = await this.prisma.cartItem.findFirst({
      where: { id: itemId, cartId: cart.id },
      include: { product: true },
    });
    if (!item) throw new NotFoundException('Cart item not found');

    const product = await this.prisma.product.findFirst({
      where: { ...purchasableWhere, id: item.productId },
    });
    if (!product) throw new NotFoundException('Product no longer available');
    this.assertStock(product, dto.quantity);

    await this.prisma.cartItem.update({
      where: { id: item.id },
      data: { quantity: dto.quantity },
    });
    return this.getPublic(cart.id);
  }

  async removeItem(ctx: CartContext, itemId: string): Promise<CartPublic> {
    const cart = await this.resolveCart(ctx);
    await this.prisma.cartItem.deleteMany({ where: { id: itemId, cartId: cart.id } });
    return this.getPublic(cart.id);
  }

  async clear(ctx: CartContext): Promise<CartPublic> {
    const cart = await this.resolveCart(ctx);
    await this.prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
    return this.getPublic(cart.id);
  }

  async get(ctx: CartContext): Promise<CartPublic> {
    const cart = await this.resolveCart(ctx);
    return this.getPublic(cart.id);
  }

  /** Server-authoritative cart read: pulls fresh product prices + inventory. */
  async getPublic(cartId: string): Promise<CartPublic> {
    const rows = await this.prisma.cartItem.findMany({
      where: { cartId },
      include: { product: { include: { media: { orderBy: { sortOrder: 'asc' }, take: 1 } } } },
    });

    const items: CartLinePublic[] = [];
    let subtotal = 0;
    for (const r of rows) {
      const p = r.product as Product & { media?: { url: string }[] };
      if (p.status !== 'APPROVED' || p.visibility !== 'LIVE' || p.deletedAt) continue;
      const price = p.basePrice.toNumber();
      const line = price * r.quantity;
      subtotal += line;
      items.push({
        productId: p.id,
        name: p.name,
        image: p.media?.[0]?.url ?? null,
        price,
        originalPrice: p.originalPrice ? p.originalPrice.toNumber() : null,
        quantity: r.quantity,
        weight: p.weightLabel,
        lineTotal: line,
      });
    }
    return { cartId, status: 'ACTIVE', items, itemCount: items.length, subtotal };
  }

  private async upsertItem(cartId: string, productId: string, quantity: number): Promise<void> {
    await this.prisma.cartItem.upsert({
      where: { cartId_productId: { cartId, productId } },
      update: { quantity },
      create: { cartId, productId, quantity },
    });
  }

  private assertStock(product: Product, quantity: number): void {
    if (product.stockOnHand < quantity) {
      throw new BadRequestException(
        `Only ${product.stockOnHand} units of ${product.name} are in stock`,
      );
    }
  }
}
