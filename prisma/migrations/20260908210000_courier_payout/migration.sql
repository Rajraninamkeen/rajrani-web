-- CreateEnum
CREATE TYPE "CourierPayoutStatus" AS ENUM ('EARNED', 'SETTLED', 'CANCELLED');

-- CreateTable
CREATE TABLE "courier_payouts" (
    "id" TEXT NOT NULL,
    "deliveryPartnerId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "sellerOrderId" TEXT,
    "deliveryAssignmentId" TEXT,
    "replacementAssignmentId" TEXT,
    "feeAmount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "status" "CourierPayoutStatus" NOT NULL DEFAULT 'EARNED',
    "earnedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "settledAt" TIMESTAMP(3),
    "settledById" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "courier_payouts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "courier_payouts_deliveryAssignmentId_key" ON "courier_payouts"("deliveryAssignmentId");

-- CreateIndex
CREATE UNIQUE INDEX "courier_payouts_replacementAssignmentId_key" ON "courier_payouts"("replacementAssignmentId");

-- CreateIndex
CREATE INDEX "courier_payouts_deliveryPartnerId_status_idx" ON "courier_payouts"("deliveryPartnerId", "status");

-- CreateIndex
CREATE INDEX "courier_payouts_kind_idx" ON "courier_payouts"("kind");

-- CreateIndex
CREATE INDEX "courier_payouts_orderId_idx" ON "courier_payouts"("orderId");

-- AddForeignKey
ALTER TABLE "courier_payouts" ADD CONSTRAINT "courier_payouts_deliveryPartnerId_fkey" FOREIGN KEY ("deliveryPartnerId") REFERENCES "delivery_partners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

