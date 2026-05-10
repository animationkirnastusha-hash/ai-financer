import { prisma } from '../../lib/prisma';
import { NotFoundError } from '../../shared/core/errors';
import { AIParsedCommand, AIRiskLevel } from './types';

export class AIPendingActionService {
  async create(params: {
    userId: string;
    command: string;
    parsed: AIParsedCommand;
    riskLevel: AIRiskLevel;
  }) {
    const pending = await prisma.aIPendingAction.create({
      data: {
        userId: params.userId,
        command: params.command,
        intent: params.parsed.intent,
        riskLevel: params.riskLevel,
        parsed: JSON.stringify(params.parsed),
        status: 'pending',
        expiresAt: new Date(Date.now() + 1000 * 60 * 30),
      },
    });

    return this.serialize(pending);
  }

  async update(userId: string, pendingActionId: string, parsed: Record<string, unknown>, command?: string) {
    await this.ensurePending(userId, pendingActionId);
    const updated = await prisma.aIPendingAction.update({
      where: { id: pendingActionId },
      data: {
        parsed: JSON.stringify(parsed),
        ...(command ? { command } : {}),
      },
    });

    return this.serialize(updated);
  }

  async getForConfirm(userId: string, pendingActionId: string) {
    const pending = await this.ensurePending(userId, pendingActionId);
    return this.serialize(pending);
  }

  async markConfirmed(userId: string, pendingActionId: string) {
    await this.ensurePending(userId, pendingActionId);
    const updated = await prisma.aIPendingAction.update({
      where: { id: pendingActionId },
      data: { status: 'confirmed', confirmedAt: new Date() },
    });
    return this.serialize(updated);
  }

  async cancel(userId: string, pendingActionId: string) {
    await this.ensurePending(userId, pendingActionId);
    const updated = await prisma.aIPendingAction.update({
      where: { id: pendingActionId },
      data: { status: 'cancelled', cancelledAt: new Date() },
    });
    return this.serialize(updated);
  }

  async list(userId: string, includeExpired = false) {
    const rows = await prisma.aIPendingAction.findMany({
      where: {
        userId,
        status: 'pending',
        ...(includeExpired ? {} : { expiresAt: { gt: new Date() } }),
      },
      orderBy: { createdAt: 'desc' },
    });

    return rows.map((row) => this.serialize(row));
  }

  private async ensurePending(userId: string, pendingActionId: string) {
    const pending = await prisma.aIPendingAction.findFirst({
      where: { id: pendingActionId, userId },
    });

    if (!pending) throw new NotFoundError('Pending action not found');
    return pending;
  }

  private serialize(row: any) {
    return {
      ...row,
      parsed: this.parse(row.parsed),
    };
  }

  private parse(value: string | null) {
    if (!value) return null;
    try { return JSON.parse(value); } catch { return null; }
  }
}
