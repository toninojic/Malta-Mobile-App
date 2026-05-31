ALTER TYPE "OfferStatus" RENAME VALUE 'SUBMITTED' TO 'PENDING';
ALTER TYPE "OfferStatus" ADD VALUE 'REJECTED';

ALTER TABLE "Offer"
  ADD COLUMN "selectedByEmployer" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "deletedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "Offer_contractorId_jobRequestId_key" ON "Offer"("contractorId", "jobRequestId");
CREATE INDEX "Offer_deletedAt_idx" ON "Offer"("deletedAt");
