CREATE TABLE "StorePaymentOrder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "product" TEXT NOT NULL,
    "duration" TEXT NOT NULL DEFAULT 'month',
    "provider" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "payload" TEXT,
    "paidAt" DATETIME,
    "expiresAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "StorePaymentOrder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "StorePaymentOrder_userId_idx" ON "StorePaymentOrder"("userId");
CREATE INDEX "StorePaymentOrder_status_idx" ON "StorePaymentOrder"("status");
CREATE INDEX "StorePaymentOrder_provider_idx" ON "StorePaymentOrder"("provider");
CREATE INDEX "StorePaymentOrder_createdAt_idx" ON "StorePaymentOrder"("createdAt");
