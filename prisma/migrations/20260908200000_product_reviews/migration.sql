-- DropIndex
DROP INDEX "product_reviews_userId_idx";

-- AlterTable
ALTER TABLE "product_reviews" ADD COLUMN     "moderatedAt" TIMESTAMP(3),
ADD COLUMN     "moderationNote" TEXT,
ADD COLUMN     "moderatorId" TEXT;

-- CreateIndex
CREATE INDEX "product_reviews_userId_status_idx" ON "product_reviews"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "product_reviews_productId_userId_key" ON "product_reviews"("productId", "userId");

