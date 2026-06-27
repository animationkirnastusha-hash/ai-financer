-- Remove the old Business workspace product from the base app.
-- Payment/subscription infrastructure stays in place; Business becomes a separate product later.

PRAGMA foreign_keys=OFF;

DROP TABLE IF EXISTS "BusinessWorkspace";

CREATE TABLE "new_Subscription" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "premiumUntil" DATETIME,
    "trialStartedAt" DATETIME,
    "trialUntil" DATETIME,
    "premiumLifetime" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "new_Subscription" ("id", "userId", "premiumUntil", "trialStartedAt", "trialUntil", "premiumLifetime", "createdAt", "updatedAt")
SELECT "id", "userId", "premiumUntil", "trialStartedAt", "trialUntil", "premiumLifetime", "createdAt", "updatedAt"
FROM "Subscription";

DROP TABLE "Subscription";
ALTER TABLE "new_Subscription" RENAME TO "Subscription";

CREATE UNIQUE INDEX "Subscription_userId_key" ON "Subscription"("userId");
CREATE INDEX "Subscription_premiumUntil_idx" ON "Subscription"("premiumUntil");
CREATE INDEX "Subscription_trialUntil_idx" ON "Subscription"("trialUntil");

PRAGMA foreign_keys=ON;
