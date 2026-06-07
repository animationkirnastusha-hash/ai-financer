ALTER TABLE "StorePaymentOrder" ADD COLUMN "baseAmount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "StorePaymentOrder" ADD COLUMN "discountPercent" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "StorePaymentOrder" ADD COLUMN "telegramInvoiceLink" TEXT;
ALTER TABLE "StorePaymentOrder" ADD COLUMN "telegramPaymentChargeId" TEXT;
ALTER TABLE "StorePaymentOrder" ADD COLUMN "providerPaymentChargeId" TEXT;
CREATE INDEX "StorePaymentOrder_telegramPaymentChargeId_idx" ON "StorePaymentOrder"("telegramPaymentChargeId");
