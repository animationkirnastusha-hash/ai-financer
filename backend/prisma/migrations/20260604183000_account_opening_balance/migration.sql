-- Preserve account starting balances separately from current balances.
-- openingBalance is reconstructed as current balance minus the current transaction delta.
ALTER TABLE "Account" ADD COLUMN "openingBalance" INTEGER NOT NULL DEFAULT 0;

UPDATE "Account"
SET "openingBalance" = "balance" - COALESCE((
  SELECT SUM(
    CASE
      WHEN "Transaction"."type" = 'income' AND "Transaction"."accountId" = "Account"."id" THEN "Transaction"."amount"
      WHEN "Transaction"."type" = 'expense' AND "Transaction"."accountId" = "Account"."id" THEN -"Transaction"."amount"
      WHEN "Transaction"."type" = 'transfer' AND "Transaction"."accountId" = "Account"."id" THEN -"Transaction"."amount"
      WHEN "Transaction"."type" = 'transfer' AND "Transaction"."toAccountId" = "Account"."id" THEN "Transaction"."amount"
      ELSE 0
    END
  )
  FROM "Transaction"
  WHERE "Transaction"."userId" = "Account"."userId"
    AND ("Transaction"."accountId" = "Account"."id" OR "Transaction"."toAccountId" = "Account"."id")
), 0);
