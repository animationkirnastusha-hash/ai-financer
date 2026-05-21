CREATE TABLE IF NOT EXISTS "ProductEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "event" TEXT NOT NULL,
    "data" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "ProductEvent_userId_idx" ON "ProductEvent"("userId");
CREATE INDEX IF NOT EXISTS "ProductEvent_event_idx" ON "ProductEvent"("event");
CREATE INDEX IF NOT EXISTS "ProductEvent_createdAt_idx" ON "ProductEvent"("createdAt");
