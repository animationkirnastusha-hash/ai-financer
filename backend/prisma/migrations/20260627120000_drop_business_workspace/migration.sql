-- Remove the old Business workspace product from the base app.
DROP INDEX IF EXISTS "BusinessWorkspace_profileType_idx";
DROP INDEX IF EXISTS "BusinessWorkspace_incomeAccountId_idx";
DROP INDEX IF EXISTS "BusinessWorkspace_expenseAccountId_idx";
DROP TABLE IF EXISTS "BusinessWorkspace";
DROP INDEX IF EXISTS "Subscription_businessUntil_idx";
ALTER TABLE "Subscription" DROP COLUMN "businessUntil";
ALTER TABLE "Subscription" DROP COLUMN "businessLifetime";
