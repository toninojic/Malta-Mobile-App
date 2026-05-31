CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TYPE "UserRole" AS ENUM ('EMPLOYER', 'CONTRACTOR', 'ADMIN');
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'SUSPENDED');
CREATE TYPE "JobStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'COMPLETED', 'CLOSED');
CREATE TYPE "OfferStatus" AS ENUM ('SUBMITTED', 'SELECTED', 'WITHDRAWN');
CREATE TYPE "TokenTransactionType" AS ENUM ('PURCHASE', 'SPEND', 'REFUND');
CREATE TYPE "RefundStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
CREATE TYPE "NotificationType" AS ENUM ('NEW_OFFER', 'NEW_MESSAGE', 'REFUND_APPROVED', 'REFUND_DENIED', 'JOB_COMPLETED', 'REVIEW_RECEIVED');
CREATE TYPE "MessageType" AS ENUM ('TEXT', 'IMAGE', 'FILE', 'VOICE');

CREATE TABLE "User" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "email" VARCHAR(320) NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "role" "UserRole" NOT NULL,
  "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
  "refreshTokenHash" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UserProfile" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL,
  "displayName" VARCHAR(120) NOT NULL,
  "phone" VARCHAR(50),
  "location" VARCHAR(160),
  "bio" VARCHAR(1000),
  "avatarUrl" VARCHAR(2048),
  "companyName" VARCHAR(160),
  "tradeCategories" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "UserProfile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "JobRequest" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "employerId" UUID NOT NULL,
  "title" VARCHAR(160) NOT NULL,
  "description" VARCHAR(4000) NOT NULL,
  "category" VARCHAR(100) NOT NULL,
  "subcategory" VARCHAR(100) NOT NULL,
  "location" VARCHAR(160) NOT NULL,
  "status" "JobStatus" NOT NULL DEFAULT 'ACTIVE',
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "contractorMarkedCompletedAt" TIMESTAMP(3),
  "employerConfirmedCompletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "JobRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "JobImage" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "jobRequestId" UUID NOT NULL,
  "url" VARCHAR(2048) NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "JobImage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Offer" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "jobRequestId" UUID NOT NULL,
  "contractorId" UUID NOT NULL,
  "estimatedPrice" DECIMAL(12,2) NOT NULL,
  "estimatedCompletionDays" INTEGER NOT NULL,
  "message" VARCHAR(1500),
  "status" "OfferStatus" NOT NULL DEFAULT 'SUBMITTED',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Offer_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ContactUnlock" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "jobRequestId" UUID NOT NULL,
  "offerId" UUID NOT NULL,
  "contractorId" UUID NOT NULL,
  "employerId" UUID NOT NULL,
  "tokenTransactionId" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ContactUnlock_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Chat" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "jobRequestId" UUID NOT NULL,
  "offerId" UUID NOT NULL,
  "employerId" UUID NOT NULL,
  "contractorId" UUID NOT NULL,
  "unlockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Chat_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Message" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "chatId" UUID NOT NULL,
  "senderId" UUID NOT NULL,
  "type" "MessageType" NOT NULL DEFAULT 'TEXT',
  "content" VARCHAR(4000) NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Review" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "jobRequestId" UUID NOT NULL,
  "offerId" UUID NOT NULL,
  "employerId" UUID NOT NULL,
  "contractorId" UUID NOT NULL,
  "rating" INTEGER NOT NULL,
  "comment" VARCHAR(2000),
  "contractorResponse" VARCHAR(2000),
  "removedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TokenPackage" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "title" VARCHAR(100) NOT NULL,
  "tokenCount" INTEGER NOT NULL,
  "priceCents" INTEGER NOT NULL,
  "currency" CHAR(3) NOT NULL DEFAULT 'EUR',
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TokenPackage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UserTokenBalance" (
  "userId" UUID NOT NULL,
  "balance" INTEGER NOT NULL DEFAULT 0,
  "version" INTEGER NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "UserTokenBalance_pkey" PRIMARY KEY ("userId")
);

CREATE TABLE "TokenTransaction" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL,
  "packageId" UUID,
  "type" "TokenTransactionType" NOT NULL,
  "amount" INTEGER NOT NULL,
  "balanceAfter" INTEGER NOT NULL,
  "externalRef" VARCHAR(255),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TokenTransaction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RefundRequest" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL,
  "transactionId" UUID,
  "amountTokens" INTEGER NOT NULL,
  "status" "RefundStatus" NOT NULL DEFAULT 'PENDING',
  "reason" VARCHAR(2000) NOT NULL,
  "adminNote" VARCHAR(2000),
  "reviewedById" UUID,
  "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RefundRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Notification" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL,
  "type" "NotificationType" NOT NULL,
  "title" VARCHAR(160) NOT NULL,
  "body" VARCHAR(1000) NOT NULL,
  "data" JSONB,
  "readAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE INDEX "User_role_status_idx" ON "User"("role", "status");
