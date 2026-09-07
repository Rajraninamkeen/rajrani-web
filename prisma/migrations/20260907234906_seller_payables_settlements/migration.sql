-- CreateEnum
CREATE TYPE "PayableStatus" AS ENUM ('EARNED', 'IN_SETTLEMENT', 'SETTLED');

-- CreateEnum
CREATE TYPE "SettlementStatus" AS ENUM ('PENDING', 'APPROVED', 'PROCESSING', 'PAID', 'RECONCILED', 'FAILED');

-- AlterTable
ALTER TABLE "sellers" ADD COLUMN     "commissionRateBps" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "seller_payables" (
    "id" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "sellerOrderId" TEXT NOT NULL,
    "grossAmount" DECIMAL(12,2) NOT NULL,
    "discountAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "goodsValue" DECIMAL(12,2) NOT NULL,
    "commissionRateBps" INTEGER NOT NULL DEFAULT 0,
    "commissionAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "taxAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "deliveryAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "refundAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "adjustmentAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "netPayable" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "status" "PayableStatus" NOT NULL DEFAULT 'EARNED',
    "earnedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "seller_payables_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seller_payable_adjustments" (
    "id" TEXT NOT NULL,
    "sellerPayableId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "actorType" TEXT NOT NULL,
    "actorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "seller_payable_adjustments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settlements" (
    "id" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "settlementReference" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3),
    "periodEnd" TIMESTAMP(3),
    "status" "SettlementStatus" NOT NULL DEFAULT 'PENDING',
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "grossAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "discountAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "goodsValue" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "commissionAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "taxAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "deliveryAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "refundAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "adjustmentAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "netPayable" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "approvedAt" TIMESTAMP(3),
    "processedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "reconciledAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "failedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "settlements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settlement_items" (
    "id" TEXT NOT NULL,
    "settlementId" TEXT NOT NULL,
    "sellerPayableId" TEXT NOT NULL,
    "sellerOrderId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "settlement_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settlement_events" (
    "id" TEXT NOT NULL,
    "settlementId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "actorId" TEXT,
    "reason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "settlement_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "seller_payables_sellerOrderId_key" ON "seller_payables"("sellerOrderId");

-- CreateIndex
CREATE INDEX "seller_payables_sellerId_status_idx" ON "seller_payables"("sellerId", "status");

-- CreateIndex
CREATE INDEX "seller_payables_orderId_idx" ON "seller_payables"("orderId");

-- CreateIndex
CREATE INDEX "seller_payable_adjustments_sellerPayableId_idx" ON "seller_payable_adjustments"("sellerPayableId");

-- CreateIndex
CREATE UNIQUE INDEX "settlements_settlementReference_key" ON "settlements"("settlementReference");

-- CreateIndex
CREATE INDEX "settlements_sellerId_status_idx" ON "settlements"("sellerId", "status");

-- CreateIndex
CREATE INDEX "settlements_status_idx" ON "settlements"("status");

-- CreateIndex
CREATE UNIQUE INDEX "settlement_items_sellerPayableId_key" ON "settlement_items"("sellerPayableId");

-- CreateIndex
CREATE INDEX "settlement_items_settlementId_idx" ON "settlement_items"("settlementId");

-- CreateIndex
CREATE INDEX "settlement_events_settlementId_idx" ON "settlement_events"("settlementId");

-- AddForeignKey
ALTER TABLE "seller_payables" ADD CONSTRAINT "seller_payables_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "sellers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller_payables" ADD CONSTRAINT "seller_payables_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller_payables" ADD CONSTRAINT "seller_payables_sellerOrderId_fkey" FOREIGN KEY ("sellerOrderId") REFERENCES "seller_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller_payable_adjustments" ADD CONSTRAINT "seller_payable_adjustments_sellerPayableId_fkey" FOREIGN KEY ("sellerPayableId") REFERENCES "seller_payables"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settlements" ADD CONSTRAINT "settlements_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "sellers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settlement_items" ADD CONSTRAINT "settlement_items_settlementId_fkey" FOREIGN KEY ("settlementId") REFERENCES "settlements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settlement_items" ADD CONSTRAINT "settlement_items_sellerPayableId_fkey" FOREIGN KEY ("sellerPayableId") REFERENCES "seller_payables"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settlement_events" ADD CONSTRAINT "settlement_events_settlementId_fkey" FOREIGN KEY ("settlementId") REFERENCES "settlements"("id") ON DELETE CASCADE ON UPDATE CASCADE;
