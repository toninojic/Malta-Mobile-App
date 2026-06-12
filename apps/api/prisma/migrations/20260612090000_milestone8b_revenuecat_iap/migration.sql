ALTER TYPE "PaymentStatus" ADD VALUE 'COMPLETED';
ALTER TYPE "PaymentStatus" ADD VALUE 'IGNORED';

CREATE TYPE "PaymentProvider" AS ENUM ('MOCK', 'REVENUECAT', 'LEGACY_STRIPE');
CREATE TYPE "StorePlatform" AS ENUM ('IOS', 'ANDROID', 'REVENUECAT');

ALTER TABLE "Payment"
  ADD COLUMN "provider" "PaymentProvider" NOT NULL DEFAULT 'LEGACY_STRIPE',
  ADD COLUMN "platform" "StorePlatform",
  ADD COLUMN "platformProductId" VARCHAR(180),
  ADD COLUMN "revenueCatEventId" VARCHAR(255),
  ADD COLUMN "revenueCatTransactionId" VARCHAR(255);

CREATE TABLE "StoreProduct" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "platformProductId" VARCHAR(180) NOT NULL,
  "tokenPackageId" UUID NOT NULL,
  "platform" "StorePlatform" NOT NULL DEFAULT 'REVENUECAT',
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "StoreProduct_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Payment_revenueCatEventId_key" ON "Payment"("revenueCatEventId");
CREATE INDEX "Payment_provider_status_createdAt_idx" ON "Payment"("provider", "status", "createdAt");
CREATE INDEX "Payment_platformProductId_idx" ON "Payment"("platformProductId");
CREATE INDEX "Payment_revenueCatTransactionId_idx" ON "Payment"("revenueCatTransactionId");
CREATE UNIQUE INDEX "StoreProduct_platform_platformProductId_key" ON "StoreProduct"("platform", "platformProductId");
CREATE INDEX "StoreProduct_tokenPackageId_idx" ON "StoreProduct"("tokenPackageId");
CREATE INDEX "StoreProduct_platform_isActive_idx" ON "StoreProduct"("platform", "isActive");

ALTER TABLE "StoreProduct" ADD CONSTRAINT "StoreProduct_tokenPackageId_fkey" FOREIGN KEY ("tokenPackageId") REFERENCES "TokenPackage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
