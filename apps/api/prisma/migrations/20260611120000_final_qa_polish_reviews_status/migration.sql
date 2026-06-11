CREATE TYPE "OfferRejectionReason" AS ENUM (
  'AUTO_REJECTED_BY_SELECTION',
  'MANUALLY_REJECTED_BY_EMPLOYER',
  'SELECTION_CANCELLED_BY_EMPLOYER'
);

ALTER TABLE "Offer" ADD COLUMN "rejectionReason" "OfferRejectionReason";

CREATE TABLE "EmployerReview" (
  "id" UUID NOT NULL,
  "jobRequestId" UUID NOT NULL,
  "offerId" UUID NOT NULL,
  "contactUnlockId" UUID,
  "employerId" UUID NOT NULL,
  "contractorId" UUID NOT NULL,
  "rating" INTEGER NOT NULL,
  "comment" VARCHAR(1500),
  "status" "ReviewStatus" NOT NULL DEFAULT 'ACTIVE',
  "removedByAdminId" UUID,
  "removedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "EmployerReview_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EmployerRatingSummary" (
  "id" UUID NOT NULL,
  "employerId" UUID NOT NULL,
  "averageRating" DECIMAL(3,2) NOT NULL DEFAULT 0,
  "totalReviews" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "EmployerRatingSummary_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EmployerReview_offerId_key" ON "EmployerReview"("offerId");
CREATE UNIQUE INDEX "EmployerReview_contactUnlockId_key" ON "EmployerReview"("contactUnlockId");
CREATE UNIQUE INDEX "EmployerReview_jobRequestId_contractorId_key" ON "EmployerReview"("jobRequestId", "contractorId");
CREATE INDEX "EmployerReview_employerId_status_removedAt_idx" ON "EmployerReview"("employerId", "status", "removedAt");
CREATE INDEX "EmployerReview_contractorId_idx" ON "EmployerReview"("contractorId");
CREATE UNIQUE INDEX "EmployerRatingSummary_employerId_key" ON "EmployerRatingSummary"("employerId");

ALTER TABLE "EmployerReview" ADD CONSTRAINT "EmployerReview_jobRequestId_fkey" FOREIGN KEY ("jobRequestId") REFERENCES "JobRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmployerReview" ADD CONSTRAINT "EmployerReview_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "Offer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmployerReview" ADD CONSTRAINT "EmployerReview_contactUnlockId_fkey" FOREIGN KEY ("contactUnlockId") REFERENCES "ContactUnlock"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmployerReview" ADD CONSTRAINT "EmployerReview_employerId_fkey" FOREIGN KEY ("employerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmployerReview" ADD CONSTRAINT "EmployerReview_contractorId_fkey" FOREIGN KEY ("contractorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmployerRatingSummary" ADD CONSTRAINT "EmployerRatingSummary_employerId_fkey" FOREIGN KEY ("employerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
