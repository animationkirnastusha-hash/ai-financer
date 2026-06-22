-- Store payment provider fields for YooKassa/SBP redirects and webhook reconciliation.
ALTER TABLE "StorePaymentOrder" ADD COLUMN "checkoutUrl" TEXT;
ALTER TABLE "StorePaymentOrder" ADD COLUMN "providerPayload" TEXT;
ALTER TABLE "StorePaymentOrder" ADD COLUMN "cancelledAt" DATETIME;
