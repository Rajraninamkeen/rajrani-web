
-- CreateEnum
CREATE TYPE "DeliveryPartnerStatus" AS ENUM ('REGISTERED', 'ACTIVE', 'SUSPENDED', 'INACTIVE');

-- CreateEnum
CREATE TYPE "DeliveryAssignmentStatus" AS ENUM ('ASSIGNED', 'ACCEPTED', 'PICKED_UP', 'OUT_FOR_DELIVERY', 'DELIVERED', 'REJECTED', 'FAILED', 'CANCELLED');

-- CreateTable
CREATE TABLE "delivery_partners" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "partnerCode" TEXT NOT NULL,
    "status" "DeliveryPartnerStatus" NOT NULL DEFAULT 'REGISTERED',
    "vehicleType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "delivery_partners_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_assignments" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "sellerOrderId" TEXT NOT NULL,
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

    CONSTRAINT "delivery_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_events" (
    "id" TEXT NOT NULL,
    "deliveryAssignmentId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "actorType" TEXT NOT NULL,
    "actorId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "delivery_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "delivery_partners_userId_key" ON "delivery_partners"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "delivery_partners_partnerCode_key" ON "delivery_partners"("partnerCode");

-- CreateIndex
CREATE INDEX "delivery_partners_status_idx" ON "delivery_partners"("status");

-- CreateIndex
CREATE UNIQUE INDEX "delivery_assignments_assignmentNumber_key" ON "delivery_assignments"("assignmentNumber");

-- CreateIndex
CREATE INDEX "delivery_assignments_orderId_idx" ON "delivery_assignments"("orderId");

-- CreateIndex
CREATE INDEX "delivery_assignments_sellerOrderId_idx" ON "delivery_assignments"("sellerOrderId");

-- CreateIndex
CREATE INDEX "delivery_assignments_deliveryPartnerId_idx" ON "delivery_assignments"("deliveryPartnerId");

-- CreateIndex
CREATE INDEX "delivery_assignments_status_idx" ON "delivery_assignments"("status");

-- CreateIndex
CREATE INDEX "delivery_events_deliveryAssignmentId_idx" ON "delivery_events"("deliveryAssignmentId");

-- AddForeignKey
ALTER TABLE "delivery_partners" ADD CONSTRAINT "delivery_partners_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_assignments" ADD CONSTRAINT "delivery_assignments_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_assignments" ADD CONSTRAINT "delivery_assignments_sellerOrderId_fkey" FOREIGN KEY ("sellerOrderId") REFERENCES "seller_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_assignments" ADD CONSTRAINT "delivery_assignments_deliveryPartnerId_fkey" FOREIGN KEY ("deliveryPartnerId") REFERENCES "delivery_partners"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_events" ADD CONSTRAINT "delivery_events_deliveryAssignmentId_fkey" FOREIGN KEY ("deliveryAssignmentId") REFERENCES "delivery_assignments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

