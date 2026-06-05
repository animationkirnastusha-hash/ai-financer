-- Notification center foundation: richer in-app notifications and user settings.
ALTER TABLE "Notification" ADD COLUMN "severity" TEXT NOT NULL DEFAULT 'info';
ALTER TABLE "Notification" ADD COLUMN "relatedEntityType" TEXT;
ALTER TABLE "Notification" ADD COLUMN "relatedEntityId" TEXT;
ALTER TABLE "Notification" ADD COLUMN "action" TEXT;
ALTER TABLE "Notification" ADD COLUMN "dueAt" DATETIME;
ALTER TABLE "Notification" ADD COLUMN "readAt" DATETIME;
ALTER TABLE "Notification" ADD COLUMN "archivedAt" DATETIME;

CREATE TABLE "NotificationSettings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "inAppEnabled" BOOLEAN NOT NULL DEFAULT true,
    "telegramEnabled" BOOLEAN NOT NULL DEFAULT true,
    "remindDaysBefore" INTEGER NOT NULL DEFAULT 1,
    "remindOnDueDate" BOOLEAN NOT NULL DEFAULT true,
    "remindOverdue" BOOLEAN NOT NULL DEFAULT true,
    "quietHoursEnabled" BOOLEAN NOT NULL DEFAULT false,
    "quietHoursFrom" TEXT,
    "quietHoursTo" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "NotificationSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "NotificationSettings_userId_key" ON "NotificationSettings"("userId");
CREATE INDEX "NotificationSettings_userId_idx" ON "NotificationSettings"("userId");
CREATE INDEX "Notification_archivedAt_idx" ON "Notification"("archivedAt");
CREATE INDEX "Notification_relatedEntityType_relatedEntityId_idx" ON "Notification"("relatedEntityType", "relatedEntityId");
CREATE INDEX "Notification_dueAt_idx" ON "Notification"("dueAt");
