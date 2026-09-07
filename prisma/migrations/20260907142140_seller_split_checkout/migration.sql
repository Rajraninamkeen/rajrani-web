-- Session 09: Seller orgs + multi-seller catalog + split-checkout (seller_orders).
-- Backfill strategy for a DB that already holds products/orders/order_items:
--   * create two sellers (a legacy/default seller + one partner for a native
--     cross-seller split demo),
--   * assign every existing product to the legacy seller (then move a couple to
--     the partner to make multi-seller carts possible on existing data),
--   * create exactly one seller_order per existing order under the legacy seller
--     (those orders predate split-checkout, so each maps 1:1 and its SellerOrder
--     money equals the order's totals), and point its order_items at it.

-- CreateEnum
CREATE TYPE "SellerStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'DEACTIVATED');

-- CreateEnum
CREATE TYPE "SellerOrderStatus" AS ENUM ('PLACED', 'ACCEPTED', 'REJECTED', 'CANCELLED');

-- 1) Add the new columns as nullable first so existing rows are backfillable.
ALTER TABLE "users" ADD COLUMN     "sellerId" TEXT;
ALTER TABLE "products" ADD COLUMN     "sellerId" TEXT;
ALTER TABLE "order_items" ADD COLUMN     "sellerNameSnapshot" TEXT,
ADD COLUMN     "sellerOrderId" TEXT;

-- 2) Create the sellers table + two seed sellers.
CREATE TABLE "sellers" (
    "id" TEXT NOT NULL,
    "sellerCode" TEXT NOT NULL,
    "legalName" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "status" "SellerStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sellers_pkey" PRIMARY KEY ("id")
);

INSERT INTO "sellers" ("id","sellerCode","legalName","displayName","status","createdAt","updatedAt") VALUES
  ('seller-legacy','SELL-BILOKAT','Bilokat Foods Private Limited','Bilokat Kitchens','ACTIVE', now(), now()),
  ('seller-partner','SELL-RAJRANI','Rajrani Retail Ventures','Rajrani Select','ACTIVE', now(), now())
ON CONFLICT ("id") DO NOTHING;

-- 3) Backfill products -> legacy seller, then move two products to the partner so
--    a cross-seller cart/order can be exercised on existing data.
UPDATE "products" SET "sellerId" = 'seller-legacy' WHERE "sellerId" IS NULL;
UPDATE "products" SET "sellerId" = 'seller-partner'
  WHERE "id" IN ('shahi-kaju-mixture','roasted-peri-makhana');

-- 4) Backfill sellerNameSnapshot for existing order items (legacy seller).
UPDATE "order_items" SET "sellerNameSnapshot" = 'Bilokat Kitchens' WHERE "sellerNameSnapshot" IS NULL;

-- 5) One seller_order per existing order (single-seller historical orders) and
--    link their order_items to it.
CREATE TABLE "seller_orders" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "sellerOrderNumber" TEXT NOT NULL,
    "status" "SellerOrderStatus" NOT NULL DEFAULT 'PLACED',
    "subtotal" DECIMAL(12,2) NOT NULL,
    "discountTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "taxTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "deliveryTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "grandTotal" DECIMAL(12,2) NOT NULL,
    "sellerAmount" DECIMAL(12,2) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "seller_orders_pkey" PRIMARY KEY ("id")
);

INSERT INTO "seller_orders"
  ("id","orderId","sellerId","sellerOrderNumber","status","subtotal","discountTotal",
   "taxTotal","deliveryTotal","grandTotal","sellerAmount","createdAt","updatedAt")
SELECT
  'so-' || o."id",
  o."id",
  'seller-legacy',
  'SO-' || upper(substr(md5(o."id"),1,8)),
  'PLACED',
  o."subtotal",
  o."discountTotal",
  o."taxTotal",
  o."deliveryTotal",
  o."grandTotal",
  o."grandTotal",
  now(), now()
FROM "orders" o;

UPDATE "order_items" oi
SET "sellerOrderId" = 'so-' || oi."orderId"
WHERE oi."sellerOrderId" IS NULL;

-- 6) Now tighten: NOT NULL + indexes + FKs.
ALTER TABLE "products" ALTER COLUMN "sellerId" SET NOT NULL;
ALTER TABLE "order_items" ALTER COLUMN "sellerOrderId" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "sellers_sellerCode_key" ON "sellers"("sellerCode");
CREATE INDEX "sellers_status_idx" ON "sellers"("status");
CREATE UNIQUE INDEX "seller_orders_sellerOrderNumber_key" ON "seller_orders"("sellerOrderNumber");
CREATE INDEX "seller_orders_orderId_idx" ON "seller_orders"("orderId");
CREATE INDEX "seller_orders_sellerId_idx" ON "seller_orders"("sellerId");
CREATE INDEX "seller_orders_status_idx" ON "seller_orders"("status");
CREATE INDEX "order_items_sellerOrderId_idx" ON "order_items"("sellerOrderId");
CREATE INDEX "products_sellerId_idx" ON "products"("sellerId");
CREATE INDEX "users_sellerId_idx" ON "users"("sellerId");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "sellers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "products" ADD CONSTRAINT "products_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "sellers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_sellerOrderId_fkey" FOREIGN KEY ("sellerOrderId") REFERENCES "seller_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "seller_orders" ADD CONSTRAINT "seller_orders_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "seller_orders" ADD CONSTRAINT "seller_orders_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "sellers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
