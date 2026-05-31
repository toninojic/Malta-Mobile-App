CREATE TYPE "ContactUnlockStatus" AS ENUM ('PENDING', 'UNLOCKED');

ALTER TABLE "ContactUnlock"
  ADD COLUMN "unlockedByContractorId" UUID,
  ADD COLUMN "status" "ContactUnlockStatus" NOT NULL DEFAULT 'UNLOCKED',
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "ContactUnlock"
SET "unlockedByContractorId" = "contractorId"
WHERE "unlockedByContractorId" IS NULL;

ALTER TABLE "ContactUnlock" ALTER COLUMN "status" SET DEFAULT 'PENDING';
ALTER TABLE "ContactUnlock" ALTER COLUMN "tokenTransactionId" DROP NOT NULL;

CREATE INDEX "ContactUnlock_status_idx" ON "ContactUnlock"("status");

ALTER TABLE "ContactUnlock"
  ADD CONSTRAINT "ContactUnlock_unlockedByContractorId_fkey"
  FOREIGN KEY ("unlockedByContractorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
