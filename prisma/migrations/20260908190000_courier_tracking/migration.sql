-- Session 30: external courier-provider tracking + proof-of-delivery (POD) on courier
-- assignments (slice parcels + replacements). Additive; non-money; does not touch earn.

-- delivery_assignments
ALTER TABLE "delivery_assignments" ADD COLUMN IF NOT EXISTS "carrier" TEXT;
ALTER TABLE "delivery_assignments" ADD COLUMN IF NOT EXISTS "trackingNumber" TEXT;
ALTER TABLE "delivery_assignments" ADD COLUMN IF NOT EXISTS "trackingUrl" TEXT;
ALTER TABLE "delivery_assignments" ADD COLUMN IF NOT EXISTS "podRef" TEXT;
ALTER TABLE "delivery_assignments" ADD COLUMN IF NOT EXISTS "podSignedBy" TEXT;
ALTER TABLE "delivery_assignments" ADD COLUMN IF NOT EXISTS "podAt" TIMESTAMP(3);

-- replacement_assignments
ALTER TABLE "replacement_assignments" ADD COLUMN IF NOT EXISTS "carrier" TEXT;
ALTER TABLE "replacement_assignments" ADD COLUMN IF NOT EXISTS "trackingNumber" TEXT;
ALTER TABLE "replacement_assignments" ADD COLUMN IF NOT EXISTS "trackingUrl" TEXT;
ALTER TABLE "replacement_assignments" ADD COLUMN IF NOT EXISTS "podRef" TEXT;
ALTER TABLE "replacement_assignments" ADD COLUMN IF NOT EXISTS "podSignedBy" TEXT;
ALTER TABLE "replacement_assignments" ADD COLUMN IF NOT EXISTS "podAt" TIMESTAMP(3);
