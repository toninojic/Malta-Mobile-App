UPDATE "JobRequest" SET "category" = 'electrical' WHERE "category" = 'Electrical';
UPDATE "JobRequest" SET "category" = 'painting' WHERE "category" = 'Painting';
UPDATE "JobRequest" SET "subcategory" = 'wiring' WHERE "subcategory" IN ('Wiring', 'Rewiring');
UPDATE "JobRequest" SET "subcategory" = 'repairs' WHERE "subcategory" = 'Sockets';
UPDATE "JobRequest" SET "subcategory" = 'interior' WHERE "subcategory" = 'Interior';

DROP INDEX IF EXISTS "Offer_contractorId_jobRequestId_key";
