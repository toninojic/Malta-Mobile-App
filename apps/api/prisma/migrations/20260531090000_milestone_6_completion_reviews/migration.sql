DO $$
BEGIN
  CREATE TYPE "JobCompletionStatus" AS ENUM ('PENDING_EMPLOYER_CONFIRMATION', 'CONFIRMED', 'DISPUTED', 'CANCELLED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "ReviewStatus" AS ENUM ('ACTIVE', 'REMOVED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'REVIEW_REPLIED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'REVIEW_REMOVED';

CREATE TABLE "JobCompletion" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "jobRequestId" UUID NOT NULL,
  "offerId" UUID NOT NULL,
  "contactUnlockId" UUID NOT NULL,
  "employerId" UUID NOT NULL,
  "contractorId" UUID NOT NULL,
  "status" "JobCompletionStatus" NOT NULL DEFAULT 'PENDING_EMPLOYER_CONFIRMATION',
  "contractorMarkedAt" TIMESTAMP(3),
  "employerConfirmedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "JobCompletion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "JobCompletion_offerId_key" ON "JobCompletion"("offerId");
CREATE UNIQUE INDEX "JobCompletion_contactUnlockId_key" ON "JobCompletion"("contactUnlockId");
CREATE INDEX "JobCompletion_jobRequestId_idx" ON "JobCompletion"("jobRequestId");
CREATE INDEX "JobCompletion_employerId_status_idx" ON "JobCompletion"("employerId", "status");
CREATE INDEX "JobCompletion_contractorId_status_idx" ON "JobCompletion"("contractorId", "status");
CREATE INDEX "JobCompletion_status_createdAt_idx" ON "JobCompletion"("status", "createdAt");

ALTER TABLE "JobCompletion"
  ADD CONSTRAINT "JobCompletion_jobRequestId_fkey"
  FOREIGN KEY ("jobRequestId") REFERENCES "JobRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "JobCompletion"
  ADD CONSTRAINT "JobCompletion_offerId_fkey"
  FOREIGN KEY ("offerId") REFERENCES "Offer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "JobCompletion"
  ADD CONSTRAINT "JobCompletion_contactUnlockId_fkey"
  FOREIGN KEY ("contactUnlockId") REFERENCES "ContactUnlock"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "JobCompletion"
  ADD CONSTRAINT "JobCompletion_employerId_fkey"
  FOREIGN KEY ("employerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "JobCompletion"
  ADD CONSTRAINT "JobCompletion_contractorId_fkey"
  FOREIGN KEY ("contractorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "ContractorRatingSummary" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "contractorId" UUID NOT NULL,
  "averageRating" DECIMAL(3,2) NOT NULL DEFAULT 0,
  "totalReviews" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ContractorRatingSummary_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ContractorRatingSummary_contractorId_key" ON "ContractorRatingSummary"("contractorId");

ALTER TABLE "ContractorRatingSummary"
  ADD CONSTRAINT "ContractorRatingSummary_contractorId_fkey"
  FOREIGN KEY ("contractorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Review"
  ADD COLUMN "contactUnlockId" UUID,
  ADD COLUMN "contractorReply" VARCHAR(1500),
  ADD COLUMN "contractorReplyAt" TIMESTAMP(3),
  ADD COLUMN "status" "ReviewStatus" NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN "removedByAdminId" UUID;

UPDATE "Review"
SET "contractorReply" = "contractorResponse"
WHERE "contractorResponse" IS NOT NULL;

ALTER TABLE "Review"
  DROP COLUMN IF EXISTS "contractorResponse";

ALTER TABLE "Review"
  ALTER COLUMN "comment" TYPE VARCHAR(1500);

CREATE UNIQUE INDEX "Review_contactUnlockId_key" ON "Review"("contactUnlockId");
DROP INDEX IF EXISTS "Review_contractorId_removedAt_idx";
CREATE INDEX "Review_contractorId_status_removedAt_idx" ON "Review"("contractorId", "status", "removedAt");
CREATE INDEX "Review_employerId_idx" ON "Review"("employerId");

ALTER TABLE "Review"
  ADD CONSTRAINT "Review_contactUnlockId_fkey"
  FOREIGN KEY ("contactUnlockId") REFERENCES "ContactUnlock"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Review"
  ADD CONSTRAINT "Review_removedByAdminId_fkey"
  FOREIGN KEY ("removedByAdminId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
