-- AlterTable
ALTER TABLE "AiConversation" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "AiJobDraft" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "AiMessage" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "AiUsage" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "AuditLog" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "ContractorRatingSummary" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "ContractorServiceCategory" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "ContractorServiceLocation" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "JobCompletion" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "NotificationPreference" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Payment" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "PushToken" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "StoreProduct" ALTER COLUMN "id" DROP DEFAULT;

-- RenameIndex
ALTER INDEX "ContractorServiceCategory_contractorId_categoryKey_subcategoryK" RENAME TO "ContractorServiceCategory_contractorId_categoryKey_subcateg_key";
