WITH ranked_revenuecat_transactions AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "revenueCatTransactionId"
      ORDER BY "createdAt" ASC, "id" ASC
    ) AS duplicate_rank
  FROM "Payment"
  WHERE "revenueCatTransactionId" IS NOT NULL
)
UPDATE "Payment"
SET
  "revenueCatTransactionId" = NULL,
  "failureReason" = COALESCE("failureReason", 'Duplicate RevenueCat transaction id cleared before unique constraint')
WHERE "id" IN (
  SELECT "id"
  FROM ranked_revenuecat_transactions
  WHERE duplicate_rank > 1
);

CREATE UNIQUE INDEX "Payment_revenueCatTransactionId_key" ON "Payment"("revenueCatTransactionId");
