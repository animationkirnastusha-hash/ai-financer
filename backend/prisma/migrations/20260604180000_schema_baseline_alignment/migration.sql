-- Pack 18: schema baseline alignment for the current Prisma schema.
-- This migration is intended for databases that only have the historical SQL migrations applied.
-- If your database was previously synchronized with `prisma db push` and already has these
-- tables/columns, mark this migration as applied instead of executing it:
-- npx prisma migrate resolve --applied 20260604180000_schema_baseline_alignment

-- Existing table column alignment.
ALTER TABLE "User" ADD COLUMN "xp" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN "level" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "User" ADD COLUMN "streakDays" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN "lastActiveAt" DATETIME;

ALTER TABLE "Account" ADD COLUMN "lockRename" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Account" ADD COLUMN "lockSpending" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Account" ADD COLUMN "lockTransfers" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Account" ADD COLUMN "lockBalance" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Account" ADD COLUMN "lockVisibility" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Category" ADD COLUMN "sectionId" TEXT;
ALTER TABLE "Transaction" ADD COLUMN "sectionId" TEXT;

-- Missing domain / AI / progression tables.
CREATE TABLE "Section" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "icon" TEXT,
    "color" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Section_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "ProgressionProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "companionLevel" INTEGER NOT NULL DEFAULT 1,
    "companionMood" TEXT NOT NULL DEFAULT 'neutral',
    "totalXP" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProgressionProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "AchievementDefinition" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "icon" TEXT,
    "xpReward" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "UserAchievement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "achievementId" TEXT NOT NULL,
    "unlockedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserAchievement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UserAchievement_achievementId_fkey" FOREIGN KEY ("achievementId") REFERENCES "AchievementDefinition" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "UserActivity" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" TEXT,
    "xpEarned" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserActivity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "AIAuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "command" TEXT NOT NULL,
    "intent" TEXT NOT NULL,
    "riskLevel" TEXT NOT NULL,
    "requiresConfirmation" BOOLEAN NOT NULL DEFAULT false,
    "executed" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL,
    "parsed" TEXT,
    "result" TEXT,
    "errorMessage" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "AIPendingAction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "command" TEXT NOT NULL,
    "intent" TEXT NOT NULL,
    "riskLevel" TEXT NOT NULL,
    "parsed" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "expiresAt" DATETIME NOT NULL,
    "confirmedAt" DATETIME,
    "cancelledAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "AIMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "meta" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "AITrainingExample" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "input" TEXT NOT NULL,
    "aiOutput" TEXT,
    "correctedOutput" TEXT,
    "success" BOOLEAN NOT NULL DEFAULT false,
    "error" TEXT,
    "model" TEXT,
    "latencyMs" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "UserAISettings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "preset" TEXT NOT NULL DEFAULT 'balanced',
    "defaultExpenseAccountId" TEXT,
    "defaultIncomeAccountId" TEXT,
    "autoConfirmExpenseLimit" INTEGER NOT NULL DEFAULT 500,
    "autoConfirmIncomeLimit" INTEGER NOT NULL DEFAULT 100000,
    "autoConfirmTransferLimit" INTEGER NOT NULL DEFAULT 0,
    "requireConfirmForAccountActions" BOOLEAN NOT NULL DEFAULT true,
    "companionTone" TEXT NOT NULL DEFAULT 'friendly',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserAISettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "OnboardingState" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'not_started',
    "currentStep" TEXT,
    "skipped" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" DATETIME,
    "meta" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OnboardingState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "AISessionState" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "pendingIntent" TEXT,
    "pendingTool" TEXT,
    "pendingPayload" TEXT,
    "clarification" TEXT,
    "lastCommand" TEXT,
    "lastResult" TEXT,
    "expiresAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AISessionState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "AICompanionEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "tone" TEXT NOT NULL DEFAULT 'calm',
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "payload" TEXT,
    "seen" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AICompanionEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "AIPremiumCapability" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "source" TEXT NOT NULL DEFAULT 'system',
    "meta" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AIPremiumCapability_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "AIIdempotencyRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "requestHash" TEXT,
    "response" TEXT,
    "status" TEXT NOT NULL DEFAULT 'completed',
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AIIdempotencyRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "AIOperationEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "type" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'info',
    "scope" TEXT,
    "message" TEXT,
    "payload" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AIOperationEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- Index alignment.
