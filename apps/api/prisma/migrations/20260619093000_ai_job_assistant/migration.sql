CREATE TYPE "AiConversationStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'DISCARDED');
CREATE TYPE "AiMessageRole" AS ENUM ('USER', 'ASSISTANT');
CREATE TYPE "AiJobDraftStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'DISCARDED');

CREATE TABLE "AiConversation" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "employerId" UUID NOT NULL,
  "status" "AiConversationStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AiConversation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AiMessage" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "conversationId" UUID NOT NULL,
  "role" "AiMessageRole" NOT NULL,
  "content" VARCHAR(2000) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AiMessage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AiJobDraft" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "conversationId" UUID NOT NULL,
  "employerId" UUID NOT NULL,
  "title" VARCHAR(160) NOT NULL,
  "description" VARCHAR(4000) NOT NULL,
  "categoryKey" VARCHAR(100) NOT NULL,
  "subcategoryKey" VARCHAR(100) NOT NULL,
  "locationKey" VARCHAR(120) NOT NULL,
  "status" "AiJobDraftStatus" NOT NULL DEFAULT 'DRAFT',
  "publishedJobId" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AiJobDraft_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AiUsage" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL,
  "dateUtc" DATE NOT NULL,
  "userMessageCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AiUsage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AiConversation_employerId_status_updatedAt_idx" ON "AiConversation"("employerId", "status", "updatedAt");
CREATE INDEX "AiMessage_conversationId_createdAt_idx" ON "AiMessage"("conversationId", "createdAt");
CREATE INDEX "AiMessage_role_createdAt_idx" ON "AiMessage"("role", "createdAt");
CREATE UNIQUE INDEX "AiJobDraft_conversationId_key" ON "AiJobDraft"("conversationId");
CREATE INDEX "AiJobDraft_employerId_status_updatedAt_idx" ON "AiJobDraft"("employerId", "status", "updatedAt");
CREATE INDEX "AiJobDraft_categoryKey_subcategoryKey_locationKey_idx" ON "AiJobDraft"("categoryKey", "subcategoryKey", "locationKey");
CREATE UNIQUE INDEX "AiUsage_userId_dateUtc_key" ON "AiUsage"("userId", "dateUtc");
CREATE INDEX "AiUsage_dateUtc_idx" ON "AiUsage"("dateUtc");

ALTER TABLE "AiConversation" ADD CONSTRAINT "AiConversation_employerId_fkey" FOREIGN KEY ("employerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiMessage" ADD CONSTRAINT "AiMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "AiConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiJobDraft" ADD CONSTRAINT "AiJobDraft_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "AiConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiJobDraft" ADD CONSTRAINT "AiJobDraft_employerId_fkey" FOREIGN KEY ("employerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiUsage" ADD CONSTRAINT "AiUsage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
