import { prisma } from '../../lib/prisma';

let ensuredPromise: Promise<void> | null = null;

/**
 * Runtime guard for the product analytics table.
 *
 * The project schema already contains ProductEvent, but older server databases can
 * be behind the current Prisma schema. This keeps analytics/admin safe even when
 * the server was updated without a full migration cycle.
 */
export function ensureProductAnalyticsSchema() {
  if (!ensuredPromise) {
    ensuredPromise = prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "ProductEvent" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "userId" TEXT,
        "event" TEXT NOT NULL,
        "data" TEXT,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `)
      .then(async () => {
        await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "ProductEvent_userId_idx" ON "ProductEvent"("userId");');
        await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "ProductEvent_event_idx" ON "ProductEvent"("event");');
        await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "ProductEvent_createdAt_idx" ON "ProductEvent"("createdAt");');
      });
  }

  return ensuredPromise;
}