CREATE UNIQUE INDEX "UserProfile_userId_key" ON "UserProfile"("userId");
CREATE INDEX "JobRequest_employerId_status_idx" ON "JobRequest"("employerId", "status");
CREATE INDEX "JobRequest_category_subcategory_location_idx" ON "JobRequest"("category", "subcategory", "location");
CREATE INDEX "JobRequest_expiresAt_idx" ON "JobRequest"("expiresAt");
CREATE INDEX "JobImage_jobRequestId_idx" ON "JobImage"("jobRequestId");
CREATE INDEX "Offer_jobRequestId_status_idx" ON "Offer"("jobRequestId", "status");
CREATE INDEX "Offer_contractorId_idx" ON "Offer"("contractorId");
CREATE UNIQUE INDEX "ContactUnlock_offerId_key" ON "ContactUnlock"("offerId");
CREATE UNIQUE INDEX "ContactUnlock_tokenTransactionId_key" ON "ContactUnlock"("tokenTransactionId");
CREATE INDEX "ContactUnlock_jobRequestId_idx" ON "ContactUnlock"("jobRequestId");
CREATE INDEX "ContactUnlock_contractorId_idx" ON "ContactUnlock"("contractorId");
CREATE INDEX "ContactUnlock_employerId_idx" ON "ContactUnlock"("employerId");
CREATE UNIQUE INDEX "Chat_offerId_key" ON "Chat"("offerId");
CREATE INDEX "Chat_jobRequestId_idx" ON "Chat"("jobRequestId");
CREATE INDEX "Chat_employerId_idx" ON "Chat"("employerId");
CREATE INDEX "Chat_contractorId_idx" ON "Chat"("contractorId");
CREATE INDEX "Message_chatId_createdAt_idx" ON "Message"("chatId", "createdAt");
CREATE INDEX "Message_senderId_idx" ON "Message"("senderId");
CREATE UNIQUE INDEX "Review_offerId_key" ON "Review"("offerId");
CREATE UNIQUE INDEX "Review_jobRequestId_contractorId_key" ON "Review"("jobRequestId", "contractorId");
CREATE INDEX "Review_contractorId_removedAt_idx" ON "Review"("contractorId", "removedAt");
CREATE UNIQUE INDEX "TokenPackage_title_key" ON "TokenPackage"("title");
CREATE INDEX "TokenTransaction_userId_createdAt_idx" ON "TokenTransaction"("userId", "createdAt");
CREATE INDEX "TokenTransaction_type_idx" ON "TokenTransaction"("type");
CREATE UNIQUE INDEX "RefundRequest_transactionId_key" ON "RefundRequest"("transactionId");
CREATE INDEX "RefundRequest_status_createdAt_idx" ON "RefundRequest"("status", "createdAt");
CREATE INDEX "RefundRequest_userId_idx" ON "RefundRequest"("userId");
CREATE INDEX "Notification_userId_readAt_createdAt_idx" ON "Notification"("userId", "readAt", "createdAt");

ALTER TABLE "UserProfile" ADD CONSTRAINT "UserProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "JobRequest" ADD CONSTRAINT "JobRequest_employerId_fkey" FOREIGN KEY ("employerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "JobImage" ADD CONSTRAINT "JobImage_jobRequestId_fkey" FOREIGN KEY ("jobRequestId") REFERENCES "JobRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_jobRequestId_fkey" FOREIGN KEY ("jobRequestId") REFERENCES "JobRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_contractorId_fkey" FOREIGN KEY ("contractorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContactUnlock" ADD CONSTRAINT "ContactUnlock_jobRequestId_fkey" FOREIGN KEY ("jobRequestId") REFERENCES "JobRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContactUnlock" ADD CONSTRAINT "ContactUnlock_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "Offer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContactUnlock" ADD CONSTRAINT "ContactUnlock_contractorId_fkey" FOREIGN KEY ("contractorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContactUnlock" ADD CONSTRAINT "ContactUnlock_employerId_fkey" FOREIGN KEY ("employerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContactUnlock" ADD CONSTRAINT "ContactUnlock_tokenTransactionId_fkey" FOREIGN KEY ("tokenTransactionId") REFERENCES "TokenTransaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Chat" ADD CONSTRAINT "Chat_jobRequestId_fkey" FOREIGN KEY ("jobRequestId") REFERENCES "JobRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Chat" ADD CONSTRAINT "Chat_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "Offer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Chat" ADD CONSTRAINT "Chat_employerId_fkey" FOREIGN KEY ("employerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Chat" ADD CONSTRAINT "Chat_contractorId_fkey" FOREIGN KEY ("contractorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Message" ADD CONSTRAINT "Message_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "Chat"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Message" ADD CONSTRAINT "Message_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Review" ADD CONSTRAINT "Review_jobRequestId_fkey" FOREIGN KEY ("jobRequestId") REFERENCES "JobRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Review" ADD CONSTRAINT "Review_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "Offer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Review" ADD CONSTRAINT "Review_employerId_fkey" FOREIGN KEY ("employerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Review" ADD CONSTRAINT "Review_contractorId_fkey" FOREIGN KEY ("contractorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserTokenBalance" ADD CONSTRAINT "UserTokenBalance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TokenTransaction" ADD CONSTRAINT "TokenTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TokenTransaction" ADD CONSTRAINT "TokenTransaction_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "TokenPackage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RefundRequest" ADD CONSTRAINT "RefundRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RefundRequest" ADD CONSTRAINT "RefundRequest_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "TokenTransaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RefundRequest" ADD CONSTRAINT "RefundRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
