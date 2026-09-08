import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CategoryStatus,
  Prisma,
  ProductStatus,
  VisibilityStatus,
} from '../generated/prisma/client';
import { CreateProductDto, UpdateProductDto } from './dto/product-publishing.dto';

/** Product rows the seller/staff authoring + publishing paths operate on. */
const WITH_DETAIL = {
  include: {
    category: { select: { id: true, name: true, slug: true } },
    media: { orderBy: { sortOrder: 'asc' as const } },
    statusHistory: { orderBy: { createdAt: 'desc' as const }, take: 20 },
  },
} as const;

const slugify = (s: string) =>
  s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120) || 'item';

function num(n: unknown): number {
  return typeof n === 'number' ? n : Number(n ?? 0);
}

function publicProduct(p: any) {
  const money = (d: any) => (d && typeof d.toNumber === 'function' ? d.toNumber() : Number(d ?? 0));
  return {
    id: p.id,
    name: p.name,
    slug: p.slug,
    tagline: p.tagline,
    description: p.description,
    brand: p.brand,
    regionOrigin: p.regionOrigin,
    status: p.status,
    visibility: p.visibility,
    category: p.category,
    basePrice: money(p.basePrice),
    originalPrice: p.originalPrice ? money(p.originalPrice) : null,
    weightLabel: p.weightLabel,
    spiceLevel: p.spiceLevel,
    ingredients: p.ingredients ?? [],
    nutritional: p.nutritional,
    pairingSuggestion: p.pairingSuggestion,
    isBestseller: p.isBestseller,
    isNew: p.isNew,
    stockStatus: p.stockStatus,
    stockOnHand: p.stockOnHand,
    ratingAvg: p.ratingAvg ?? 0,
    reviewCount: p.reviewCount ?? 0,
    reviewNote: p.reviewNote,
    publishedAt: p.publishedAt ? p.publishedAt.toISOString() : null,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
    media: (p.media ?? []).map((m: any) => ({
      id: m.id, url: m.url, altText: m.altText, kind: m.kind, sortOrder: m.sortOrder,
    })),
    history: (p.statusHistory ?? []).map((h: any) => ({
      fromStatus: h.fromStatus, toStatus: h.toStatus,
      actorRole: h.actorRole, actorId: h.actorId, reason: h.reason, createdAt: h.createdAt.toISOString(),
    })),
  };
}

@Injectable()
export class ProductPublishingService {
  constructor(private readonly prisma: PrismaService) {}

