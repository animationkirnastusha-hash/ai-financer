import { prisma } from '../../lib/prisma';
import { AIRiskLevel } from './types';

export class AIAuditService {
  async create(params: {
    userId: string;
    command: string;
    intent: string;
    riskLevel: AIRiskLevel;
    requiresConfirmation: boolean;
    executed: boolean;
    status: string;
    parsed?: unknown;
    result?: unknown;
    errorMessage?: string | null;
  }) {
    return prisma.aIAuditLog.create({
      data: {
        userId: params.userId,
        command: params.command,
        intent: params.intent,
        riskLevel: params.riskLevel,
        requiresConfirmation: params.requiresConfirmation,
        executed: params.executed,
        status: params.status,
        parsed: params.parsed === undefined ? null : JSON.stringify(params.parsed),
        result: params.result === undefined ? null : JSON.stringify(params.result),
        errorMessage: params.errorMessage ?? null,
      },
    });
  }

  async list(userId: string, limit: number) {
    const rows = await prisma.aIAuditLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(limit, 1), 100),
    });

    return rows.map((row) => ({ ...row, parsed: this.parse(row.parsed), result: this.parse(row.result) }));
  }

  private parse(value: string | null) {
    if (!value) return null;
    try { return JSON.parse(value) as unknown; } catch { return null; }
  }
}