CREATE UNIQUE INDEX "Section_userId_name_key" ON "Section"("userId", "name");
CREATE INDEX "Section_userId_idx" ON "Section"("userId");

CREATE INDEX "Category_sectionId_idx" ON "Category"("sectionId");
CREATE INDEX "Transaction_sectionId_idx" ON "Transaction"("sectionId");

CREATE UNIQUE INDEX "ProgressionProfile_userId_key" ON "ProgressionProfile"("userId");
CREATE INDEX "ProgressionProfile_companionLevel_idx" ON "ProgressionProfile"("companionLevel");

CREATE UNIQUE INDEX "AchievementDefinition_key_key" ON "AchievementDefinition"("key");

CREATE UNIQUE INDEX "UserAchievement_userId_achievementId_key" ON "UserAchievement"("userId", "achievementId");
CREATE INDEX "UserAchievement_userId_idx" ON "UserAchievement"("userId");
CREATE INDEX "UserAchievement_achievementId_idx" ON "UserAchievement"("achievementId");

CREATE INDEX "UserActivity_userId_idx" ON "UserActivity"("userId");
CREATE INDEX "UserActivity_type_idx" ON "UserActivity"("type");
CREATE INDEX "UserActivity_createdAt_idx" ON "UserActivity"("createdAt");

CREATE INDEX "AIMessage_userId_idx" ON "AIMessage"("userId");
CREATE INDEX "AIMessage_createdAt_idx" ON "AIMessage"("createdAt");

CREATE INDEX "AITrainingExample_userId_idx" ON "AITrainingExample"("userId");
CREATE INDEX "AITrainingExample_success_idx" ON "AITrainingExample"("success");
CREATE INDEX "AITrainingExample_createdAt_idx" ON "AITrainingExample"("createdAt");

CREATE UNIQUE INDEX "UserAISettings_userId_key" ON "UserAISettings"("userId");
CREATE INDEX "UserAISettings_preset_idx" ON "UserAISettings"("preset");

CREATE UNIQUE INDEX "OnboardingState_userId_key" ON "OnboardingState"("userId");
CREATE INDEX "OnboardingState_status_idx" ON "OnboardingState"("status");

CREATE UNIQUE INDEX "AISessionState_userId_key" ON "AISessionState"("userId");
CREATE INDEX "AISessionState_expiresAt_idx" ON "AISessionState"("expiresAt");

CREATE INDEX "AICompanionEvent_userId_idx" ON "AICompanionEvent"("userId");
CREATE INDEX "AICompanionEvent_type_idx" ON "AICompanionEvent"("type");
CREATE INDEX "AICompanionEvent_seen_idx" ON "AICompanionEvent"("seen");
CREATE INDEX "AICompanionEvent_createdAt_idx" ON "AICompanionEvent"("createdAt");

CREATE UNIQUE INDEX "AIPremiumCapability_userId_key_key" ON "AIPremiumCapability"("userId", "key");
CREATE INDEX "AIPremiumCapability_key_idx" ON "AIPremiumCapability"("key");
CREATE INDEX "AIPremiumCapability_enabled_idx" ON "AIPremiumCapability"("enabled");

CREATE UNIQUE INDEX "AIIdempotencyRecord_userId_scope_key_key" ON "AIIdempotencyRecord"("userId", "scope", "key");
CREATE INDEX "AIIdempotencyRecord_expiresAt_idx" ON "AIIdempotencyRecord"("expiresAt");
CREATE INDEX "AIIdempotencyRecord_scope_idx" ON "AIIdempotencyRecord"("scope");

CREATE INDEX "AIOperationEvent_userId_idx" ON "AIOperationEvent"("userId");
CREATE INDEX "AIOperationEvent_type_idx" ON "AIOperationEvent"("type");
CREATE INDEX "AIOperationEvent_severity_idx" ON "AIOperationEvent"("severity");
CREATE INDEX "AIOperationEvent_createdAt_idx" ON "AIOperationEvent"("createdAt");
