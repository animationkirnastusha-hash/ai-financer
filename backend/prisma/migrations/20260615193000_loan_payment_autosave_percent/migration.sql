-- Align LoanPayment table with Prisma schema used by generated client.
ALTER TABLE "LoanPayment" ADD COLUMN "autoSavePercent" INTEGER NOT NULL DEFAULT 0;
