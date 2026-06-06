CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "premiumUntil" DATETIME,
    "businessUntil" DATETIME,
    "trialStartedAt" DATETIME,
    "trialUntil" DATETIME,
    "premiumLifetime" BOOLEAN NOT NULL DEFAULT false,
    "businessLifetime" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "Subscription_userId_key" ON "Subscription"("userId");
CREATE INDEX "Subscription_premiumUntil_idx" ON "Subscription"("premiumUntil");
CREATE INDEX "Subscription_businessUntil_idx" ON "Subscription"("businessUntil");
CREATE INDEX "Subscription_trialUntil_idx" ON "Subscription"("trialUntil");
