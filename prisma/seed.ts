// Bilokat local development seed (fixtures only — never used as production data).
// Populates categories + products that mirror the landing-page catalog so the
// public API can serve the SAME data the frontend currently hardcodes.
import { hash } from 'bcryptjs';
import { PrismaClient, Prisma, ProductStatus, VisibilityStatus, SpiceLevel, StockStatus, CouponType } from '../src/generated/prisma/client';
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

// Products that belong to the second (partner) seller so a multi-seller cart /
// split-checkout can be exercised on seeded data. Everything else is Bilokat's.
const PARTNER_PRODUCT_IDS = ['shahi-kaju-mixture', 'roasted-peri-makhana'];

async function main(): Promise<void> {
  console.log('Seeding catalog...');

  // Upsert dev sellers (Session 09 split-checkout). Fixed ids mirror the
  // 20260907142140 migration so a fresh DB is consistent after migrate deploy.
  const SELLERS = [
    { id: 'seller-legacy', sellerCode: 'SELL-BILOKAT', legalName: 'Bilokat Foods Private Limited', displayName: 'Bilokat Kitchens' },
    { id: 'seller-partner', sellerCode: 'SELL-RAJRANI', legalName: 'Rajrani Retail Ventures', displayName: 'Rajrani Select' },
  ];
  const sellerByCode: Record<string, string> = {};
  for (const s of SELLERS) {
    await prisma.seller.upsert({
      where: { id: s.id },
      update: { sellerCode: s.sellerCode, legalName: s.legalName, displayName: s.displayName, status: 'ACTIVE' },
      create: { id: s.id, sellerCode: s.sellerCode, legalName: s.legalName, displayName: s.displayName, status: 'ACTIVE' },
    });
    sellerByCode[s.sellerCode] = s.id;
  }

  // Upsert dev coupons (fixtures only)
  const coupons = [
    { code: 'BILOKAT20', type: CouponType.PERCENTAGE, value: 20, minOrderValue: 299, maxDiscount: 150, validForDays: 365 },
    { code: 'FLAT50', type: CouponType.FIXED_AMOUNT, value: 50, minOrderValue: 199, maxDiscount: null, validForDays: 365 },
    { code: 'SAVE10', type: CouponType.PERCENTAGE, value: 10, minOrderValue: null, maxDiscount: 60, validForDays: 365 },
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
    const sellerId = PARTNER_PRODUCT_IDS.includes(p.id) ? 'seller-partner' : 'seller-legacy';
    const product = await prisma.product.upsert({
      where: { slug: p.slug },
      update: {
        name: p.name,
        tagline: p.tagline,
        description: p.description,
        categoryId,
        sellerId,
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
        sellerId,
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

  // SELLER-role operator accounts bound to a seller org (Session 09). Dev fixture
  // password only; kept out of the API for non-seller roles.
  const sellerOps = [
    { email: 'seller1@example.com', fullName: 'Bilokat Kitchens Ops', sellerId: 'seller-legacy' },
    { email: 'seller2@example.com', fullName: 'Rajrani Select Ops', sellerId: 'seller-partner' },
  ];
  for (const u of sellerOps) {
    const passwordHash = await hash('Seller@123', 12);
    await prisma.user.upsert({
      where: { email: u.email },
      update: { fullName: u.fullName, role: 'SELLER', sellerId: u.sellerId, status: 'ACTIVE' },
      create: {
        email: u.email,
        fullName: u.fullName,
        passwordHash,
        role: 'SELLER',
        sellerId: u.sellerId,
        status: 'ACTIVE',
      },
    });
  }
  console.log('  ✓ seller operators');

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
