-- Obligations foundation: loans, payments and reminders.
CREATE TABLE IF NOT EXISTS "Loan" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "accountId" TEXT,
  "title" TEXT NOT NULL,
  "type" TEXT NOT NULL DEFAULT 'loan',
  "creditor" TEXT,
  "currency" TEXT NOT NULL DEFAULT 'RUB',
  "principalAmount" INTEGER NOT NULL DEFAULT 0,
  "currentDebt" INTEGER NOT NULL DEFAULT 0,
  "monthlyPayment" INTEGER NOT NULL DEFAULT 0,
  "interestRate" REAL,
  "termMonths" INTEGER,
  "paidMonths" INTEGER NOT NULL DEFAULT 0,
  "paymentDay" INTEGER,
  "nextPaymentDate" DATETIME,
  "reminderDaysBefore" INTEGER NOT NULL DEFAULT 1,
  "autoCreateExpense" BOOLEAN NOT NULL DEFAULT false,
  "status" TEXT NOT NULL DEFAULT 'active',
  "note" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "Loan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Loan_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "LoanPayment" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "loanId" TEXT NOT NULL,
  "accountId" TEXT,
  "amount" INTEGER NOT NULL,
  "paidAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "transactionId" TEXT,
  "note" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LoanPayment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "LoanPayment_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "Loan" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "ObligationReminder" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "loanId" TEXT,
  "title" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "dueDate" DATETIME NOT NULL,
  "remindAt" DATETIME NOT NULL,
  "channel" TEXT NOT NULL DEFAULT 'app',
  "status" TEXT NOT NULL DEFAULT 'scheduled',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "ObligationReminder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ObligationReminder_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "Loan" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "Loan_userId_idx" ON "Loan"("userId");
CREATE INDEX IF NOT EXISTS "Loan_status_idx" ON "Loan"("status");
CREATE INDEX IF NOT EXISTS "Loan_nextPaymentDate_idx" ON "Loan"("nextPaymentDate");
CREATE INDEX IF NOT EXISTS "Loan_accountId_idx" ON "Loan"("accountId");
CREATE INDEX IF NOT EXISTS "LoanPayment_userId_idx" ON "LoanPayment"("userId");
CREATE INDEX IF NOT EXISTS "LoanPayment_loanId_idx" ON "LoanPayment"("loanId");
CREATE INDEX IF NOT EXISTS "LoanPayment_paidAt_idx" ON "LoanPayment"("paidAt");
CREATE INDEX IF NOT EXISTS "LoanPayment_transactionId_idx" ON "LoanPayment"("transactionId");
CREATE INDEX IF NOT EXISTS "ObligationReminder_userId_idx" ON "ObligationReminder"("userId");
CREATE INDEX IF NOT EXISTS "ObligationReminder_loanId_idx" ON "ObligationReminder"("loanId");
CREATE INDEX IF NOT EXISTS "ObligationReminder_remindAt_idx" ON "ObligationReminder"("remindAt");
CREATE INDEX IF NOT EXISTS "ObligationReminder_status_idx" ON "ObligationReminder"("status");
