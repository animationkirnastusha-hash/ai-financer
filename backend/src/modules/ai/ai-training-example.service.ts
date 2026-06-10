import { prisma } from '../../lib/prisma';

const MAX_INPUT_LENGTH = 4000;
const MAX_OUTPUT_LENGTH = 12000;
const MAX_ERROR_LENGTH = 1000;

function safeJson(value: unknown): string | null {
  try {
    return JSON.stringify(value).slice(0, MAX_OUTPUT_LENGTH);
  } catch {
    return null;
  }
}

function isWorthSaving(result: Record<string, unknown>) {
  if (result.success === false) return true;
  if (result.intent === 'error' || result.intent === 'validation_failed' || result.intent === 'clarification') return true;
  if (result.requiresConfirmation === true) return true;
  return false;
}

export class AITrainingExampleService {
  async captureFromResult(input: {
    userId: string;
    command: string;
    result: unknown;
    latencyMs?: number;
    model?: string;
  }) {
    const result = input.result && typeof input.result === 'object' ? input.result as Record<string, unknown> : {};
    if (!isWorthSaving(result)) return null;

    const message = typeof result.message === 'string' ? result.message : undefined;
    const success = result.success === true && result.executed === true;

    return prisma.aITrainingExample.create({
      data: {
        userId: input.userId,
        input: input.command.slice(0, MAX_INPUT_LENGTH),
        aiOutput: safeJson(input.result),
        success,
        error: success ? null : (message ?? null)?.slice(0, MAX_ERROR_LENGTH) ?? null,
        model: input.model ?? null,
        latencyMs: input.latencyMs,
      },
    });
  }

  async list(options: { limit?: number; success?: boolean | null } = {}) {
    const take = Math.min(Math.max(options.limit ?? 50, 1), 100);
    const rows = await prisma.aITrainingExample.findMany({
      where: options.success === null || options.success === undefined ? {} : { success: options.success },
      orderBy: { createdAt: 'desc' },
      take,
    });

    return rows.map((row) => ({
      ...row,
      createdAt: row.createdAt.toISOString(),
    }));
  }

  async update(id: string, input: { correctedOutput?: unknown; success?: unknown }) {
    const correctedOutput = typeof input.correctedOutput === 'string' ? input.correctedOutput.trim().slice(0, MAX_OUTPUT_LENGTH) : undefined;
    const success = typeof input.success === 'boolean' ? input.success : undefined;

    return prisma.aITrainingExample.update({
      where: { id },
      data: {
        ...(correctedOutput !== undefined ? { correctedOutput: correctedOutput || null } : {}),
        ...(success !== undefined ? { success } : {}),
      },
    });
  }
}

export const aiTrainingExampleService = new AITrainingExampleService();
