import { prisma } from '../../lib/prisma';
import { aiIdempotencyService } from './ai-idempotency.service';
import { aiRateLimitService } from './ai-rate-limit.service';

let started = false;

export class AICleanupService {
  start() {
    if (started) return;
    started = true;

    const intervalMs = Number(process.env.AI_CLEANUP_INTERVAL_MS ?? 1000 * 60 * 10);

    setInterval(() => {
      this.runOnce().catch((error) => {
        console.error('[AI_CLEANUP] failed', error instanceof Error ? error.message : String(error));
      });
    }, intervalMs).unref();

    this.runOnce().catch(() => null);
  }

  async runOnce() {
    aiRateLimitService.cleanup();

    const [expiredPending, expiredSessions, expiredIdempotency] = await Promise.all([
      prisma.aIPendingAction.updateMany({
        where: {
          status: 'pending',
          expiresAt: { lte: new Date() },
        },
        data: { status: 'expired' },
      }).catch(() => ({ count: 0 })),

      prisma.aISessionState.deleteMany({
        where: {
          expiresAt: { lte: new Date() },
        },
      }).catch(() => ({ count: 0 })),

      aiIdempotencyService.cleanup(),
    ]);

    return {
      expiredPending: expiredPending.count,
      expiredSessions: expiredSessions.count,
      expiredIdempotency,
    };
  }
}

export const aiCleanupService = new AICleanupService();
