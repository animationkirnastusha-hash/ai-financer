-- Relational closure for obligations, recurring payments, receipts, and AI training examples.
-- Nullable columns keep the migration safe for existing users.

ALTER TABLE "RecurringPayment" ADD COLUMN "categoryId" TEXT;
ALTER TABLE "RecurringPayment" ADD COLUMN "sectionId" TEXT;

CREATE TABLE "RecurringPaymentPayment" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "recurringPaymentId" TEXT NOT NULL,
  "accountId" TEXT,
  "transactionId" TEXT,
  "amount" INTEGER NOT NULL,
  "paidAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "note" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RecurringPaymentPayment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "RecurringPaymentPayment_recurringPaymentId_fkey" FOREIGN KEY ("recurringPaymentId") REFERENCES "RecurringPayment" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "RecurringPaymentPayment_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "RecurringPaymentPayment_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

ALTER TABLE "ObligationReminder" ADD COLUMN "recurringPaymentId" TEXT;

ALTER TABLE "ReceiptScan" ADD COLUMN "accountId" TEXT;
ALTER TABLE "ReceiptScan" ADD COLUMN "categoryId" TEXT;
ALTER TABLE "ReceiptScan" ADD COLUMN "transactionId" TEXT;

ALTER TABLE "AITrainingExample" ADD COLUMN "auditLogId" TEXT;
ALTER TABLE "AITrainingExample" ADD COLUMN "pendingActionId" TEXT;

CREATE INDEX "RecurringPayment_accountId_idx" ON "RecurringPayment"("accountId");
CREATE INDEX "RecurringPayment_categoryId_idx" ON "RecurringPayment"("categoryId");
CREATE INDEX "RecurringPayment_sectionId_idx" ON "RecurringPayment"("sectionId");

CREATE INDEX "RecurringPaymentPayment_userId_idx" ON "RecurringPaymentPayment"("userId");
CREATE INDEX "RecurringPaymentPayment_recurringPaymentId_idx" ON "RecurringPaymentPayment"("recurringPaymentId");
CREATE INDEX "RecurringPaymentPayment_accountId_idx" ON "RecurringPaymentPayment"("accountId");
CREATE INDEX "RecurringPaymentPayment_transactionId_idx" ON "RecurringPaymentPayment"("transactionId");
CREATE INDEX "RecurringPaymentPayment_paidAt_idx" ON "RecurringPaymentPayment"("paidAt");

CREATE INDEX "ObligationReminder_recurringPaymentId_idx" ON "ObligationReminder"("recurringPaymentId");

CREATE INDEX "ReceiptScan_accountId_idx" ON "ReceiptScan"("accountId");
CREATE INDEX "ReceiptScan_categoryId_idx" ON "ReceiptScan"("categoryId");
CREATE UNIQUE INDEX "ReceiptScan_transactionId_key" ON "ReceiptScan"("transactionId");

CREATE INDEX "AITrainingExample_auditLogId_idx" ON "AITrainingExample"("auditLogId");
CREATE INDEX "AITrainingExample_pendingActionId_idx" ON "AITrainingExample"("pendingActionId");
CREATE INDEX "LoanPayment_accountId_idx" ON "LoanPayment"("accountId");
