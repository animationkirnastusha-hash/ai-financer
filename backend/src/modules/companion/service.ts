import { prisma } from '../../lib/prisma';
import { companionLevelFromXP } from '../progression/xp-rules';
import { aiCompanionService } from '../ai/ai-companion.service';

function parse(value: string | null) {
  if (!value) return null;

  try {
    return JSON.parse(value) as unknown;
  } catch {
    return { raw: value };
  }
}

export class CompanionFacadeService {
  async getState(userId: string) {
    const [user, settings, profile, unseenCount, recentEvents] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          xp: true,
          level: true,
          streakDays: true,
          tier: true,
          lastActiveAt: true,
        },
      }),
      prisma.userAISettings.findUnique({ where: { userId } }).catch(() => null),
      prisma.progressionProfile.findUnique({ where: { userId } }).catch(() => null),
      prisma.aICompanionEvent.count({ where: { userId, seen: false } }).catch(() => 0),
      prisma.aICompanionEvent.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }).catch(() => []),
    ]);

    const xp = user?.xp ?? 0;
    const mood = profile?.companionMood ?? this.resolveMood(user?.streakDays ?? 0);
    const companionLevel = profile?.companionLevel ?? companionLevelFromXP(xp);
    const tone = settings?.companionTone ?? 'friendly';

    return {
      mood,
      tone,
      companionLevel,
      userLevel: user?.level ?? 1,
      xp,
      streakDays: user?.streakDays ?? 0,
      tier: user?.tier ?? 'FREE',
      unseenEvents: unseenCount,
      suggestedMessage: this.suggestMessage({
        mood,
        tone,
        streakDays: user?.streakDays ?? 0,
        unseenEvents: unseenCount,
      }),
      recentEvents: recentEvents.map((event) => ({
        ...event,
        payload: parse(event.payload),
      })),
    };
  }

  async getEvents(userId: string, input: { limit: number; onlyUnseen: boolean }) {
    return aiCompanionService.list(userId, input);
  }

  async markSeen(userId: string) {
    return aiCompanionService.markSeen(userId);
  }

  private resolveMood(streakDays: number) {
    if (streakDays >= 7) return 'focused';
    if (streakDays >= 3) return 'positive';
    return 'neutral';
  }

  private suggestMessage(params: { mood: string; tone: string; streakDays: number; unseenEvents: number }) {
    if (params.unseenEvents > 0) return 'Есть новые финансовые заметки.';
    if (params.streakDays >= 3) return `Серия ${params.streakDays} дня. Хороший темп.`;
    if (params.tone === 'strict') return 'Готов к следующей операции.';
    return 'Я рядом. Можно записать расход, доход или спросить статистику.';
  }
}

export const companionFacadeService = new CompanionFacadeService();
