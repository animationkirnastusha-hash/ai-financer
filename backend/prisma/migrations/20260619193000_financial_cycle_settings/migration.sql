-- CreateTable
CREATE TABLE "FinancialCycleSettings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "salaryDay" INTEGER,
    "salaryAmount" INTEGER NOT NULL DEFAULT 0,
    "salaryCurrency" TEXT NOT NULL DEFAULT 'RUB',
    "salaryAccountId" TEXT,
    "salaryPeriod" TEXT NOT NULL DEFAULT 'monthly',
    "remindBeforeDays" INTEGER NOT NULL DEFAULT 0,
    "autoCreateIncome" BOOLEAN NOT NULL DEFAULT false,
    "autoDistributeGoals" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "FinancialCycleSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "FinancialCycleSettings_userId_key" ON "FinancialCycleSettings"("userId");

-- CreateIndex
CREATE INDEX "FinancialCycleSettings_userId_idx" ON "FinancialCycleSettings"("userId");

-- CreateIndex
CREATE INDEX "FinancialCycleSettings_salaryDay_idx" ON "FinancialCycleSettings"("salaryDay");

-- CreateIndex
CREATE INDEX "FinancialCycleSettings_salaryAccountId_idx" ON "FinancialCycleSettings"("salaryAccountId");
