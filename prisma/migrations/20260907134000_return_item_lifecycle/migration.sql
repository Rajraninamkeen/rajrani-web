-- CreateEnum
CREATE TYPE "ReturnEventType" AS ENUM ('REQUESTED', 'APPROVED', 'REJECTED', 'PICKUP_SCHEDULED', 'PICKED_UP', 'INSPECTION', 'APPROVED_FOR_REFUND', 'REFUND_INITIATED', 'REFUND_COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ReturnActorType" AS ENUM ('CUSTOMER', 'OPERATOR', 'SYSTEM');

-- CreateEnum
CREATE TYPE "InspectionResult" AS ENUM ('PASS', 'PARTIAL_PASS', 'FAIL');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ReturnStatus" ADD VALUE 'PICKUP_SCHEDULED';
ALTER TYPE "ReturnStatus" ADD VALUE 'PICKED_UP';
ALTER TYPE "ReturnStatus" ADD VALUE 'INSPECTION';
ALTER TYPE "ReturnStatus" ADD VALUE 'APPROVED_FOR_REFUND';
ALTER TYPE "ReturnStatus" ADD VALUE 'CANCELLED';

-- AlterTable
ALTER TABLE "return_requests" ADD COLUMN     "approvedForRefundAt" TIMESTAMP(3),
ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "inspectedAt" TIMESTAMP(3),
ADD COLUMN     "pickedUpAt" TIMESTAMP(3),
ADD COLUMN     "pickupScheduledAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "return_items" (
    "id" TEXT NOT NULL,
    "returnRequestId" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "conditionNotes" TEXT,
    "inspectionResult" "InspectionResult",
    "refundAmount" DECIMAL(12,2),
    "replacementRequested" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "return_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "return_events" (
    "id" TEXT NOT NULL,
    "returnRequestId" TEXT NOT NULL,
    "eventType" "ReturnEventType" NOT NULL,
    "actorType" "ReturnActorType" NOT NULL,
    "actorId" TEXT,
    "reason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "return_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "return_inspections" (
    "id" TEXT NOT NULL,
    "returnItemId" TEXT NOT NULL,
    "inspectorId" TEXT,
    "result" "InspectionResult" NOT NULL,
    "conditionNotes" TEXT,
    "evidenceStorageId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "return_inspections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refund_transactions" (
    "id" TEXT NOT NULL,
    "refundId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'sandbox',
    "providerReference" TEXT,
    "amount" DECIMAL(12,2) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "refund_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "return_items_returnRequestId_orderItemId_key" ON "return_items"("returnRequestId", "orderItemId");

-- CreateIndex
CREATE INDEX "return_events_returnRequestId_idx" ON "return_events"("returnRequestId");

-- CreateIndex
CREATE UNIQUE INDEX "return_inspections_returnItemId_key" ON "return_inspections"("returnItemId");

-- CreateIndex
CREATE INDEX "refund_transactions_refundId_idx" ON "refund_transactions"("refundId");

-- AddForeignKey
ALTER TABLE "return_items" ADD CONSTRAINT "return_items_returnRequestId_fkey" FOREIGN KEY ("returnRequestId") REFERENCES "return_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_items" ADD CONSTRAINT "return_items_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "order_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_events" ADD CONSTRAINT "return_events_returnRequestId_fkey" FOREIGN KEY ("returnRequestId") REFERENCES "return_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_inspections" ADD CONSTRAINT "return_inspections_returnItemId_fkey" FOREIGN KEY ("returnItemId") REFERENCES "return_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refund_transactions" ADD CONSTRAINT "refund_transactions_refundId_fkey" FOREIGN KEY ("refundId") REFERENCES "refunds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

