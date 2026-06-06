-- Spending limits for accounts, categories and total expenses
CREATE TABLE "SpendingLimit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "accountId" TEXT,
    "categoryId" TEXT,
    "amount" INTEGER NOT NULL,
    "period" TEXT NOT NULL DEFAULT 'monthly',
    "notifyAt" INTEGER NOT NULL DEFAULT 80,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SpendingLimit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SpendingLimit_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SpendingLimit_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "SpendingLimit_userId_idx" ON "SpendingLimit"("userId");
CREATE INDEX "SpendingLimit_targetType_idx" ON "SpendingLimit"("targetType");
CREATE INDEX "SpendingLimit_accountId_idx" ON "SpendingLimit"("accountId");
CREATE INDEX "SpendingLimit_categoryId_idx" ON "SpendingLimit"("categoryId");
CREATE INDEX "SpendingLimit_isActive_idx" ON "SpendingLimit"("isActive");
