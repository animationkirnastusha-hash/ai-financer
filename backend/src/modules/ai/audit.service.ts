import { prisma } from '../../lib/prisma';
import { AIRiskLevel } from './types';

const MAX_JSON_LENGTH = 120_000;

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
        parsed: params.parsed === undefined ? null : this.stringifySafe(params.parsed),
        result: params.result === undefined ? null : this.stringifySafe({
          status: params.status,
          executed: params.executed,
          requiresConfirmation: params.requiresConfirmation,
          payload: params.result,
        }),
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

  private stringifySafe(value: unknown) {
    try {
      const json = JSON.stringify(value);
      return json.length > MAX_JSON_LENGTH
        ? JSON.stringify({ truncated: true, length: json.length, preview: json.slice(0, MAX_JSON_LENGTH) })
        : json;
    } catch (error) {
      return JSON.stringify({ serializeError: error instanceof Error ? error.message : 'unknown error' });
    }
  }

  private parse(value: string | null) {
    if (!value) return null;
    try { return JSON.parse(value) as unknown; } catch { return null; }
  }
}
