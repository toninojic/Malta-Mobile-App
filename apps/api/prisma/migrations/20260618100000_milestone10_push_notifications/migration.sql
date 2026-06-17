ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'NEW_JOB_NEARBY';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'REFUND_REJECTED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'SYSTEM_ALERT';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'NEW_REPORT';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'NEW_VERIFICATION_REQUEST';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'NEW_REFUND_REQUEST';

CREATE TABLE "PushToken" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL,
  "expoPushToken" VARCHAR(255) NOT NULL,
  "platform" VARCHAR(20) NOT NULL,
  "deviceId" VARCHAR(180),
  "deviceName" VARCHAR(180),
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PushToken_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "NotificationPreference" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL,
  "newJobsNearMe" BOOLEAN NOT NULL DEFAULT false,
  "offerUpdates" BOOLEAN NOT NULL DEFAULT true,
  "messages" BOOLEAN NOT NULL DEFAULT true,
  "reviews" BOOLEAN NOT NULL DEFAULT true,
  "paymentsRefunds" BOOLEAN NOT NULL DEFAULT true,
  "systemAlerts" BOOLEAN NOT NULL DEFAULT true,
  "adminAlerts" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ContractorServiceLocation" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "contractorId" UUID NOT NULL,
  "locationKey" VARCHAR(120) NOT NULL,
  "locationLabel" VARCHAR(160) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ContractorServiceLocation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ContractorServiceCategory" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "contractorId" UUID NOT NULL,
  "categoryKey" VARCHAR(100) NOT NULL,
  "subcategoryKey" VARCHAR(100),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ContractorServiceCategory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PushToken_expoPushToken_key" ON "PushToken"("expoPushToken");
CREATE INDEX "PushToken_userId_isActive_idx" ON "PushToken"("userId", "isActive");
CREATE INDEX "PushToken_platform_isActive_idx" ON "PushToken"("platform", "isActive");
CREATE INDEX "PushToken_lastUsedAt_idx" ON "PushToken"("lastUsedAt");

CREATE UNIQUE INDEX "NotificationPreference_userId_key" ON "NotificationPreference"("userId");

CREATE UNIQUE INDEX "ContractorServiceLocation_contractorId_locationKey_key" ON "ContractorServiceLocation"("contractorId", "locationKey");
CREATE INDEX "ContractorServiceLocation_locationKey_idx" ON "ContractorServiceLocation"("locationKey");

CREATE UNIQUE INDEX "ContractorServiceCategory_contractorId_categoryKey_subcategoryKey_key" ON "ContractorServiceCategory"("contractorId", "categoryKey", "subcategoryKey");
CREATE INDEX "ContractorServiceCategory_categoryKey_subcategoryKey_idx" ON "ContractorServiceCategory"("categoryKey", "subcategoryKey");

ALTER TABLE "PushToken" ADD CONSTRAINT "PushToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NotificationPreference" ADD CONSTRAINT "NotificationPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContractorServiceLocation" ADD CONSTRAINT "ContractorServiceLocation_contractorId_fkey" FOREIGN KEY ("contractorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContractorServiceCategory" ADD CONSTRAINT "ContractorServiceCategory_contractorId_fkey" FOREIGN KEY ("contractorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
