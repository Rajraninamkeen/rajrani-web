// Bilokat local development seed (fixtures only — never used as production data).
// Populates categories + products that mirror the landing-page catalog so the
// public API can serve the SAME data the frontend currently hardcodes.
import { PrismaClient, Prisma, ProductStatus, VisibilityStatus, SpiceLevel, StockStatus } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { SEED_CATEGORIES, SEED_PRODUCTS } from './catalog-seed';

// Prisma ORM 7 requires a driver adapter for the connection.
const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString:
      process.env.DATABASE_URL ??
      'postgresql://bilokat:bilokat_dev@localhost:5432/bilokat',
  }),
});

const NUM_TO_SPICE: Record<number, SpiceLevel> = {
  1: 'MILD',
  2: 'MEDIUM',
  3: 'SPICY',
  4: 'FIERY',
};

async function main(): Promise<void> {
  console.log('Seeding catalog...');

  // Upsert dev coupons (fixtures only)
  const coupons = [
    { code: 'BILOKAT20', type: 'PERCENTAGE', value: 20, minOrderValue: 299, maxDiscount: 150, validForDays: 365 },
    { code: 'FLAT50', type: 'FIXED_AMOUNT', value: 50, minOrderValue: 199, maxDiscount: null, validForDays: 365 },
    { code: 'SAVE10', type: 'PERCENTAGE', value: 10, minOrderValue: null, maxDiscount: 60, validForDays: 365 },
  ];
  for (const c of coupons) {
    await prisma.coupon.upsert({
      where: { code: c.code },
      update: {
        type: c.type,
        value: c.value,
        minOrderValue: c.minOrderValue,
        maxDiscount: c.maxDiscount,
        status: 'ACTIVE',
        validFrom: new Date(Date.now() - 1 * 86400000),
        validTo: new Date(Date.now() + c.validForDays * 86400000),
      },
      create: {
        code: c.code,
        type: c.type,
        value: c.value,
        minOrderValue: c.minOrderValue,
        maxDiscount: c.maxDiscount,
        status: 'ACTIVE',
        validFrom: new Date(Date.now() - 1 * 86400000),
        validTo: new Date(Date.now() + c.validForDays * 86400000),
      },
    });
  }
  console.log('  ✓ coupons');

  // Upsert categories
  const catMap: Record<string, string> = {};
  for (const c of SEED_CATEGORIES) {
    const row = await prisma.category.upsert({
      where: { slug: c.slug },
      update: { name: c.name, description: c.description, status: 'ACTIVE' },
      create: {
        name: c.name,
        slug: c.slug,
        description: c.description,
        status: 'ACTIVE',
      },
    });
    catMap[c.slug] = row.id;
  }

  // Upsert products + one primary media item each
  for (const p of SEED_PRODUCTS) {
    const categoryId = catMap[p.category];
    const product = await prisma.product.upsert({
      where: { slug: p.slug },
      update: {
        name: p.name,
        tagline: p.tagline,
        description: p.description,
        categoryId,
        regionOrigin: p.regionOrigin,
        basePrice: p.price,
        originalPrice: p.originalPrice,
        weightLabel: p.weight,
        spiceLevel: NUM_TO_SPICE[p.spiceLevel],
        ingredients: p.ingredients,
        nutritional: p.nutritional as unknown as Prisma.InputJsonValue,
        ratingAvg: p.rating,
        reviewCount: p.reviewCount,
        stockOnHand: p.stockLeft,
        stockStatus: p.stockLeft > 20 ? 'IN_STOCK' : p.stockLeft > 0 ? 'LOW_STOCK' : 'OUT_OF_STOCK',
        isBestseller: !!p.isBestseller,
        isNew: !!p.isNew,
        pairingSuggestion: p.pairingSuggestion,
        customerFavTag: p.customerFavTag,
        status: ProductStatus.APPROVED,
        visibility: VisibilityStatus.LIVE,
        publishedAt: new Date(),
        deletedAt: null,
      },
      create: {
        id: p.id,
        slug: p.slug,
        name: p.name,
        tagline: p.tagline,
        description: p.description,
        categoryId,
        regionOrigin: p.regionOrigin,
        basePrice: p.price,
        originalPrice: p.originalPrice,
        weightLabel: p.weight,
        spiceLevel: NUM_TO_SPICE[p.spiceLevel],
        ingredients: p.ingredients,
        nutritional: p.nutritional as unknown as Prisma.InputJsonValue,
        ratingAvg: p.rating,
        reviewCount: p.reviewCount,
        stockOnHand: p.stockLeft,
        stockStatus: p.stockLeft > 20 ? StockStatus.IN_STOCK : p.stockLeft > 0 ? StockStatus.LOW_STOCK : StockStatus.OUT_OF_STOCK,
        isBestseller: !!p.isBestseller,
        isNew: !!p.isNew,
        pairingSuggestion: p.pairingSuggestion,
        customerFavTag: p.customerFavTag,
        status: ProductStatus.APPROVED,
        visibility: VisibilityStatus.LIVE,
        publishedAt: new Date(),
        media: {
          create: [{ url: p.image, altText: p.name, kind: 'IMAGE', sortOrder: 0 }],
        },
      },
    });
    console.log(`  ✓ ${product.name}`);
  }

  const [products, categories] = await Promise.all([
    prisma.product.count(),
    prisma.category.count(),
  ]);
  console.log(`Done. ${categories} categories, ${products} products.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
