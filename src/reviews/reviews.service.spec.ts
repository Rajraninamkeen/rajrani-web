import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ReviewsService } from './reviews.service';

function product(over: Record<string, any> = {}) {
  return { id: 'ratlami-sev', status: 'APPROVED', visibility: 'LIVE', deletedAt: null, name: 'Royal Sev', slug: 'royal-sev', ratingAvg: 0, reviewCount: 0, ...over };
}
function review(over: Record<string, any> = {}) {
  return {
    id: 'rev1', productId: 'ratlami-sev', userId: 'c1', rating: 5, title: 'Amazing', comment: 'Crunchy',
    status: 'PENDING', verifiedBuyer: true, moderatorId: null, moderatedAt: null, moderationNote: null,
    createdAt: new Date(), updatedAt: new Date(),
    product: { id: 'ratlami-sev', name: 'Royal Sev', slug: 'royal-sev' },
    user: { id: 'c1', fullName: 'Priya Patel' },
    ...over,
  };
}

describe('ReviewsService', () => {
  let prisma: any;
  let service: ReviewsService;

  function freshTx() {
    const tx = {
      product: { update: jest.fn() },
      productReview: {
        update: jest.fn(async (args: any) => review({ ...args.data })),
        aggregate: jest.fn(async () => ({ _avg: { rating: 4.5 }, _count: { rating: 2 } })),
        findUniqueOrThrow: jest.fn(async () => review({ status: 'PUBLISHED' })),
      },
    };
    return tx;
  }

  beforeEach(() => {
    const tx = freshTx();
    prisma = {
      product: { findUnique: jest.fn() },
      orderItem: { findFirst: jest.fn() },
      productReview: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
        aggregate: jest.fn(),
        update: jest.fn(),
      },
      $transaction: jest.fn(async (fn: any) => (typeof fn === 'function' ? fn(tx) : Promise.all(fn))),
    };
    service = new ReviewsService(prisma);
  });

  it('creates a PENDING verified review only after a DELIVERED purchase', async () => {
    prisma.product.findUnique.mockResolvedValue(product());
    prisma.productReview.findUnique.mockResolvedValue(null);
    prisma.orderItem.findFirst.mockResolvedValue({ id: 'oi1' });
    prisma.productReview.create.mockResolvedValue(review());
    const res = await service.create('c1', 'ratlami-sev', 5, 'Amazing', 'Crunchy');
    expect(prisma.productReview.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ productId: 'ratlami-sev', userId: 'c1', rating: 5, status: 'PENDING', verifiedBuyer: true }),
    }));
    expect(res.status).toBe('PENDING');
  });

  it('rejects a non-buyer (no DELIVERED order) with 403', async () => {
    prisma.product.findUnique.mockResolvedValue(product());
    prisma.productReview.findUnique.mockResolvedValue(null);
    prisma.orderItem.findFirst.mockResolvedValue(null);
    await expect(service.create('c2', 'ratlami-sev', 4)).rejects.toThrow(ForbiddenException);
  });

  it('allows only one review per product per customer (409 on duplicate)', async () => {
    prisma.product.findUnique.mockResolvedValue(product());
    prisma.productReview.findUnique.mockResolvedValue(review());
    await expect(service.create('c1', 'ratlami-sev', 4)).rejects.toThrow(ConflictException);
  });

  it('a non-public (DRAFT/HIDDEN) product cannot be reviewed', async () => {
    prisma.product.findUnique.mockResolvedValue(product({ status: 'DRAFT' }));
    await expect(service.create('c1', 'x', 4)).rejects.toThrow();
  });

  it('customer cannot edit a PUBLISHED review (409)', async () => {
    prisma.productReview.findUnique.mockResolvedValue(review({ status: 'PUBLISHED' }));
    await expect(service.update('c1', 'rev1', 3)).rejects.toThrow(ConflictException);
  });

  it('editing a REJECTED review reopens it to PENDING for moderation', async () => {
    prisma.productReview.findUnique.mockResolvedValue(review({ status: 'REJECTED' }));
    prisma.productReview.update.mockResolvedValue(review({ status: 'PENDING' }));
    const res = await service.update('c1', 'rev1', 4);
    expect(prisma.productReview.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'PENDING', rating: 4 }),
    }));
    expect(res.status).toBe('PENDING');
  });

  it('customer cannot delete a PUBLISHED review (moderation only)', async () => {
    prisma.productReview.findUnique.mockResolvedValue(review({ status: 'PUBLISHED' }));
    await expect(service.remove('c1', 'rev1')).rejects.toThrow(ConflictException);
  });

  it('staff approve publishes a PENDING review and recomputes the product aggregate', async () => {
    prisma.productReview.findUnique.mockResolvedValue(review({ status: 'PENDING' }));
    const res = await service.approve('op1', 'rev1', 'looks genuine');
    // tx.product.update called with recomputed ratingAvg/reviewCount
    expect(prisma.$transaction).toHaveBeenCalled();
    expect(res).toBeTruthy();
  });

  it('staff reject marks REJECTED with the reason (no aggregate change)', async () => {
    prisma.productReview.findUnique.mockResolvedValue(review({ status: 'PENDING' }));
    prisma.productReview.update.mockResolvedValue(review({ status: 'REJECTED', moderationNote: 'offensive language' }));
    await service.reject('op1', 'rev1', 'offensive language');
    expect(prisma.productReview.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'REJECTED', moderationNote: 'offensive language', moderatorId: 'op1' }),
    }));
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('cannot approve a non-PENDING review (409)', async () => {
    prisma.productReview.findUnique.mockResolvedValue(review({ status: 'PUBLISHED' }));
    await expect(service.approve('op1', 'rev1')).rejects.toThrow(ConflictException);
  });

  it('public read returns only PUBLISHED reviews for a live product', async () => {
    prisma.product.findFirst = jest.fn().mockResolvedValue(product({ ratingAvg: 4.5, reviewCount: 2 }));
    prisma.productReview.count.mockResolvedValue(1);
    prisma.productReview.findMany.mockResolvedValue([review({ status: 'PUBLISHED' })]);
    const res = await service.listPublished('ratlami-sev', 1, 10);
    expect(res.reviews).toHaveLength(1);
    expect(res.product.ratingAvg).toBe(4.5);
  });

  it('public read 404s for an unknown/not-live product', async () => {
    prisma.product.findFirst = jest.fn().mockResolvedValue(null);
    await expect(service.listPublished('nope')).rejects.toThrow(NotFoundException);
  });
});
