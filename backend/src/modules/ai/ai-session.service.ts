import { prisma } from '../../lib/prisma';

const SESSION_TTL_MS = 1000 * 60 * 15;

function stringify(value: unknown) {
  try { return JSON.stringify(value); } catch { return JSON.stringify({ raw: String(value) }); }
}

function parse(value: string | null) {
  if (!value) return null;
  try { return JSON.parse(value) as unknown; } catch { return { raw: value }; }
}

export class AISessionService {
  async get(userId: string) {
    const state = await prisma.aISessionState.findUnique({ where: { userId } });
    if (!state) return null;

    if (state.expiresAt && state.expiresAt.getTime() <= Date.now()) {
      await this.clear(userId);
      return null;
    }

    return {
      ...state,
      pendingPayload: parse(state.pendingPayload),
      clarification: parse(state.clarification),
      lastResult: parse(state.lastResult),
    };
  }

  async rememberResult(userId: string, params: {
    command: string;
    intent: string;
    tool?: string;
    result?: unknown;
  }) {
    return prisma.aISessionState.upsert({
      where: { userId },
      create: {
        userId,
        pendingIntent: params.intent,
        pendingTool: params.tool ?? null,
        lastCommand: params.command,
        lastResult: stringify(params.result ?? null),
        expiresAt: new Date(Date.now() + SESSION_TTL_MS),
      },
      update: {
        pendingIntent: params.intent,
        pendingTool: params.tool ?? null,
        lastCommand: params.command,
        lastResult: stringify(params.result ?? null),
        expiresAt: new Date(Date.now() + SESSION_TTL_MS),
      },
    });
  }

  async rememberClarification(userId: string, params: {
    command: string;
    intent: string;
    tool?: string;
    payload?: unknown;
    clarification?: unknown;
  }) {
    return prisma.aISessionState.upsert({
      where: { userId },
      create: {
        userId,
        pendingIntent: params.intent,
        pendingTool: params.tool ?? null,
        pendingPayload: stringify(params.payload ?? null),
        clarification: stringify(params.clarification ?? null),
        lastCommand: params.command,
        expiresAt: new Date(Date.now() + SESSION_TTL_MS),
      },
      update: {
        pendingIntent: params.intent,
        pendingTool: params.tool ?? null,
        pendingPayload: stringify(params.payload ?? null),
        clarification: stringify(params.clarification ?? null),
        lastCommand: params.command,
        expiresAt: new Date(Date.now() + SESSION_TTL_MS),
      },
    });
  }

  async clear(userId: string) {
    await prisma.aISessionState.deleteMany({ where: { userId } });
  }
}

export const aiSessionService = new AISessionService();
