ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'CONTACT_UNLOCKED';

CREATE TABLE "Conversation" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "contactUnlockId" UUID NOT NULL,
  "employerId" UUID NOT NULL,
  "contractorId" UUID NOT NULL,
  "lastMessageAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Conversation_contactUnlockId_key" ON "Conversation"("contactUnlockId");
CREATE INDEX "Conversation_employerId_lastMessageAt_idx" ON "Conversation"("employerId", "lastMessageAt");
CREATE INDEX "Conversation_contractorId_lastMessageAt_idx" ON "Conversation"("contractorId", "lastMessageAt");
CREATE INDEX "Conversation_createdAt_idx" ON "Conversation"("createdAt");

ALTER TABLE "Conversation"
  ADD CONSTRAINT "Conversation_contactUnlockId_fkey"
  FOREIGN KEY ("contactUnlockId") REFERENCES "ContactUnlock"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Conversation"
  ADD CONSTRAINT "Conversation_employerId_fkey"
  FOREIGN KEY ("employerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Conversation"
  ADD CONSTRAINT "Conversation_contractorId_fkey"
  FOREIGN KEY ("contractorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Message"
  ADD COLUMN "conversationId" UUID,
  ADD COLUMN "isRead" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "deletedAt" TIMESTAMP(3),
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ALTER COLUMN "chatId" DROP NOT NULL;

CREATE INDEX "Message_conversationId_createdAt_idx" ON "Message"("conversationId", "createdAt");
CREATE INDEX "Message_isRead_createdAt_idx" ON "Message"("isRead", "createdAt");

ALTER TABLE "Message"
  ADD CONSTRAINT "Message_conversationId_fkey"
  FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Notification"
  ADD COLUMN "isRead" BOOLEAN NOT NULL DEFAULT false;

UPDATE "Notification" SET "isRead" = true WHERE "readAt" IS NOT NULL;
CREATE INDEX "Notification_userId_isRead_createdAt_idx" ON "Notification"("userId", "isRead", "createdAt");
