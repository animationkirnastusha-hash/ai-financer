import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

dotenv.config({ override: false });

const BASELINE_MIGRATION = '20260604180000_schema_baseline_alignment';

const required = {
  User: ['xp', 'level', 'streakDays', 'lastActiveAt'],
  Account: ['lockRename', 'lockSpending', 'lockTransfers', 'lockBalance', 'lockVisibility'],
  Category: ['sectionId'],
  Transaction: ['sectionId', 'title'],
  Section: ['id', 'userId', 'name', 'createdAt', 'updatedAt'],
  ProgressionProfile: ['id', 'userId', 'companionLevel', 'companionMood', 'totalXP'],
  AchievementDefinition: ['id', 'key', 'title', 'description', 'xpReward'],
  UserAchievement: ['id', 'userId', 'achievementId', 'unlockedAt'],
  UserActivity: ['id', 'userId', 'type', 'xpEarned', 'createdAt'],
  AIAuditLog: ['id', 'userId', 'command', 'intent', 'riskLevel', 'status'],
  AIPendingAction: ['id', 'userId', 'command', 'intent', 'riskLevel', 'expiresAt'],
  AIMessage: ['id', 'userId', 'role', 'content', 'createdAt'],
  AITrainingExample: ['id', 'input', 'success', 'createdAt'],
  ProductEvent: ['id', 'event', 'createdAt'],
  UserAISettings: ['id', 'userId', 'preset', 'autoConfirmExpenseLimit'],
  OnboardingState: ['id', 'userId', 'status', 'createdAt'],
  AISessionState: ['id', 'userId', 'lastCommand', 'lastResult'],
  AICompanionEvent: ['id', 'userId', 'type', 'title', 'message'],
  AIPremiumCapability: ['id', 'userId', 'key', 'enabled'],
  AIIdempotencyRecord: ['id', 'userId', 'key', 'scope', 'expiresAt'],
  AIOperationEvent: ['id', 'type', 'severity', 'createdAt'],
};

const prisma = new PrismaClient();

function quoteIdent(name) {
  return String(name).replaceAll('"', '""');
}

async function main() {
  const rows = await prisma.$queryRawUnsafe(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
  );
  const existingTables = new Set(rows.map((row) => row.name));
  const missing = [];

  for (const [table, columns] of Object.entries(required)) {
    if (!existingTables.has(table)) {
      missing.push({ table, missingColumns: columns, reason: 'table_missing' });
      continue;
    }

    const info = await prisma.$queryRawUnsafe(`PRAGMA table_info("${quoteIdent(table)}")`);
    const existingColumns = new Set(info.map((row) => row.name));
    const missingColumns = columns.filter((column) => !existingColumns.has(column));
    if (missingColumns.length > 0) {
      missing.push({ table, missingColumns, reason: 'columns_missing' });
    }
  }

  const migrationsTable = existingTables.has('_prisma_migrations');
  let baselineApplied = false;
  if (migrationsTable) {
    const appliedRows = await prisma.$queryRawUnsafe(
      'SELECT migration_name, finished_at FROM _prisma_migrations WHERE migration_name = ? LIMIT 1',
      BASELINE_MIGRATION
    );
    baselineApplied = appliedRows.some((row) => row.finished_at !== null && row.finished_at !== undefined);
  }

  const aligned = missing.length === 0;
  const report = {
    success: true,
    baselineMigration: BASELINE_MIGRATION,
    aligned,
    baselineApplied,
    missing,
    nextStep: aligned
      ? baselineApplied
        ? 'OK: schema is aligned and baseline migration is already applied.'
        : `Schema is already aligned. Mark baseline as applied: npx prisma migrate resolve --applied ${BASELINE_MIGRATION}`
      : 'Schema is missing tables/columns. Back up the DB, then run: npx prisma migrate deploy && npx prisma generate',
  };

  console.log(JSON.stringify(report, null, 2));
  process.exit(aligned ? 0 : 2);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
