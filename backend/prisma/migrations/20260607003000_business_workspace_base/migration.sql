-- Business workspace base for separate Business access.
CREATE TABLE "BusinessWorkspace" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "profileType" TEXT NOT NULL DEFAULT 'self_employed',
  "displayName" TEXT,
  "taxMode" TEXT,
  "incomeAccountId" TEXT,
  "expenseAccountId" TEXT,
  "monthlyIncomePlan" INTEGER NOT NULL DEFAULT 0,
  "monthlyExpensePlan" INTEGER NOT NULL DEFAULT 0,
  "reminderDay" INTEGER,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "BusinessWorkspace_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "BusinessWorkspace_incomeAccountId_fkey" FOREIGN KEY ("incomeAccountId") REFERENCES "Account" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "BusinessWorkspace_expenseAccountId_fkey" FOREIGN KEY ("expenseAccountId") REFERENCES "Account" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "BusinessWorkspace_userId_key" ON "BusinessWorkspace"("userId");
CREATE INDEX "BusinessWorkspace_profileType_idx" ON "BusinessWorkspace"("profileType");
CREATE INDEX "BusinessWorkspace_incomeAccountId_idx" ON "BusinessWorkspace"("incomeAccountId");
CREATE INDEX "BusinessWorkspace_expenseAccountId_idx" ON "BusinessWorkspace"("expenseAccountId");
