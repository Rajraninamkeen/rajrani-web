-- AlterTable
ALTER TABLE "products" ADD COLUMN     "reviewNote" TEXT;

-- CreateTable
CREATE TABLE "product_status_history" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "fromStatus" "ProductStatus",
    "toStatus" "ProductStatus" NOT NULL,
    "actorRole" TEXT NOT NULL,
    "actorId" TEXT,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "product_status_history_productId_idx" ON "product_status_history"("productId");

-- AddForeignKey
ALTER TABLE "product_status_history" ADD CONSTRAINT "product_status_history_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

