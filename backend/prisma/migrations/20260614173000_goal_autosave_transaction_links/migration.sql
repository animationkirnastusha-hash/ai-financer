-- Link auto-save goal transfers to the income transaction that created them.
ALTER TABLE "Transaction" ADD COLUMN "sourceTransactionId" TEXT;
ALTER TABLE "Transaction" ADD COLUMN "goalId" TEXT;

CREATE INDEX "Transaction_sourceTransactionId_idx" ON "Transaction"("sourceTransactionId");
CREATE INDEX "Transaction_goalId_idx" ON "Transaction"("goalId");
