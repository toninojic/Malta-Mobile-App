WITH ranked_selected_offers AS (
  SELECT
    "id",
    row_number() OVER (
      PARTITION BY "jobRequestId"
      ORDER BY "updatedAt" DESC, "createdAt" DESC, "id" DESC
    ) AS row_number
  FROM "Offer"
  WHERE "status" = 'SELECTED' AND "deletedAt" IS NULL
)
UPDATE "Offer"
SET
  "status" = 'REJECTED',
  "selectedByEmployer" = false
WHERE "id" IN (
  SELECT "id"
  FROM ranked_selected_offers
  WHERE row_number > 1
);

CREATE UNIQUE INDEX IF NOT EXISTS "Offer_one_selected_offer_per_job"
ON "Offer"("jobRequestId")
WHERE "status" = 'SELECTED' AND "deletedAt" IS NULL;
