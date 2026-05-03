import { prisma } from '../../lib/prisma';
import { BadRequestError, NotFoundError } from '../../shared/core/errors';
import { AIPendingActionView } from './read-models';

const PENDING_ACTION_TTL_MINUTES = 15;

function safeStringify(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  return JSON.stringify(value);
}

function safeParseObject(value: string | null): Record<string, unknown> | null {
  if (!value) return null;

  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export class AIPendingActionService {
  async createPendingAction(params: {
    userId: string;
    command: string;
    intent: string;
    riskLevel: string;
    parsed?: Record<string, unknown> | null;
  }) {
    const expiresAt = new Date(Date.now() + PENDING_ACTION_TTL_MINUTES * 60 * 1000);

    return prisma.aIPendingAction.create({
      data: {
        userId: params.userId,
        command: params.command,
        intent: params.intent,
        riskLevel: params.riskLevel,
        parsed: safeStringify(params.parsed),
        status: 'pending',
        expiresAt,
      },
    });
  }

  async getPendingAction(userId: string, pendingActionId: string) {
    const action = await prisma.aIPendingAction.findFirst({
      where: {
        id: pendingActionId,
        userId,
      },
    });

    if (!action) {
      throw new NotFoundError('Pending AI action not found');
    }

    if (action.status !== 'pending') {
      throw new BadRequestError('AI action is no longer pending');
    }

    if (action.expiresAt.getTime() < Date.now()) {
      await prisma.aIPendingAction.update({
        where: { id: action.id },
        data: { status: 'expired' },
      });

      throw new BadRequestError('Pending AI action has expired');
    }

    return action;
  }

  async confirmPendingAction(id: string) {
    return prisma.aIPendingAction.update({
      where: { id },
      data: {
        status: 'confirmed',
        confirmedAt: new Date(),
      },
    });
  }

  async cancelPendingAction(id: string) {
    return prisma.aIPendingAction.update({
      where: { id },
      data: {
        status: 'cancelled',
        cancelledAt: new Date(),
      },
    });
  }

  async getPendingActions(userId: string, includeExpired = false): Promise<AIPendingActionView[]> {
    const rows = await prisma.aIPendingAction.findMany({
      where: {
        userId,
        ...(includeExpired ? {} : { status: 'pending' }),
      },
      orderBy: [{ createdAt: 'desc' }],
      take: 50,
    });

    return rows.map((row) => ({
      id: row.id,
      command: row.command,
      intent: row.intent,
      riskLevel: row.riskLevel,
      status: row.status,
      parsed: safeParseObject(row.parsed),
      expiresAt: row.expiresAt.toISOString(),
      confirmedAt: row.confirmedAt ? row.confirmedAt.toISOString() : null,
      cancelledAt: row.cancelledAt ? row.cancelledAt.toISOString() : null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    }));
  }
}