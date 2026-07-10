-- Distinguish a user-requested account deactivation from an admin suspension.
ALTER TABLE "User"
ADD COLUMN "deactivatedAt" TIMESTAMP(3);
