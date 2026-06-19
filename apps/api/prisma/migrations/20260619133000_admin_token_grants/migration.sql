ALTER TYPE "TokenTransactionType" ADD VALUE IF NOT EXISTS 'ADMIN_GRANT';
ALTER TYPE "TokenTransactionType" ADD VALUE IF NOT EXISTS 'ADMIN_REVOKE';
ALTER TYPE "TokenTransactionType" ADD VALUE IF NOT EXISTS 'WELCOME_BONUS';
ALTER TYPE "TokenTransactionType" ADD VALUE IF NOT EXISTS 'REFERRAL_BONUS';

ALTER TABLE "User"
  ADD COLUMN "contractorOnboardingRequiredAt" TIMESTAMP(3),
  ADD COLUMN "contractorOnboardingCompletedAt" TIMESTAMP(3),
  ADD COLUMN "contractorOnboardingSkippedAt" TIMESTAMP(3),
  ADD COLUMN "welcomeBonusGrantedAt" TIMESTAMP(3);

CREATE INDEX "User_role_welcomeBonusGrantedAt_idx" ON "User"("role", "welcomeBonusGrantedAt");
