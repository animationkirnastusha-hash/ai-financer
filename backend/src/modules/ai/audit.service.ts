import { prisma } from '../../lib/prisma';
import { AIResult } from './types';
import { AIAuditLogView } from './read-models';

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

export class AIAuditService {
  async createLog(params: {
    userId: string;
    command: string;
    intent: string;
    riskLevel: string;
    requiresConfirmation: boolean;
    executed: boolean;
    status: 'previewed' | 'pending_confirmation' | 'executed' | 'cancelled' | 'failed' | 'undone';
    parsed?: Record<string, unknown> | null;
    result?: unknown;
    errorMessage?: string;
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
        parsed: safeStringify(params.parsed),
        result: safeStringify(params.result),
        errorMessage: params.errorMessage ?? null,
      },
    });
  }

  async logSuccess(
    userId: string,
    command: string,
    result: AIResult,
    status: 'previewed' | 'pending_confirmation' | 'executed'
  ) {
    return this.createLog({
      userId,
      command,
      intent: result.intent,
      riskLevel: result.riskLevel,
      requiresConfirmation: result.requiresConfirmation,
      executed: result.executed,
      status,
      parsed: result.parsed,
      result: result.data,
    });
  }

  async logFailure(userId: string, command: string, error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown AI error';

    return this.createLog({
      userId,
      command,
      intent: 'unknown',
      riskLevel: 'low',
      requiresConfirmation: false,
      executed: false,
      status: 'failed',
      parsed: null,
      result: null,
      errorMessage: message,
    });
  }

  async getAuditLogs(userId: string, limit = 50): Promise<AIAuditLogView[]> {
    const rows = await prisma.aIAuditLog.findMany({
      where: { userId },
      orderBy: [{ createdAt: 'desc' }],
      take: Math.min(Math.max(limit, 1), 100),
    });

    return rows.map((row) => ({
      id: row.id,
      command: row.command,
      intent: row.intent,
      riskLevel: row.riskLevel,
      requiresConfirmation: row.requiresConfirmation,
      executed: row.executed,
      status: row.status,
      parsed: safeParseObject(row.parsed),
      result: safeParseObject(row.result),
      errorMessage: row.errorMessage,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    }));
  }
}