-- DropForeignKey
ALTER TABLE "ContactUnlock" DROP CONSTRAINT "ContactUnlock_tokenTransactionId_fkey";

-- DropForeignKey
ALTER TABLE "RefundRequest" DROP CONSTRAINT "RefundRequest_transactionId_fkey";

-- AlterTable
ALTER TABLE "ContactUnlock" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "TokenTransaction" ALTER COLUMN "description" DROP DEFAULT;

-- AlterTable
ALTER TABLE "UserTokenBalance" ALTER COLUMN "id" DROP DEFAULT;

-- RenameForeignKey
ALTER TABLE "RefundRequest" RENAME CONSTRAINT "RefundRequest_reviewedById_fkey" TO "RefundRequest_reviewedByAdminId_fkey";

-- AddForeignKey
ALTER TABLE "ContactUnlock" ADD CONSTRAINT "ContactUnlock_tokenTransactionId_fkey" FOREIGN KEY ("tokenTransactionId") REFERENCES "TokenTransaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefundRequest" ADD CONSTRAINT "RefundRequest_tokenTransactionId_fkey" FOREIGN KEY ("tokenTransactionId") REFERENCES "TokenTransaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "RefundRequest_transactionId_key" RENAME TO "RefundRequest_tokenTransactionId_key";
