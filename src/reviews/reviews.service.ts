import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, ReviewStatus } from '../generated/prisma/client';

const REVIEW_INCLUDE = {
  product: { select: { id: true, name: true, slug: true } },
  user: { select: { id: true, fullName: true } },
} as const;

/** Prisma types for a review row + relation include. */
type ReviewRow = Prisma.ProductReviewGetPayload<{ include: typeof REVIEW_INCLUDE }>;

function authorName(user: { fullName?: string | null; email?: string }): string {
  if (user.fullName && user.fullName.trim()) {
    const parts = user.fullName.trim().split(/\s+/);
    if (parts.length === 1) return parts[0];
    return `${parts[0]} ${parts[parts.length - 1][0] ?? ''}`.trim();
  }
  return 'Verified customer';
}

function toDto(r: ReviewRow) {
  return {
    id: r.id,
    product: r.product,
    rating: r.rating,
    title: r.title,
    comment: r.comment,
    status: r.status,
    verifiedBuyer: r.verifiedBuyer,
    author: {
      id: r.user.id,
      name: authorName(r.user),
    },
    moderatorId: r.moderatorId,
    moderationNote: r.moderationNote,
    moderatedAt: r.moderatedAt ? r.moderatedAt.toISOString() : null,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

@Injectable()
export class ReviewsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Recompute Product.ratingAvg/reviewCount from PUBLISHED (visible) reviews, inside the caller's tx. */
  private async recomputeAggregate(tx: Prisma.TransactionClient, productId: string): Promise<void> {
    const agg = await tx.productReview.aggregate({
      where: { productId, status: ReviewStatus.PUBLISHED },
      _avg: { rating: true },
      _count: { rating: true },
    });
    await tx.product.update({
      where: { id: productId },
      data: {
        ratingAvg: agg._avg.rating ?? 0,
        reviewCount: agg._count.rating ?? 0,
      },
    });
  }

  private async assertReviewableProduct(productId: string): Promise<void> {
    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!product || product.deletedAt) throw new NotFoundException('Product not found');
    if (product.status !== 'APPROVED' || product.visibility !== 'LIVE') {
      throw new BadRequestException('This product is not available to review');
    }
  }

  // ================= public read (only PUBLISHED, on a LIVE product) =================

  async listPublished(identifier: string, page = 1, limit = 10) {
    const pPage = Math.max(1, page);
    const pLimit = Math.min(Math.max(1, limit), 50);
    const product = await this.prisma.product.findFirst({
      where: { OR: [{ id: identifier }, { slug: identifier }], status: 'APPROVED', visibility: 'LIVE', deletedAt: null },
      select: { id: true, name: true, slug: true, ratingAvg: true, reviewCount: true },
    });
    if (!product) throw new NotFoundException('Product not found');
    const [total, reviews] = await this.prisma.$transaction([
      this.prisma.productReview.count({ where: { productId: product.id, status: ReviewStatus.PUBLISHED } }),
      this.prisma.productReview.findMany({
        where: { productId: product.id, status: ReviewStatus.PUBLISHED },
        include: { user: { select: { id: true, fullName: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (pPage - 1) * pLimit,
        take: pLimit,
      }),
    ]);
    return {
      product: { id: product.id, name: product.name, slug: product.slug, ratingAvg: product.ratingAvg, reviewCount: product.reviewCount },
      reviews: reviews.map((r) => ({
        id: r.id,
        rating: r.rating,
        title: r.title,
        comment: r.comment,
        verifiedBuyer: r.verifiedBuyer,
        author: { id: r.user.id, name: authorName(r.user) },
        createdAt: r.createdAt.toISOString(),
      })),
      page: pPage,
      limit: pLimit,
      total,
      totalPages: Math.ceil(total / pLimit),
    };
  }

  // ================= customer authoring =================

  async create(userId: string, productId: string, rating: number, title?: string, comment?: string) {
    await this.assertReviewableProduct(productId);
    const existing = await this.prisma.productReview.findUnique({
      where: { productId_userId: { productId, userId } },
    });
    if (existing) throw new ConflictException('You have already reviewed this product');

    // Verified purchase: the reviewer must have received this product on a DELIVERED order.
    const purchased = await this.prisma.orderItem.findFirst({
      where: { productId, order: { userId, status: 'DELIVERED' } },
      select: { id: true },
    });
    if (!purchased) throw new ForbiddenException('Only verified buyers of this product can review it');

    const review = await this.prisma.productReview.create({
      data: { productId, userId, rating, title: title?.trim() || null, comment: comment?.trim() || null, status: ReviewStatus.PENDING, verifiedBuyer: true },
      include: REVIEW_INCLUDE,
    });
    return toDto(review);
  }

  async listMine(userId: string, status?: string) {
    const rows = await this.prisma.productReview.findMany({
      where: { userId, ...(status ? { status: status as ReviewStatus } : {}) },
      include: REVIEW_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(toDto);
  }

  async getOwn(userId: string, reviewId: string) {
    const r = await this.prisma.productReview.findUnique({ where: { id: reviewId }, include: REVIEW_INCLUDE });
    if (!r || r.userId !== userId) throw new NotFoundException('Review not found');
    return toDto(r);
  }

  async update(userId: string, reviewId: string, rating?: number, title?: string, comment?: string) {
    const r = await this.prisma.productReview.findUnique({ where: { id: reviewId } });
    if (!r || r.userId !== userId) throw new NotFoundException('Review not found');
    if (r.status === ReviewStatus.PUBLISHED) {
      throw new ConflictException('Published reviews cannot be edited directly; contact support for changes');
    }
    // A REJECTED/HIDDEN review may be corrected and resubmitted for moderation.
    const reopened = r.status === ReviewStatus.REJECTED || r.status === ReviewStatus.HIDDEN;
    const review = await this.prisma.productReview.update({
      where: { id: reviewId },
      data: {
        rating: rating ?? r.rating,
        title: title !== undefined ? (title?.trim() || null) : r.title,
        comment: comment !== undefined ? (comment?.trim() || null) : r.comment,
        ...(reopened ? { status: ReviewStatus.PENDING, moderatorId: null, moderatedAt: null, moderationNote: null } : {}),
      },
      include: REVIEW_INCLUDE,
    });
    return toDto(review);
  }

  async remove(userId: string, reviewId: string) {
    const r = await this.prisma.productReview.findUnique({ where: { id: reviewId } });
    if (!r || r.userId !== userId) throw new NotFoundException('Review not found');
    if (r.status === ReviewStatus.PUBLISHED) {
      throw new ConflictException('Published reviews must be removed by moderation');
    }
    await this.prisma.productReview.delete({ where: { id: reviewId } });
    return { id: reviewId, deleted: true };
  }

  // ================= staff moderation (OPERATOR/ADMIN) =================

  private async loadForModeration(reviewId: string) {
    const r = await this.prisma.productReview.findUnique({
      where: { id: reviewId },
      include: { ...REVIEW_INCLUDE, product: { select: { id: true, name: true, slug: true } } },
    });
    if (!r) throw new NotFoundException('Review not found');
    return r;
  }

  async moderationList(status?: string) {
    const rows = await this.prisma.productReview.findMany({
      where: { ...(status ? { status: status as ReviewStatus } : { status: ReviewStatus.PENDING }) },
      include: REVIEW_INCLUDE,
      orderBy: { createdAt: 'asc' },
    });
    return rows.map(toDto);
  }

  async moderationDetail(reviewId: string) {
    return toDto(await this.loadForModeration(reviewId));
  }

  async approve(actorId: string, reviewId: string, note?: string) {
    const r = await this.loadForModeration(reviewId);
    if (r.status !== ReviewStatus.PENDING) throw new ConflictException('Only a PENDING review can be approved');
    return this.prisma.$transaction(async (tx) => {
      await tx.productReview.update({
        where: { id: reviewId },
        data: { status: ReviewStatus.PUBLISHED, moderatorId: actorId, moderatedAt: new Date(), moderationNote: note?.trim() || null },
      });
      await this.recomputeAggregate(tx, r.productId);
      return toDto(await tx.productReview.findUniqueOrThrow({ where: { id: reviewId }, include: REVIEW_INCLUDE }));
    });
  }

  async reject(actorId: string, reviewId: string, reason: string) {
    const r = await this.loadForModeration(reviewId);
    if (r.status !== ReviewStatus.PENDING) throw new ConflictException('Only a PENDING review can be rejected');
    // Rejecting a never-published PENDING review does not change the published
    // aggregate, so the product rating summary is left untouched.
    const review = await this.prisma.productReview.update({
      where: { id: reviewId },
      data: { status: ReviewStatus.REJECTED, moderatorId: actorId, moderatedAt: new Date(), moderationNote: reason },
      include: REVIEW_INCLUDE,
    });
    return toDto(review);
  }

  async hide(actorId: string, reviewId: string, note?: string) {
    const r = await this.loadForModeration(reviewId);
    if (r.status !== ReviewStatus.PUBLISHED) throw new ConflictException('Only a PUBLISHED review can be hidden');
    return this.prisma.$transaction(async (tx) => {
      await tx.productReview.update({
        where: { id: reviewId },
        data: { status: ReviewStatus.HIDDEN, moderatorId: actorId, moderatedAt: new Date(), moderationNote: note?.trim() || null },
      });
      await this.recomputeAggregate(tx, r.productId);
      return toDto(await tx.productReview.findUniqueOrThrow({ where: { id: reviewId }, include: REVIEW_INCLUDE }));
    });
  }

  async unhide(actorId: string, reviewId: string, note?: string) {
    const r = await this.loadForModeration(reviewId);
    if (r.status !== ReviewStatus.HIDDEN) throw new ConflictException('Only a HIDDEN review can be unhidden');
    return this.prisma.$transaction(async (tx) => {
      await tx.productReview.update({
        where: { id: reviewId },
        data: { status: ReviewStatus.PUBLISHED, moderatorId: actorId, moderatedAt: new Date(), moderationNote: note?.trim() || null },
      });
      await this.recomputeAggregate(tx, r.productId);
      return toDto(await tx.productReview.findUniqueOrThrow({ where: { id: reviewId }, include: REVIEW_INCLUDE }));
    });
  }
}
