ALTER TYPE "OfferRejectionReason" ADD VALUE IF NOT EXISTS 'JOB_CLOSED';

CREATE TABLE "AnalyticsEvent" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "userId" UUID,
  "role" "UserRole",
  "sessionId" VARCHAR(120) NOT NULL,
  "eventName" VARCHAR(120) NOT NULL,
  "screen" VARCHAR(120) NOT NULL,
  "entityType" VARCHAR(60),
  "entityId" VARCHAR(120),
  "metadata" JSONB,
  "platform" VARCHAR(40) NOT NULL,
  "appVersion" VARCHAR(40),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AnalyticsEvent_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "AnalyticsEvent"
  ADD CONSTRAINT "AnalyticsEvent_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "AnalyticsEvent_createdAt_idx" ON "AnalyticsEvent"("createdAt");
CREATE INDEX "AnalyticsEvent_userId_idx" ON "AnalyticsEvent"("userId");
CREATE INDEX "AnalyticsEvent_eventName_idx" ON "AnalyticsEvent"("eventName");
CREATE INDEX "AnalyticsEvent_screen_idx" ON "AnalyticsEvent"("screen");
CREATE INDEX "AnalyticsEvent_role_idx" ON "AnalyticsEvent"("role");
