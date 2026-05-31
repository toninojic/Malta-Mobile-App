ALTER TABLE "TokenPackage" ADD COLUMN "price" DECIMAL(12,2);
UPDATE "TokenPackage" SET "price" = ROUND(("priceCents"::DECIMAL / 100), 2);
ALTER TABLE "TokenPackage" ALTER COLUMN "price" SET NOT NULL;
ALTER TABLE "TokenPackage" RENAME COLUMN "active" TO "isActive";
ALTER TABLE "TokenPackage" DROP COLUMN "priceCents";

ALTER TABLE "UserTokenBalance" DROP CONSTRAINT "UserTokenBalance_pkey";
ALTER TABLE "UserTokenBalance"
  ADD COLUMN "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "UserTokenBalance" ADD CONSTRAINT "UserTokenBalance_pkey" PRIMARY KEY ("id");
CREATE UNIQUE INDEX "UserTokenBalance_userId_key" ON "UserTokenBalance"("userId");

ALTER TABLE "TokenTransaction"
  ADD COLUMN "description" VARCHAR(500) NOT NULL DEFAULT 'Token transaction',
  ADD COLUMN "relatedRefundRequestId" UUID;
CREATE UNIQUE INDEX "TokenTransaction_relatedRefundRequestId_key" ON "TokenTransaction"("relatedRefundRequestId");

ALTER TABLE "RefundRequest" RENAME COLUMN "transactionId" TO "tokenTransactionId";
ALTER TABLE "RefundRequest" RENAME COLUMN "amountTokens" TO "amount";
ALTER TABLE "RefundRequest" RENAME COLUMN "reviewedById" TO "reviewedByAdminId";
ALTER TABLE "RefundRequest" ALTER COLUMN "tokenTransactionId" SET NOT NULL;

ALTER TABLE "TokenTransaction"
  ADD CONSTRAINT "TokenTransaction_relatedRefundRequestId_fkey"
  FOREIGN KEY ("relatedRefundRequestId") REFERENCES "RefundRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
