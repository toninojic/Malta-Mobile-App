-- This migration was generated before the milestone 6 tables existed in a
-- fresh migration replay. Keep it conditional so Prisma shadow databases can
-- apply the full migration history from zero.
DO $$
BEGIN
  IF to_regclass('"ContractorRatingSummary"') IS NOT NULL THEN
    ALTER TABLE "ContractorRatingSummary" ALTER COLUMN "id" DROP DEFAULT;
  END IF;

  IF to_regclass('"JobCompletion"') IS NOT NULL THEN
    ALTER TABLE "JobCompletion" ALTER COLUMN "id" DROP DEFAULT;
  END IF;
END $$;
