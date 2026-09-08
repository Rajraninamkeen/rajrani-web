-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ReturnEventType" ADD VALUE 'REPLACEMENT_DISPATCHED';
ALTER TYPE "ReturnEventType" ADD VALUE 'REPLACEMENT_COMPLETED';
ALTER TYPE "ReturnEventType" ADD VALUE 'REPLACEMENT_CANCELLED';

-- AlterTable
ALTER TABLE "replacements" ADD COLUMN     "cancellationReason" TEXT,
ADD COLUMN     "dispatchBy" TEXT,
ADD COLUMN     "dispatchNote" TEXT,
ADD COLUMN     "dispatchReference" TEXT;

