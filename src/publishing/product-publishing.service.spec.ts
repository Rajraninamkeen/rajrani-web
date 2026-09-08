import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ProductPublishingService } from './product-publishing.service';

const dec = (n: number) => ({ toNumber: () => n });

function user(over: Record<string, any> = {}) {
  return { id: 'u1', role: 'SELLER', sellerId: 'sel1', ...over };
}
function product(over: Record<string, any> = {}) {
  return {
    id: 'prod1',
    name: 'Test Sev',
    slug: 'test-sev',
    tagline: null,
    description: null,
    brand: 'Brand',
    regionOrigin: null,
    status: 'DRAFT',
    visibility: 'HIDDEN',
    categoryId: 'cat1',
    category: { id: 'cat1', name: 'Snacks', slug: 'snacks' },
    sellerId: 'sel1',
    basePrice: dec(100),
    originalPrice: null,
    weightLabel: null,
    spiceLevel: null,
    ingredients: [],
    nutritional: null,
    pairingSuggestion: null,
    isBestseller: false,
    isNew: false,
    stockStatus: 'OUT_OF_STOCK',
    stockOnHand: 0,
    ratingAvg: 0,
    reviewCount: 0,
    reviewNote: null,
    publishedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    media: [],
    statusHistory: [],
    ...over,
  };
}

describe('ProductPublishingService', () => {
  let prisma: any;
  let tx: any;
  let service: ProductPublishingService;

  function freshTx() {
    tx = {
      product: {
        create: jest.fn(async (args: any) => product({ ...args.data, id: 'prodN', slug: args.data.slug })),
        update: jest.fn(async (args: any) => product({ ...args.data })),
        findUniqueOrThrow: jest.fn(async () => product()),
      },
      productStatusHistory: { create: jest.fn() },
    };
  }

  beforeEach(() => {
    freshTx();
    prisma = {
      user: { findUnique: jest.fn() },
      seller: { findFirst: jest.fn() },
      category: { findUnique: jest.fn() },
      product: { findUnique: jest.fn(), findMany: jest.fn() },
      $transaction: jest.fn((fn: any) => fn(tx)),
    };
    service = new ProductPublishingService(prisma);
  });

  it('creates a DRAFT product scoped to the seller and records the DRAFT history', async () => {
    prisma.user.findUnique.mockResolvedValue(user());
    prisma.seller.findFirst.mockResolvedValue({ id: 'sel1', status: 'ACTIVE' });
    prisma.category.findUnique.mockResolvedValue({ id: 'cat1', status: 'ACTIVE', deletedAt: null });
    prisma.product.findUnique.mockResolvedValue(null); // slug free
    const res = await service.createDraft('u1', { name: 'New Sev', categoryId: 'cat1', basePrice: 99.5 } as any);
    const createData = tx.product.create.mock.calls[0][0].data;
    expect(createData).toMatchObject({ status: 'DRAFT', visibility: 'HIDDEN', sellerId: 'sel1', slug: 'new-sev' });
    expect(tx.productStatusHistory.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ toStatus: 'DRAFT', actorRole: 'SELLER' }) }));
    expect(res.status).toBe('DRAFT');
  });

  it('blocks a non-seller from authoring', async () => {
    prisma.user.findUnique.mockResolvedValue(user({ role: 'CUSTOMER' }));
    await expect(service.createDraft('u1', { name: 'x', categoryId: 'cat1', basePrice: 1 } as any)).rejects.toThrow(ForbiddenException);
  });

  it('only allows submit from DRAFT or REJECTED (409 otherwise)', async () => {
    prisma.user.findUnique.mockResolvedValue(user());
    prisma.seller.findFirst.mockResolvedValue({ id: 'sel1', status: 'ACTIVE' });
    prisma.product.findUnique.mockResolvedValue(product({ status: 'APPROVED' }));
    await expect(service.submitForReview('u1', 'prod1')).rejects.toThrow(ConflictException);
  });

  it('seller cannot read/edit another seller product (404)', async () => {
    prisma.user.findUnique.mockResolvedValue(user({ sellerId: 'other' }));
    prisma.seller.findFirst.mockResolvedValue({ id: 'other', status: 'ACTIVE' });
    prisma.product.findUnique.mockResolvedValue(product({ sellerId: 'sel1' }));
    await expect(service.getMyProduct('u1', 'prod1')).rejects.toThrow(NotFoundException);
  });

  it('staff approve a PENDING_REVIEW product -> APPROVED + LIVE + publishedAt + audit with the actor role', async () => {
    prisma.user.findUnique.mockResolvedValue(user({ id: 'op1', role: 'OPERATOR', sellerId: null }));
    prisma.product.findUnique.mockResolvedValue(product({ status: 'PENDING_REVIEW', sellerId: 'sel1' }));
    await service.approve('op1', 'prod1', 'looks good');
    const upd = tx.product.update.mock.calls[0][0].data;
    expect(upd).toMatchObject({ status: 'APPROVED', visibility: 'LIVE', reviewNote: 'looks good' });
    expect(upd.publishedAt).toBeInstanceOf(Date);
    expect(tx.productStatusHistory.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ toStatus: 'APPROVED', actorRole: 'OPERATOR', reason: 'looks good' }) }));
  });

  it('staff reject a PENDING_REVIEW product -> REJECTED + HIDDEN with the reason', async () => {
    prisma.user.findUnique.mockResolvedValue(user({ id: 'op1', role: 'ADMIN', sellerId: null }));
    prisma.product.findUnique.mockResolvedValue(product({ status: 'PENDING_REVIEW' }));
    await service.reject('op1', 'prod1', 'price too high');
    const upd = tx.product.update.mock.calls[0][0].data;
    expect(upd).toMatchObject({ status: 'REJECTED', visibility: 'HIDDEN', reviewNote: 'price too high' });
    expect(tx.productStatusHistory.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ toStatus: 'REJECTED', actorRole: 'ADMIN' }) }));
  });

  it('non-staff (CUSTOMER/SELLER) cannot approve', async () => {
    prisma.user.findUnique.mockResolvedValue(user({ id: 'op1', role: 'SELLER', sellerId: 'sel1' }));
    await expect(service.approve('op1', 'prod1')).rejects.toThrow(ForbiddenException);
  });

  it('cannot approve an already-APPROVED product (409)', async () => {
    prisma.user.findUnique.mockResolvedValue(user({ id: 'op1', role: 'OPERATOR', sellerId: null }));
    prisma.product.findUnique.mockResolvedValue(product({ status: 'APPROVED' }));
    await expect(service.approve('op1', 'prod1')).rejects.toThrow(ConflictException);
  });
});
