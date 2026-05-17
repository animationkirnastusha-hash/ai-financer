import { prisma } from '../../lib/prisma';

function stringify(value: unknown) {
  try {
    return JSON.stringify(value);
  } catch {
    return JSON.stringify({ raw: String(value) });
  }
}

export class AIObservabilityService {
  async log(params: {
    userId?: string | null;
    type: string;
    severity?: 'info' | 'warn' | 'error';
    scope?: string;
    message?: string;
    payload?: unknown;
  }) {
    await prisma.aIOperationEvent.create({
      data: {
        userId: params.userId ?? null,
        type: params.type,
        severity: params.severity ?? 'info',
        scope: params.scope ?? null,
        message: params.message ?? null,
        payload: params.payload === undefined ? null : stringify(params.payload),
      },
    }).catch((error) => {
      console.error('[AI_OBSERVABILITY] log failed', error instanceof Error ? error.message : String(error));
    });
  }

  async list(userId: string, limit = 50) {
    const rows = await prisma.aIOperationEvent.findMany({
      where: {
        OR: [
          { userId },
          { userId: null },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(limit, 1), 100),
    });

    return rows.map((row) => ({
      ...row,
      payload: this.parse(row.payload),
    }));
  }

  private parse(value: string | null) {
    if (!value) return null;

    try {
      return JSON.parse(value) as unknown;
    } catch {
      return { raw: value };
    }
  }
}

export const aiObservability = new AIObservabilityService();
