import { Injectable, NotFoundException } from '@nestjs/common';
import { CategoryStatus, Product, Prisma, SpiceLevel, VisibilityStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ListProductsQuery } from './dto/list-products.query';
import {
  ProductListResult,
  PublicCategory,
  PublicProduct,
  SpiceLevelNumber,
} from './catalog.types';

// Map enum value -> landing numeric (1 MILD .. 4 FIERY).
const SPICE_TO_NUM: Record<SpiceLevel, SpiceLevelNumber> = {
  MILD: 1,
  MEDIUM: 2,
  SPICY: 3,
  FIERY: 4,
};

const LIVE: VisibilityStatus = 'LIVE';

/** Products are public only once APPROVED + LIVE + not deleted. */
const publicWhere = (): Prisma.ProductWhereInput => ({
  status: 'APPROVED',
  visibility: LIVE,
  deletedAt: null,
});

function mapProduct(product: Product & { media?: { url: string }[]; category?: { slug: string } }): PublicProduct {
  const discount = product.originalPrice && product.originalPrice.gt(product.basePrice)
    ? Math.round(
        product.originalPrice.minus(product.basePrice).div(product.originalPrice).mul(100).toNumber(),
      )
    : 0;
  const image = product.media && product.media.length > 0 ? product.media[0].url : null;
  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    tagline: product.tagline,
    description: product.description,
    price: product.basePrice.toNumber(),
    originalPrice: product.originalPrice ? product.originalPrice.toNumber() : null,
    discountPercent: discount,
    weight: product.weightLabel,
    rating: product.ratingAvg,
    reviewCount: product.reviewCount,
    image,
    category: product.category?.slug ?? '',
    spiceLevel: product.spiceLevel ? (SPICE_TO_NUM[product.spiceLevel] ?? null) : null,
    isNew: product.isNew,
    isBestseller: product.isBestseller,
    stockLeft: product.stockOnHand,
    inStock: product.stockOnHand > 0,
    regionOrigin: product.regionOrigin,
    ingredients: product.ingredients,
    nutritionalInfo: (product.nutritional as Record<string, string> | null) ?? null,
    pairingSuggestion: product.pairingSuggestion,
    customerFavTag: product.customerFavTag,
  };
}

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  async listCategories(): Promise<PublicCategory[]> {
    const cats = await this.prisma.category.findMany({
      where: { status: CategoryStatus.ACTIVE, deletedAt: null },
      orderBy: { sortOrder: 'asc' },
    });
    return cats.map((c) => ({ id: c.id, name: c.name, slug: c.slug, description: c.description }));
  }

  async listProducts(query: ListProductsQuery): Promise<ProductListResult> {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 12, 60);
    const where: Prisma.ProductWhereInput = { ...publicWhere() };

    if (query.category) {
      where.category = { slug: query.category };
    }
    if (query.bestseller === true) {
      where.isBestseller = true;
    }
    if (query.isNew === true) {
      where.isNew = true;
    }
    if (query.q) {
      where.OR = [
        { name: { contains: query.q, mode: 'insensitive' } },
        { tagline: { contains: query.q, mode: 'insensitive' } },
        { description: { contains: query.q, mode: 'insensitive' } },
      ];
    }
    if (query.minPrice !== undefined || query.maxPrice !== undefined) {
      where.basePrice = {
        ...(query.minPrice !== undefined ? { gte: query.minPrice } : {}),
        ...(query.maxPrice !== undefined ? { lte: query.maxPrice } : {}),
      };
    }

    let orderBy: Prisma.ProductOrderByWithRelationInput | Prisma.ProductOrderByWithRelationInput[] =
      { name: 'asc' };
    switch (query.sort) {
      case 'price_asc':
        orderBy = { basePrice: 'asc' };
        break;
      case 'price_desc':
        orderBy = { basePrice: 'desc' };
        break;
      case 'rating':
        orderBy = { ratingAvg: 'desc' };
        break;
      case 'newest':
        orderBy = { publishedAt: 'desc' };
        break;
      case 'popular':
        orderBy = [{ isBestseller: 'desc' }, { reviewCount: 'desc' }];
        break;
    }

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.product.count({ where }),
      this.prisma.product.findMany({
        where,
        include: { category: true, media: { orderBy: { sortOrder: 'asc' }, take: 1 } },
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      products: rows.map((r) => mapProduct(r as Product & { media?: { url: string }[]; category?: { slug: string } })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getProductByIdentifier(identifier: string): Promise<PublicProduct> {
    const product = await this.prisma.product.findFirst({
      where: {
        AND: [
          { OR: [{ id: identifier }, { slug: identifier }] },
          publicWhere(),
        ],
      },
      include: { category: true, media: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!product) {
      throw new NotFoundException('Product not found');
    }
    return mapProduct(product as never);
  }
}
