-- CreateEnum
CREATE TYPE "ContractorVerificationStatus" AS ENUM ('UNVERIFIED', 'PENDING_REVIEW', 'VERIFIED', 'REJECTED');

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'CONTRACTOR_VERIFICATION_APPROVED';
ALTER TYPE "NotificationType" ADD VALUE 'CONTRACTOR_VERIFICATION_REJECTED';

-- AlterTable
ALTER TABLE "Offer" ADD COLUMN "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "ContractorPortfolioImage" (
    "id" UUID NOT NULL,
    "contractorId" UUID NOT NULL,
    "url" VARCHAR(2048) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContractorPortfolioImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContractorVerification" (
    "id" UUID NOT NULL,
    "contractorId" UUID NOT NULL,
    "documentUrl" VARCHAR(2048) NOT NULL,
    "documentMimeType" VARCHAR(100) NOT NULL,
    "status" "ContractorVerificationStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "adminNote" VARCHAR(2000),
    "reviewedByAdminId" UUID,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContractorVerification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ContractorPortfolioImage_contractorId_sortOrder_idx" ON "ContractorPortfolioImage"("contractorId", "sortOrder");

-- CreateIndex
CREATE INDEX "ContractorVerification_contractorId_status_createdAt_idx" ON "ContractorVerification"("contractorId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "ContractorVerification_status_createdAt_idx" ON "ContractorVerification"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "ContractorPortfolioImage" ADD CONSTRAINT "ContractorPortfolioImage_contractorId_fkey" FOREIGN KEY ("contractorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractorVerification" ADD CONSTRAINT "ContractorVerification_contractorId_fkey" FOREIGN KEY ("contractorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractorVerification" ADD CONSTRAINT "ContractorVerification_reviewedByAdminId_fkey" FOREIGN KEY ("reviewedByAdminId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
