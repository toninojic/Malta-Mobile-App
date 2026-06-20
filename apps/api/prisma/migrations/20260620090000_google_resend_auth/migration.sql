CREATE TYPE "UserAuthProvider" AS ENUM ('EMAIL', 'GOOGLE', 'BOTH');

ALTER TABLE "User"
  ADD COLUMN "authProvider" "UserAuthProvider" NOT NULL DEFAULT 'EMAIL',
  ADD COLUMN "googleId" VARCHAR(255),
  ADD COLUMN "emailVerifiedAt" TIMESTAMP(3),
  ADD COLUMN "emailVerificationTokenHash" TEXT,
  ADD COLUMN "emailVerificationExpiresAt" TIMESTAMP(3),
  ADD COLUMN "passwordResetTokenHash" TEXT,
  ADD COLUMN "passwordResetExpiresAt" TIMESTAMP(3),
  ADD COLUMN "passwordResetUsedAt" TIMESTAMP(3);

ALTER TABLE "User"
  ALTER COLUMN "passwordHash" DROP NOT NULL;

CREATE UNIQUE INDEX "User_googleId_key" ON "User"("googleId");
CREATE INDEX "User_emailVerificationTokenHash_idx" ON "User"("emailVerificationTokenHash");
CREATE INDEX "User_passwordResetTokenHash_idx" ON "User"("passwordResetTokenHash");
