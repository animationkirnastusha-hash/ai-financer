CREATE TABLE "ReceiptScan" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "sizeBytes" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'uploaded',
  "merchant" TEXT,
  "totalAmount" INTEGER,
  "currency" TEXT NOT NULL DEFAULT 'RUB',
  "purchasedAt" DATETIME,
  "rawText" TEXT,
  "preview" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "ReceiptScan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "ReceiptScan_userId_idx" ON "ReceiptScan"("userId");
CREATE INDEX "ReceiptScan_status_idx" ON "ReceiptScan"("status");
CREATE INDEX "ReceiptScan_createdAt_idx" ON "ReceiptScan"("createdAt");
