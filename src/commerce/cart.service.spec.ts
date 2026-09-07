import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CartService } from './cart.service';

function dec(n: number) {
  return { toNumber: () => n, lt: (b: { toNumber(): number }) => n < b.toNumber() };
}

function liveProduct(id: string, price: number, stock: number) {
  return {
    id,
    name: id,
    status: 'APPROVED',
    visibility: 'LIVE',
    deletedAt: null,
    basePrice: dec(price),
    stockOnHand: stock,
  };
}

describe('CartService', () => {
  let prisma: any;
  let service: CartService;

  function mockProduct(id: string, price: number, stock: number) {
    return liveProduct(id, price, stock);
  }

  beforeEach(() => {
    prisma = {
      cart: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(async (a: any) => ({ id: 'new-cart', ...a.data })),
        update: jest.fn(),
      },
      cartItem: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        deleteMany: jest.fn(),
        upsert: jest.fn(),
      },
      product: { findFirst: jest.fn() },
    };
    service = new CartService(prisma);
  });

  it('creates a fresh guest cart when a guest session has none yet', async () => {
    prisma.cart.findUnique.mockResolvedValue(null);
    prisma.cartItem.findMany.mockResolvedValue([]);
    prisma.cart.create.mockResolvedValue({ id: 'g1', guestSessionId: 'g-sess', status: 'ACTIVE' });

    const result = await service.get({ guestSessionId: 'g-sess' });
    expect(result.cartId).toBe('g1');
    expect(prisma.cart.create).toHaveBeenCalled();
  });

  it('rejects adding a product that is not purchasable', async () => {
    prisma.cart.findUnique.mockResolvedValue({ id: 'g1', guestSessionId: 'g-sess', status: 'ACTIVE' });
    prisma.product.findFirst.mockResolvedValue(null); // e.g. DRAFT / hidden
    await expect(
      service.addItem({ guestSessionId: 'g-sess' }, { productId: 'p1', quantity: 1 }),
    ).rejects.toThrow(NotFoundException);
  });

  it('rejects adding more than available stock (does not trust client qty)', async () => {
    prisma.cart.findUnique.mockResolvedValue({ id: 'g1', guestSessionId: 'g-sess', status: 'ACTIVE' });
    prisma.product.findFirst.mockResolvedValue(mockProduct('p1', 100, 3));
    prisma.cartItem.findUnique.mockResolvedValue(null); // no existing line
    await expect(
      service.addItem({ guestSessionId: 'g-sess' }, { productId: 'p1', quantity: 5 }),
    ).rejects.toThrow(BadRequestException);
  });

  it('recomputes subtotal from DB price when reading the cart', async () => {
    prisma.cart.findUnique.mockResolvedValue({ id: 'g1', guestSessionId: 'g-sess', status: 'ACTIVE' });
    prisma.cartItem.findMany.mockResolvedValue([
      { id: 'i1', quantity: 2, product: { ...mockProduct('p1', 100, 50), media: [{ url: 'a.jpg' }] } },
      { id: 'i2', quantity: 3, product: { ...mockProduct('p2', 40, 50), media: [] } },
    ]);
    const result = await service.get({ guestSessionId: 'g-sess' });
    expect(result.subtotal).toBe(2 * 100 + 3 * 40); // 320, not trusting any client value
    expect(result.itemCount).toBe(2);
    expect(result.items[0].image).toBe('a.jpg');
  });

  it('drops a product that became unavailable from the public cart read', async () => {
    prisma.cart.findUnique.mockResolvedValue({ id: 'g1', guestSessionId: 'g-sess', status: 'ACTIVE' });
    prisma.cartItem.findMany.mockResolvedValue([
      { id: 'i1', quantity: 2, product: { ...mockProduct('p1', 100, 50), status: 'DRAFT' } },
      { id: 'i2', quantity: 1, product: { ...mockProduct('p2', 40, 50), media: [] } },
    ]);
    const result = await service.get({ guestSessionId: 'g-sess' });
    expect(result.itemCount).toBe(1);
    expect(result.subtotal).toBe(40);
  });
});
