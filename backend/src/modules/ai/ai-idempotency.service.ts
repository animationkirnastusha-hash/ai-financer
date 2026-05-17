import { createHash } from 'node:crypto';
import { prisma } from '../../lib/prisma';

const DEFAULT_TTL_MS = Number(process.env.AI_IDEMPOTENCY_TTL_MS ?? 1000 * 60 * 20);

function stringify(value: unknown) {
  try {
    return JSON.stringify(value);
  } catch {
    return JSON.stringify({ raw: String(value) });
  }
}

function parse(value: string | null) {
  if (!value) return null;

  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

export class AIIdempotencyService {
  hashPayload(payload: unknown) {
    return createHash('sha256').update(stringify(payload)).digest('hex');
  }

  async get(userId: string, scope: string, key: string, requestHash?: string) {
    if (!key) return null;

    const row = await prisma.aIIdempotencyRecord.findUnique({
      where: {
        userId_scope_key: {
          userId,
          scope,
          key,
        },
      },
    }).catch(() => null);

    if (!row) return null;

    if (row.expiresAt.getTime() <= Date.now()) {
      await prisma.aIIdempotencyRecord.deleteMany({ where: { id: row.id } }).catch(() => null);
      return null;
    }

    if (requestHash && row.requestHash && row.requestHash !== requestHash) {
      return {
        conflict: true,
        response: null,
      };
    }

    return {
      conflict: false,
      response: parse(row.response),
    };
  }

  async save(userId: string, scope: string, key: string, requestHash: string, response: unknown) {
    if (!key) return;

    await prisma.aIIdempotencyRecord.upsert({
      where: {
        userId_scope_key: {
          userId,
          scope,
          key,
        },
      },
      create: {
        userId,
        scope,
        key,
        requestHash,
        response: stringify(response),
        status: 'completed',
        expiresAt: new Date(Date.now() + DEFAULT_TTL_MS),
      },
      update: {
        requestHash,
        response: stringify(response),
        status: 'completed',
        expiresAt: new Date(Date.now() + DEFAULT_TTL_MS),
      },
    }).catch((error) => {
      console.error('[AI_IDEMPOTENCY] save failed', error instanceof Error ? error.message : String(error));
    });
  }

  async cleanup() {
    const result = await prisma.aIIdempotencyRecord.deleteMany({
      where: {
        expiresAt: {
          lte: new Date(),
        },
      },
    }).catch(() => ({ count: 0 }));

    return result.count;
  }
}

export const aiIdempotencyService = new AIIdempotencyService();
