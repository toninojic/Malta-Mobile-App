ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'REPORT_STATUS_UPDATED';

CREATE TYPE "ReportTargetType" AS ENUM (
  'USER',
  'JOB',
  'OFFER',
  'CONVERSATION',
  'MESSAGE',
  'REVIEW'
);

CREATE TYPE "ReportReason" AS ENUM (
  'SPAM',
  'SCAM_OR_FRAUD',
  'HARASSMENT',
  'INAPPROPRIATE_CONTENT',
  'FAKE_PROFILE',
  'CONTACT_DETAILS_BYPASS',
  'PAYMENT_ISSUE',
  'OTHER'
);

CREATE TYPE "ReportStatus" AS ENUM (
  'PENDING',
  'UNDER_REVIEW',
  'RESOLVED',
  'DISMISSED'
);

CREATE TABLE "Report" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "reporterId" UUID NOT NULL,
  "targetType" "ReportTargetType" NOT NULL,
  "targetId" UUID NOT NULL,
  "reason" "ReportReason" NOT NULL,
  "description" VARCHAR(1500),
  "status" "ReportStatus" NOT NULL DEFAULT 'PENDING',
  "reviewedByAdminId" UUID,
  "adminNote" VARCHAR(1500),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "reviewedAt" TIMESTAMP(3),

  CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Report"
  ADD CONSTRAINT "Report_reporterId_fkey"
  FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Report"
  ADD CONSTRAINT "Report_reviewedByAdminId_fkey"
  FOREIGN KEY ("reviewedByAdminId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Report_reporterId_createdAt_idx" ON "Report"("reporterId", "createdAt");
CREATE INDEX "Report_targetType_targetId_idx" ON "Report"("targetType", "targetId");
CREATE INDEX "Report_status_createdAt_idx" ON "Report"("status", "createdAt");
CREATE INDEX "Report_createdAt_idx" ON "Report"("createdAt");
