import { NotFoundException } from '@nestjs/common';
import { CatalogService } from './catalog.service';

describe('CatalogService', () => {
  // Minimal Prisma.Decimal look-alike that supports the chained ops used by mapProduct.
  function dec(value: number): unknown {
    const minus = (b: { toNumber: () => number }) =>
      dec(value - b.toNumber());
    const div = (b: { toNumber: () => number }) =>
      dec(value / b.toNumber());
    const mul = (f: number) => dec(value * f);
    return {
      toNumber: () => value,
      gt: (b: { toNumber: () => number }) => value > b.toNumber(),
      minus,
      div,
      mul,
    };
  }

  // Stand-in for a prisma row (includes relations we map).
  function row(overrides: Record<string, unknown> = {}) {
    return {
      id: 'p1',
      slug: 'bilokat-royal-ratlami-sev',
      name: 'Bilokat Royal Ratlami Sev',
      tagline: 'tagline',
      description: 'desc',
      basePrice: dec(189),
      originalPrice: dec(240),
      weightLabel: '400g Zip-Pouch',
      ratingAvg: 4.9,
      reviewCount: 3820,
      stockOnHand: 12,
      isBestseller: true,
      isNew: false,
      regionOrigin: 'Ratlam',
      ingredients: ['a', 'b'],
      nutritional: { calories: '162' },
      spiceLevel: 'FIERY',
      pairingSuggestion: 'with tea',
      customerFavTag: '#1',
      status: 'APPROVED',
      visibility: 'LIVE',
      deletedAt: null,
      category: { slug: 'spicy' },
      media: [{ url: 'https://x/img.jpg' }],
      ...overrides,
    };
  }

  let prisma: { product: { findFirst: jest.Mock } };
  let service: CatalogService;

  beforeEach(() => {
    prisma = { product: { findFirst: jest.fn() } };
    service = new CatalogService(prisma as never);
  });

  it('maps a product row into the public landing shape', async () => {
    prisma.product.findFirst.mockResolvedValue(row());
    const result = await service.getProductByIdentifier('bilokat-royal-ratlami-sev');

    expect(result.name).toBe('Bilokat Royal Ratlami Sev');
    expect(result.price).toBe(189);
    expect(result.discountPercent).toBe(21);
    expect(result.spiceLevel).toBe(4); // FIERY -> 4
    expect(result.category).toBe('spicy');
    expect(result.image).toBe('https://x/img.jpg');
    expect(result.inStock).toBe(true);
  });

  it('does not leak non-public fields', async () => {
    prisma.product.findFirst.mockResolvedValue(row());
    const result = await service.getProductByIdentifier('bilokat-royal-ratlami-sev');
    const keys = Object.keys(result);
    expect(keys).not.toContain('passwordHash');
    expect(keys).not.toContain('status');
    expect(keys).not.toContain('visibility');
  });

  it('throws NotFoundException when the product is missing', async () => {
    prisma.product.findFirst.mockResolvedValue(null);
    await expect(service.getProductByIdentifier('missing')).rejects.toThrow(NotFoundException);
  });
});
