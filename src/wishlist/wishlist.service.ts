import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CatalogService } from '../catalog/catalog.service';
import { PublicProduct } from '../catalog/catalog.types';

// Signed-in CUSTOMER wishlist. Rows are (userId, productId) unique; add/remove is a
// toggle and idempotent. Wishlist is intentionally tied to the account (guest carts
// merge, guest wishlists do not exist). Product projection is reused from Catalog so
// the storefront ProductCard renders identically to catalog browsing.
@Injectable()
export class WishlistService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly catalog: CatalogService,
  ) {}

  /** Just the saved product ids, cheapest call for per-card heart state. */
  async savedIds(userId: string): Promise<string[]> {
    const rows = await this.prisma.wishlistItem.findMany({
      where: { userId },
      select: { productId: true },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => r.productId);
  }

  /** Full wishlist (newest first) with public product projection. */
  async list(userId: string): Promise<{ productId: string; savedAt: string; product: PublicProduct }[]> {
    const rows = await this.prisma.wishlistItem.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    const products = await this.catalog.publicProductsByIds(rows.map((r) => r.productId));
    const byId = new Map(products.map((p) => [p.id, p]));
    return rows
      .map((r) => ({
        productId: r.productId,
        savedAt: r.createdAt.toISOString(),
        product: byId.get(r.productId),
      }))
      // drop products that are no longer public/live (e.g. removed by seller)
      .filter((x): x is { productId: string; savedAt: string; product: PublicProduct } => !!x.product);
  }

  async add(userId: string, productId: string): Promise<{ saved: boolean }> {
    await this.assertPublicProduct(productId);
    const existing = await this.prisma.wishlistItem.findUnique({
      where: { userId_productId: { userId, productId } },
    });
    if (!existing) {
      await this.prisma.wishlistItem.create({ data: { userId, productId } });
    }
    return { saved: true };
  }

  async remove(userId: string, productId: string): Promise<{ saved: boolean }> {
    await this.prisma.wishlistItem
      .deleteMany({ where: { userId, productId } })
      .then(() => undefined);
    return { saved: false };
  }

  private async assertPublicProduct(productId: string): Promise<void> {
    const product = await this.catalog.publicProductsByIds([productId]);
    if (product.length === 0) throw new NotFoundException('Product not found or not available for purchase');
  }
}
