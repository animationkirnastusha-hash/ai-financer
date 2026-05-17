import { prisma } from '../../lib/prisma';
import { NotFoundError } from '../../shared/core/errors';
import { AIParsedCommand, AIRiskLevel } from './types';

type PrismaPendingActionRow = {
  id: string;
  userId: string;
  command: string;
  intent: string;
  riskLevel: string;
  parsed: string | null;
  status: string;
  expiresAt: Date;
  confirmedAt?: Date | null;
  cancelledAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
};

export type AIPendingActionView = Omit<PrismaPendingActionRow, 'parsed'> & {
  parsed: Record<string, unknown> | null;
};

export class AIPendingActionService {
  async create(params: {
    userId: string;
    command: string;
    parsed: AIParsedCommand;
    riskLevel: AIRiskLevel;
  }): Promise<AIPendingActionView> {
    await this.expireOld(params.userId);

    const pending = await prisma.aIPendingAction.create({
      data: {
        userId: params.userId,
        command: params.command,
        intent: params.parsed.intent,
        riskLevel: params.riskLevel,
        parsed: JSON.stringify(params.parsed),
        status: 'pending',
        expiresAt: new Date(Date.now() + 1000 * 60 * 15),
      },
    });

    return this.serialize(pending as PrismaPendingActionRow);
  }

  async update(
    userId: string,
    pendingActionId: string,
    parsed: Record<string, unknown>,
    command?: string,
  ): Promise<AIPendingActionView> {
    const current = await this.ensurePending(userId, pendingActionId);

    const updated = await prisma.aIPendingAction.update({
      where: { id: current.id },
      data: {
        parsed: JSON.stringify(parsed),
        intent: this.resolveIntent(parsed, current.intent),
        ...(command ? { command } : {}),
      },
    });

    return this.serialize(updated as PrismaPendingActionRow);
  }

  async getForConfirm(userId: string, pendingActionId: string): Promise<AIPendingActionView> {
    const pending = await this.ensurePending(userId, pendingActionId);
    return this.serialize(pending);
  }

  async markConfirmed(userId: string, pendingActionId: string): Promise<AIPendingActionView> {
    const pending = await this.ensurePending(userId, pendingActionId);

    const updated = await prisma.aIPendingAction.update({
      where: { id: pending.id },
      data: { status: 'confirmed', confirmedAt: new Date() },
    });

    return this.serialize(updated as PrismaPendingActionRow);
  }

  async markFailed(userId: string, pendingActionId: string, reason?: string): Promise<AIPendingActionView | null> {
    const updated = await prisma.aIPendingAction.updateMany({
      where: {
        id: pendingActionId,
        userId,
        status: { in: ['pending', 'claimed'] },
      },
      data: {
        status: 'failed',
        parsed: reason ? JSON.stringify({ failureReason: reason }) : undefined,
      },
    });

    if (updated.count !== 1) return null;

    const row = await prisma.aIPendingAction.findFirst({ where: { id: pendingActionId, userId } });
    return row ? this.serialize(row as PrismaPendingActionRow) : null;
  }

  async cancel(userId: string, pendingActionId: string): Promise<AIPendingActionView> {
    const pending = await this.ensurePending(userId, pendingActionId);

    const updated = await prisma.aIPendingAction.update({
      where: { id: pending.id },
      data: { status: 'cancelled', cancelledAt: new Date() },
    });

    return this.serialize(updated as PrismaPendingActionRow);
  }

  async list(userId: string, includeExpired = false): Promise<AIPendingActionView[]> {
    if (!includeExpired) await this.expireOld(userId);

    const rows = await prisma.aIPendingAction.findMany({
      where: {
        userId,
        status: includeExpired ? { in: ['pending', 'expired'] } : 'pending',
        ...(includeExpired ? {} : { expiresAt: { gt: new Date() } }),
      },
      orderBy: { createdAt: 'desc' },
    });

    return rows.map((row) => this.serialize(row as PrismaPendingActionRow));
  }

  async expireOld(userId?: string): Promise<number> {
    const result = await prisma.aIPendingAction.updateMany({
      where: {
        ...(userId ? { userId } : {}),
        status: 'pending',
        expiresAt: { lte: new Date() },
      },
      data: { status: 'expired' },
    });

    return result.count;
  }

  private async ensurePending(userId: string, pendingActionId: string): Promise<PrismaPendingActionRow> {
    await this.expireOld(userId);

    const pending = await prisma.aIPendingAction.findFirst({
      where: { id: pendingActionId, userId, status: 'pending' },
    });

    if (!pending) throw new NotFoundError('Pending action not found');
    if (pending.expiresAt < new Date()) throw new NotFoundError('Pending action expired');

    return pending as PrismaPendingActionRow;
  }

  private serialize(row: PrismaPendingActionRow): AIPendingActionView {
    return {
      ...row,
      parsed: this.parse(row.parsed),
    };
  }

  private parse(value: string | null): Record<string, unknown> | null {
    if (!value) return null;

    try {
      const parsed = JSON.parse(value) as unknown;
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : null;
    } catch {
      return null;
    }
  }

  private resolveIntent(parsed: Record<string, unknown>, fallback: string): string {
    const intent = parsed.intent;
    return typeof intent === 'string' && intent.trim() ? intent : fallback;
  }
}
