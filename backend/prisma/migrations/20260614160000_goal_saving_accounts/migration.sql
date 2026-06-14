-- Goal saving accounts and automatic income allocation.
ALTER TABLE "Goal" ADD COLUMN "autoSavePercent" INTEGER NOT NULL DEFAULT 0;
