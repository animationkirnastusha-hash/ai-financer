-- Raise the default auto-confirm threshold for everyday expenses.
-- Existing conservative users keep strict settings; only old default/simple values are moved to the new balanced baseline.
UPDATE "UserAISettings"
SET "autoConfirmExpenseLimit" = 5000
WHERE "autoConfirmExpenseLimit" IN (500, 1000);

UPDATE "UserAISettings"
SET "autoConfirmIncomeLimit" = 200000
WHERE "autoConfirmIncomeLimit" = 100000;
