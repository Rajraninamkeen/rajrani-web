-- CreateEnum
CREATE TYPE "ReturnResolution" AS ENUM ('REFUND', 'REPLACEMENT');

-- CreateEnum
CREATE TYPE "ReplacementStatus" AS ENUM ('PENDING_DISPATCH', 'DISPATCHED', 'COMPLETED', 'CANCELLED');

-- AlterEnum
ALTER TYPE "ReturnEventType" ADD VALUE 'REPLACEMENT_ISSUED';

-- AlterEnum
ALTER TYPE "ReturnStatus" ADD VALUE 'REPLACEMENT_ISSUED';

-- AlterTable
ALTER TABLE "return_requests" ADD COLUMN     "resolution" "ReturnResolution";

-- CreateTable
CREATE TABLE "return_evidence" (
    "id" TEXT NOT NULL,
    "returnRequestId" TEXT NOT NULL,
    "storageObjectId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT,
    "sizeBytes" INTEGER,
    "kind" TEXT NOT NULL DEFAULT 'IMAGE',
    "uploadedBy" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "return_evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "replacements" (
    "id" TEXT NOT NULL,
    "returnRequestId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "sellerOrderId" TEXT,
    "replacementReference" TEXT NOT NULL,
    "status" "ReplacementStatus" NOT NULL DEFAULT 'PENDING_DISPATCH',
    "quantityTotal" INTEGER NOT NULL,
    "issuedBy" TEXT,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dispatchedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "replacements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "return_evidence_storageObjectId_key" ON "return_evidence"("storageObjectId");

-- CreateIndex
CREATE INDEX "return_evidence_returnRequestId_idx" ON "return_evidence"("returnRequestId");

-- CreateIndex
CREATE UNIQUE INDEX "replacements_returnRequestId_key" ON "replacements"("returnRequestId");

-- CreateIndex
CREATE UNIQUE INDEX "replacements_replacementReference_key" ON "replacements"("replacementReference");

-- CreateIndex
CREATE INDEX "replacements_orderId_idx" ON "replacements"("orderId");

-- CreateIndex
CREATE INDEX "replacements_returnRequestId_idx" ON "replacements"("returnRequestId");

-- AddForeignKey
ALTER TABLE "return_evidence" ADD CONSTRAINT "return_evidence_returnRequestId_fkey" FOREIGN KEY ("returnRequestId") REFERENCES "return_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "replacements" ADD CONSTRAINT "replacements_returnRequestId_fkey" FOREIGN KEY ("returnRequestId") REFERENCES "return_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "replacements" ADD CONSTRAINT "replacements_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

