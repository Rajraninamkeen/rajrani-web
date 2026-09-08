-- CreateEnum
CREATE TYPE "OrganizationType" AS ENUM ('SELLER', 'INTERNAL', 'PARTNER', 'OTHER');

-- CreateEnum
CREATE TYPE "OrganizationStatus" AS ENUM ('ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "OrganizationMemberStatus" AS ENUM ('ACTIVE', 'INVITED', 'REMOVED');

-- CreateEnum
CREATE TYPE "OrganizationMemberRole" AS ENUM ('OWNER', 'OPERATOR', 'VIEWER');

-- CreateEnum
CREATE TYPE "SellerApplicationStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'RESUBMITTED', 'CORRECTION_REQUIRED', 'ADDITIONAL_INFORMATION_REQUIRED', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "SellerDocumentType" AS ENUM ('GST_CERTIFICATE', 'PAN_CARD', 'BANK_ACCOUNT_PROOF', 'ADDRESS_PROOF', 'BUSINESS_REGISTRATION', 'ID_PROOF', 'OTHER');

-- CreateEnum
CREATE TYPE "DocumentVerificationStatus" AS ENUM ('PENDING', 'SUBMITTED', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ReviewDecision" AS ENUM ('APPROVE', 'REJECT', 'CORRECTION_REQUIRED', 'ADDITIONAL_INFORMATION_REQUIRED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "SellerStatus" ADD VALUE 'REGISTERED';
ALTER TYPE "SellerStatus" ADD VALUE 'PENDING';
ALTER TYPE "SellerStatus" ADD VALUE 'UNDER_REVIEW';
ALTER TYPE "SellerStatus" ADD VALUE 'APPROVED';
ALTER TYPE "SellerStatus" ADD VALUE 'REJECTED';

-- AlterTable
ALTER TABLE "sellers" ADD COLUMN     "activatedAt" TIMESTAMP(3),
ADD COLUMN     "organizationId" TEXT;

-- CreateTable
CREATE TABLE "organizations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "type" "OrganizationType" NOT NULL DEFAULT 'SELLER',
    "status" "OrganizationStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_members" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "OrganizationMemberRole" NOT NULL DEFAULT 'OPERATOR',
    "status" "OrganizationMemberStatus" NOT NULL DEFAULT 'ACTIVE',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organization_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seller_applications" (
    "id" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "applicationNumber" TEXT NOT NULL,
    "status" "SellerApplicationStatus" NOT NULL DEFAULT 'DRAFT',
    "gstin" TEXT,
    "pan" TEXT,
    "businessAddress" TEXT,
    "city" TEXT,
    "state" TEXT,
    "bankAccountHolder" TEXT,
    "bankAccountLast4" TEXT,
    "bankIfsc" TEXT,
    "payoutPreference" TEXT,
    "agreedToTerms" BOOLEAN NOT NULL DEFAULT false,
    "agreedToTermsAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "reviewedBy" TEXT,
    "rejectionReason" TEXT,
    "correctionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "seller_applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seller_documents" (
    "id" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "applicationId" TEXT,
    "documentType" "SellerDocumentType" NOT NULL,
    "storageObjectId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT,
    "sizeBytes" INTEGER,
    "status" "DocumentVerificationStatus" NOT NULL DEFAULT 'PENDING',
    "uploadedBy" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "verifiedAt" TIMESTAMP(3),
    "verifiedBy" TEXT,
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "seller_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seller_reviews" (
    "id" TEXT NOT NULL,
    "sellerApplicationId" TEXT NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "decision" "ReviewDecision" NOT NULL,
    "reason" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "seller_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seller_status_history" (
    "id" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "fromStatus" "SellerStatus",
    "toStatus" "SellerStatus" NOT NULL,
    "changedBy" TEXT,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "seller_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations"("slug");

-- CreateIndex
CREATE INDEX "organizations_type_idx" ON "organizations"("type");

-- CreateIndex
CREATE INDEX "organizations_status_idx" ON "organizations"("status");

-- CreateIndex
CREATE INDEX "organization_members_userId_idx" ON "organization_members"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "organization_members_organizationId_userId_key" ON "organization_members"("organizationId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "seller_applications_applicationNumber_key" ON "seller_applications"("applicationNumber");

-- CreateIndex
CREATE INDEX "seller_applications_sellerId_idx" ON "seller_applications"("sellerId");

-- CreateIndex
CREATE INDEX "seller_applications_status_idx" ON "seller_applications"("status");

-- CreateIndex
CREATE UNIQUE INDEX "seller_documents_storageObjectId_key" ON "seller_documents"("storageObjectId");

-- CreateIndex
CREATE INDEX "seller_documents_sellerId_idx" ON "seller_documents"("sellerId");

-- CreateIndex
CREATE INDEX "seller_documents_documentType_idx" ON "seller_documents"("documentType");

-- CreateIndex
CREATE INDEX "seller_reviews_sellerApplicationId_idx" ON "seller_reviews"("sellerApplicationId");

-- CreateIndex
CREATE INDEX "seller_status_history_sellerId_idx" ON "seller_status_history"("sellerId");

-- CreateIndex
CREATE INDEX "sellers_organizationId_idx" ON "sellers"("organizationId");

-- AddForeignKey
ALTER TABLE "sellers" ADD CONSTRAINT "sellers_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller_applications" ADD CONSTRAINT "seller_applications_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "sellers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller_documents" ADD CONSTRAINT "seller_documents_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "sellers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller_documents" ADD CONSTRAINT "seller_documents_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "seller_applications"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller_reviews" ADD CONSTRAINT "seller_reviews_sellerApplicationId_fkey" FOREIGN KEY ("sellerApplicationId") REFERENCES "seller_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller_status_history" ADD CONSTRAINT "seller_status_history_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "sellers"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ===== Session 14 data backfill (idempotent) =====
-- Link each existing seller to a SELLER-type Organization and bind its ACTIVE
-- SELLER-role operator users as members (owner). Safe to run against an already
-- seeded DB; no-ops when sellers/users do not yet exist (fresh: seed handles it).

INSERT INTO organizations (id, name, slug, type, status, "createdAt", "updatedAt")
SELECT 'org_' || lower(replace("sellerCode", '_', '-')),
       "displayName", 'org_' || lower(replace("sellerCode", '_', '-')),
       'SELLER', 'ACTIVE', now(), now()
FROM sellers
ON CONFLICT (slug) DO NOTHING;

UPDATE sellers s
SET "organizationId" = o.id
FROM organizations o
WHERE o.slug = 'org_' || lower(replace(s."sellerCode", '_', '-'))
  AND s."organizationId" IS NULL;

UPDATE sellers
SET "activatedAt" = COALESCE("activatedAt", now())
WHERE status = 'ACTIVE';

INSERT INTO organization_members (id, "organizationId", "userId", role, status, "joinedAt", "createdAt", "updatedAt")
SELECT 'om_' || u.id, s."organizationId", u.id, 'OWNER', 'ACTIVE', now(), now(), now()
FROM users u
JOIN sellers s ON s.id = u."sellerId"
WHERE u.role = 'SELLER' AND u.status = 'ACTIVE' AND s."organizationId" IS NOT NULL
ON CONFLICT ("organizationId", "userId") DO NOTHING;
