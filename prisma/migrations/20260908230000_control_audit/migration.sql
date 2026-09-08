-- Session 43: Platform Control Panel — append-only high-authority action audit.
-- NOTE: repo migration history is not sequentially replayable on a fresh DB in this
-- environment (see AI-PROGRESS). Schema is applied authoritatively via `prisma db push`;
-- this folder is a DDL record of the additive ControlAudit table.
CREATE TYPE "ControlActionType" AS ENUM (
  'SESSION_REVOKE',
  'SESSION_REVOKE_ALL',
  'SELLER_SUSPEND',
  'SELLER_ACTIVATE',
  'USER_STATUS_CHANGE',
  'CATALOG_OVERRIDE',
  'PAYMENT_OVERRIDE',
  'OTHER');

CREATE TABLE "control_audit" (
  "id" TEXT NOT NULL,
  "actionType" "ControlActionType" NOT NULL,
  "action" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "actorRole" TEXT NOT NULL,
  "targetType" TEXT NOT NULL,
  "targetId" TEXT,
  "reason" TEXT NOT NULL,
  "detail" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "control_audit_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "control_audit_actionType_idx" ON "control_audit"("actionType");
CREATE INDEX "control_audit_actorId_idx" ON "control_audit"("actorId");
CREATE INDEX "control_audit_createdAt_idx" ON "control_audit"("createdAt");
