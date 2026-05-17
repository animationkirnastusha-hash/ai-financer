import { prisma } from '../../lib/prisma';

function safeJson(value: unknown) {
  try { return JSON.stringify(value); } catch { return JSON.stringify({ raw: String(value) }); }
}

export class AICompanionService {
  async recordExecution(userId: string, params: {
    tools: string[];
    result?: unknown;
    source?: 'ai' | 'manual';
  }) {
    const settings = await prisma.userAISettings.findUnique({ where: { userId } }).catch(() => null);
    const tone = settings?.companionTone ?? 'calm';

    const events: Array<{ type: string; title: string; message: string; payload?: unknown }> = [];

    if (params.tools.includes('create_transaction')) {
      events.push({
        type: 'transaction_recorded',
        title: 'Операция записана',
        message: tone === 'strict' ? 'Записал операцию.' : 'Записал. Финансовая картина стала точнее.',
        payload: params.result,
      });
    }

    if (params.tools.includes('transfer_money')) {
      events.push({
        type: 'transfer_recorded',
        title: 'Перевод выполнен',
        message: 'Перевод зафиксирован. Балансы обновлены.',
        payload: params.result,
      });
    }

    if (params.tools.includes('create_account')) {
      events.push({
        type: 'account_created',
        title: 'Новый счёт',
        message: 'Счёт создан. Теперь его можно использовать в голосовых командах.',
        payload: params.result,
      });
    }

    for (const event of events.slice(0, 3)) {
      await prisma.aICompanionEvent.create({
        data: {
          userId,
          type: event.type,
          tone,
          title: event.title,
          message: event.message,
          payload: event.payload === undefined ? null : safeJson(event.payload),
        },
      }).catch((error) => {
        console.error('[COMPANION] failed to record event', error instanceof Error ? error.message : String(error));
      });
    }
  }

  async list(userId: string, input: Record<string, unknown>) {
    const limit = Math.min(Math.max(Number(input.limit ?? 10), 1), 50);
    const onlyUnseen = Boolean(input.onlyUnseen ?? false);

    const events = await prisma.aICompanionEvent.findMany({
      where: { userId, ...(onlyUnseen ? { seen: false } : {}) },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return events.map((event) => ({
      ...event,
      payload: this.parse(event.payload),
    }));
  }

  async markSeen(userId: string) {
    const result = await prisma.aICompanionEvent.updateMany({
      where: { userId, seen: false },
      data: { seen: true },
    });

    return { markedSeen: result.count };
  }

  private parse(value: string | null) {
    if (!value) return null;
    try { return JSON.parse(value) as unknown; } catch { return { raw: value }; }
  }
}

export const aiCompanionService = new AICompanionService();