  /** Resolve the caller's ACTIVE seller org, enforcing SELLER role + binding. */
  private async requireSeller(userId: string): Promise<string> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.role !== 'SELLER') throw new ForbiddenException('Seller access only');
    if (!user.sellerId) throw new ForbiddenException('Account is not linked to a seller organisation');
    const seller = await this.prisma.seller.findFirst({ where: { id: user.sellerId, status: 'ACTIVE' } });
    if (!seller) throw new ForbiddenException('Seller is not active');
    return user.sellerId;
  }

  private async loadOwnedProduct(userId: string, productId: string) {
    const sellerId = await this.requireSeller(userId);
    const p = await this.prisma.product.findUnique({
      where: { id: productId },
      include: WITH_DETAIL.include,
    });
    if (!p || p.sellerId !== sellerId || p.deletedAt) throw new NotFoundException('Product not found');
    return p;
  }

  private async uniqueSlug(base: string, excludeId?: string): Promise<string> {
    const candidate = slugify(base);
    let slug = candidate;
    let i = 1;
    for (;;) {
      const existing = await this.prisma.product.findUnique({ where: { slug } });
      if (!existing || existing.id === excludeId) return slug;
      slug = `${candidate}-${++i}`;
    }
  }

  private async assertCategoryActive(categoryId: string) {
    const c = await this.prisma.category.findUnique({ where: { id: categoryId } });
    if (!c || c.status !== CategoryStatus.ACTIVE || c.deletedAt) {
      throw new BadRequestException('Category is not active');
    }
  }

  private async recordHistory(tx: Prisma.TransactionClient, productId: string, fromStatus: ProductStatus | null, toStatus: ProductStatus, actorRole: string, actorId: string, reason?: string) {
    await tx.productStatusHistory.create({
      data: { productId, fromStatus, toStatus, actorRole, actorId, reason },
    });
  }

  /** Resolve a staff actor's role (OPERATOR/ADMIN) for the audit trail. */
  private async staffRole(userId: string): Promise<string> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || (user.role !== 'OPERATOR' && user.role !== 'ADMIN')) {
      throw new ForbiddenException('Catalog publishing requires OPERATOR/ADMIN');
    }
    return user.role;
  }

  // ================= SELLER authoring =================

  async listMyProducts(userId: string, status?: string) {
    const sellerId = await this.requireSeller(userId);
    const rows = await this.prisma.product.findMany({
      where: { sellerId, deletedAt: null, ...(status ? { status: status as ProductStatus } : {}) },
      include: {
        category: { select: { id: true, name: true, slug: true } },
        media: { orderBy: { sortOrder: 'asc' as const } },
      },
      orderBy: { updatedAt: 'desc' },
    });
    return rows.map(publicProduct);
  }

  async getMyProduct(userId: string, productId: string) {
    return publicProduct(await this.loadOwnedProduct(userId, productId));
  }

  async createDraft(userId: string, dto: CreateProductDto) {
    const sellerId = await this.requireSeller(userId);
    await this.assertCategoryActive(dto.categoryId);
    const slug = dto.slug?.trim() ? await this.uniqueSlug(dto.slug) : await this.uniqueSlug(dto.name);
    return this.prisma.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: {
          name: dto.name,
          slug,
          categoryId: dto.categoryId,
          sellerId,
          brand: dto.brand ?? null,
          regionOrigin: dto.regionOrigin ?? null,
          tagline: dto.tagline ?? null,
          description: dto.description ?? null,
          status: ProductStatus.DRAFT,
          visibility: VisibilityStatus.HIDDEN,
          basePrice: dto.basePrice,
          originalPrice: dto.originalPrice ?? null,
          weightLabel: dto.weightLabel ?? null,
          spiceLevel: dto.spiceLevel ?? null,
          ingredients: dto.ingredients ?? [],
          nutritional: (dto.nutritional as any) ?? Prisma.JsonNull,
          pairingSuggestion: dto.pairingSuggestion ?? null,
          isBestseller: dto.isBestseller ?? false,
          isNew: dto.isNew ?? false,
          stockOnHand: dto.stockOnHand ?? 0,
          stockStatus: dto.stockStatus ?? (num(dto.stockOnHand ?? 0) > 0 ? 'IN_STOCK' : 'OUT_OF_STOCK'),
          media: dto.media?.length
            ? { create: dto.media.map((m) => ({ url: m.url, altText: m.altText ?? null, kind: m.kind ?? 'IMAGE', sortOrder: m.sortOrder ?? 0 })) }
            : undefined,
        },
        ...WITH_DETAIL,
      });
      await this.recordHistory(tx, product.id, null, ProductStatus.DRAFT, 'SELLER', userId, 'product created as draft');
      return publicProduct(await tx.product.findUniqueOrThrow({ where: { id: product.id }, ...WITH_DETAIL }));
    });
  }

  async updateDraft(userId: string, productId: string, dto: UpdateProductDto) {
    const p = await this.loadOwnedProduct(userId, productId);
    if (p.status !== ProductStatus.DRAFT && p.status !== ProductStatus.REJECTED) {
      throw new ConflictException('Only a DRAFT or REJECTED product can be edited');
    }
    let categoryId = dto.categoryId;
    if (categoryId && categoryId !== p.categoryId) await this.assertCategoryActive(categoryId);
    const data: Prisma.ProductUpdateInput = {};
    for (const [k, v] of Object.entries(dto)) {
      if (v === undefined) continue;
      if (k === 'media') continue;
      if (k === 'slug') continue;
      if (k === 'nutritional') { data.nutritional = (v as any) ?? Prisma.JsonNull; continue; }
      (data as any)[k] = v;
    }
    let newSlug = p.slug;
    if (dto.slug?.trim() && dto.slug.trim() !== p.slug) newSlug = await this.uniqueSlug(dto.slug, p.id);
    if (newSlug !== p.slug) data.slug = newSlug;
    if (dto.media) {
      data.media = {
        deleteMany: {},
        create: dto.media.map((m) => ({ url: m.url, altText: m.altText ?? null, kind: m.kind ?? 'IMAGE', sortOrder: m.sortOrder ?? 0 })),
      };
    }
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.product.update({ where: { id: p.id }, data, ...WITH_DETAIL });
      if (updated.reviewNote) {
        await tx.product.update({ where: { id: p.id }, data: { reviewNote: null } });
      }
      return publicProduct(await tx.product.findUniqueOrThrow({ where: { id: p.id }, ...WITH_DETAIL }));
    });
  }

  async submitForReview(userId: string, productId: string) {
    const p = await this.loadOwnedProduct(userId, productId);
    if (p.status !== ProductStatus.DRAFT && p.status !== ProductStatus.REJECTED) {
      throw new ConflictException('Only a DRAFT or REJECTED product can be submitted for review');
    }
    return this.prisma.$transaction(async (tx) => {
      await tx.product.update({
        where: { id: p.id },
        data: { status: ProductStatus.PENDING_REVIEW, visibility: VisibilityStatus.HIDDEN, reviewNote: null },
      });
      await this.recordHistory(tx, p.id, p.status, ProductStatus.PENDING_REVIEW, 'SELLER', userId, 'submitted for review');
      return publicProduct(await tx.product.findUniqueOrThrow({ where: { id: p.id }, ...WITH_DETAIL }));
    });
  }

  async archiveMine(userId: string, productId: string) {
    const p = await this.loadOwnedProduct(userId, productId);
    if (p.status !== ProductStatus.DRAFT && p.status !== ProductStatus.REJECTED && p.status !== ProductStatus.PENDING_REVIEW) {
      throw new ConflictException('Only a non-published product can be archived by its seller');
    }
    return this.prisma.$transaction(async (tx) => {
      await tx.product.update({
        where: { id: p.id },
        data: { status: ProductStatus.ARCHIVED, visibility: VisibilityStatus.HIDDEN, publishedAt: null },
      });
      await this.recordHistory(tx, p.id, p.status, ProductStatus.ARCHIVED, 'SELLER', userId, 'archived by seller');
      return publicProduct(await tx.product.findUniqueOrThrow({ where: { id: p.id }, ...WITH_DETAIL }));
    });
  }

  // ================= staff catalog publishing (OPERATOR/ADMIN) =================

  async listForReview(status?: string) {
    const rows = await this.prisma.product.findMany({
      where: { deletedAt: null, ...(status ? { status: status as ProductStatus } : { status: ProductStatus.PENDING_REVIEW }) },
      include: { seller: { select: { id: true, sellerCode: true, displayName: true } }, category: { select: { id: true, name: true } } },
      orderBy: { updatedAt: 'desc' },
    });
    return rows.map((p: any) => publicProduct({ ...p, media: [], statusHistory: [] }));
  }

  async reviewDetail(productId: string) {
    const p = await this.prisma.product.findUnique({ where: { id: productId }, include: WITH_DETAIL.include });
    if (!p || p.deletedAt) throw new NotFoundException('Product not found');
    return publicProduct(p);
  }

  async approve(actorId: string, productId: string, note?: string) {
    const actorRole = await this.staffRole(actorId);
    const p = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!p || p.deletedAt) throw new NotFoundException('Product not found');
    if (p.status !== ProductStatus.PENDING_REVIEW) {
      throw new ConflictException('Only a PENDING_REVIEW product can be approved');
    }
    return this.prisma.$transaction(async (tx) => {
      await tx.product.update({
        where: { id: p.id },
        data: {
          status: ProductStatus.APPROVED,
          visibility: VisibilityStatus.LIVE,
          publishedAt: new Date(),
          reviewNote: note?.trim() || null,
        },
      });
      await this.recordHistory(tx, p.id, p.status, ProductStatus.APPROVED, actorRole, actorId, note?.trim() || 'approved & published');
      return publicProduct(await tx.product.findUniqueOrThrow({ where: { id: p.id }, ...WITH_DETAIL }));
    });
  }

  async reject(actorId: string, productId: string, reason: string) {
    const actorRole = await this.staffRole(actorId);
    const p = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!p || p.deletedAt) throw new NotFoundException('Product not found');
    if (p.status !== ProductStatus.PENDING_REVIEW) {
      throw new ConflictException('Only a PENDING_REVIEW product can be rejected');
    }
    return this.prisma.$transaction(async (tx) => {
      await tx.product.update({
        where: { id: p.id },
        data: { status: ProductStatus.REJECTED, visibility: VisibilityStatus.HIDDEN, publishedAt: null, reviewNote: reason },
      });
      await this.recordHistory(tx, p.id, p.status, ProductStatus.REJECTED, actorRole, actorId, reason);
      return publicProduct(await tx.product.findUniqueOrThrow({ where: { id: p.id }, ...WITH_DETAIL }));
    });
  }
}
