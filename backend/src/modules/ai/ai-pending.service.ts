import { prisma } from '../../lib/prisma';

type CreatePendingActionPayload = {
  command?: string;
  intent?: string;
  action?: string;
  riskLevel?: string;
  parsed?: unknown;
  payload?: unknown;
  expiresInMs?: number;
};

export class AIPendingService {
  async create(userId: string, data: CreatePendingActionPayload) {
    return prisma.aIPendingAction.create({
      data: {
        userId,
        command: data.command ?? '',
        intent: data.intent ?? data.action ?? 'unknown',
        riskLevel: data.riskLevel ?? 'medium',
        parsed: JSON.stringify(data.parsed ?? data.payload ?? null),
        status: 'pending',
        expiresAt: new Date(Date.now() + (data.expiresInMs ?? 10 * 60 * 1000)),
      },
    });
  }

  async getLast(userId: string) {
    return prisma.aIPendingAction.findFirst({
      where: {
        userId,
        status: 'pending',
        expiresAt: {
          gt: new Date(),
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async confirm(id: string) {
    return prisma.aIPendingAction.update({
      where: { id },
      data: {
        status: 'confirmed',
        confirmedAt: new Date(),
      },
    });
  }

  async cancel(id: string) {
    return prisma.aIPendingAction.update({
      where: { id },
      data: {
        status: 'cancelled',
        cancelledAt: new Date(),
      },
    });
  }

  async clear(id: string) {
    return prisma.aIPendingAction.delete({
      where: { id },
    });
  }

  parsePendingPayload<T = unknown>(pending: { parsed?: string | null }): T | null {
    if (!pending.parsed) {
      return null;
    }

    try {
      return JSON.parse(pending.parsed) as T;
    } catch {
      return null;
    }
  }
}
