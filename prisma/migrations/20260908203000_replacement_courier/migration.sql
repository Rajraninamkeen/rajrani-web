-- Session 22: courier last-mile for a dispatched replacement (outbound exchange).
-- Non-money leg. Reuses DeliveryPartner + DeliveryAssignmentStatus. Adds an
-- auditable per-replacement courier assignment row plus courier step event types.

-- AlterEnum: new ReturnEventType values (courier steps on the replacement/return trail).
ALTER TYPE "ReturnEventType" ADD VALUE IF NOT EXISTS 'REPLACEMENT_COURIER_ASSIGNED';
ALTER TYPE "ReturnEventType" ADD VALUE IF NOT EXISTS 'REPLACEMENT_COURIER_ACCEPTED';
ALTER TYPE "ReturnEventType" ADD VALUE IF NOT EXISTS 'REPLACEMENT_COURIER_REJECTED';
ALTER TYPE "ReturnEventType" ADD VALUE IF NOT EXISTS 'REPLACEMENT_COURIER_PICKED_UP';
ALTER TYPE "ReturnEventType" ADD VALUE IF NOT EXISTS 'REPLACEMENT_COURIER_OUT_FOR_DELIVERY';
ALTER TYPE "ReturnEventType" ADD VALUE IF NOT EXISTS 'REPLACEMENT_COURIER_CANCELLED';
ALTER TYPE "ReturnEventType" ADD VALUE IF NOT EXISTS 'REPLACEMENT_COURIER_FAILED';

-- AlterEnum: ReturnActorType gains DELIVERY (courier acting on a replacement).
ALTER TYPE "ReturnActorType" ADD VALUE IF NOT EXISTS 'DELIVERY';

-- CreateTable
CREATE TABLE "replacement_assignments" (
    "id" TEXT NOT NULL,
    "replacementId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "deliveryPartnerId" TEXT,
    "assignmentNumber" TEXT NOT NULL,
    "status" "DeliveryAssignmentStatus" NOT NULL DEFAULT 'ASSIGNED',
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedAt" TIMESTAMP(3),
    "pickedUpAt" TIMESTAMP(3),
    "outForDeliveryAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "replacement_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "replacement_assignments_assignmentNumber_key" ON "replacement_assignments"("assignmentNumber");

-- CreateIndex
CREATE INDEX "replacement_assignments_replacementId_idx" ON "replacement_assignments"("replacementId");

-- CreateIndex
CREATE INDEX "replacement_assignments_orderId_idx" ON "replacement_assignments"("orderId");

-- CreateIndex
CREATE INDEX "replacement_assignments_deliveryPartnerId_idx" ON "replacement_assignments"("deliveryPartnerId");

-- CreateIndex
CREATE INDEX "replacement_assignments_status_idx" ON "replacement_assignments"("status");

-- AddForeignKey
ALTER TABLE "replacement_assignments" ADD CONSTRAINT "replacement_assignments_replacementId_fkey" FOREIGN KEY ("replacementId") REFERENCES "replacements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "replacement_assignments" ADD CONSTRAINT "replacement_assignments_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "replacement_assignments" ADD CONSTRAINT "replacement_assignments_deliveryPartnerId_fkey" FOREIGN KEY ("deliveryPartnerId") REFERENCES "delivery_partners"("id") ON DELETE SET NULL ON UPDATE CASCADE;
