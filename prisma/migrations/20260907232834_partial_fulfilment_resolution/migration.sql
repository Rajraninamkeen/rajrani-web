-- AlterTable
ALTER TABLE "refunds" ADD COLUMN     "sellerOrderId" TEXT,
ALTER COLUMN "returnRequestId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "seller_orders" ADD COLUMN     "cancellationReason" TEXT,
ADD COLUMN     "cancelledAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "refunds_sellerOrderId_idx" ON "refunds"("sellerOrderId");

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_sellerOrderId_fkey" FOREIGN KEY ("sellerOrderId") REFERENCES "seller_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
