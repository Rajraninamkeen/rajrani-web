-- Session 47: customer wishlist (signed-in accounts only).
CREATE TABLE "wishlist_items" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "wishlist_items_pkey" PRIMARY KEY ("id")
);
-- Prisma client uses camelCase columns when no @map on individual fields; the
-- previous migrations also stored camelCase relation columns (e.g. productId).
ALTER TABLE "wishlist_items" ADD CONSTRAINT "wishlist_items_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "wishlist_items" ADD CONSTRAINT "wishlist_items_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE UNIQUE INDEX "wishlist_items_userId_productId_key" ON "wishlist_items"("userId", "productId");
CREATE INDEX "wishlist_items_userId_idx" ON "wishlist_items"("userId");
CREATE INDEX "wishlist_items_productId_idx" ON "wishlist_items"("productId");
