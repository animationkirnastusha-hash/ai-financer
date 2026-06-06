import { prisma } from '../../lib/prisma';
import { monitoringService } from '../monitoring/monitoring.instance';
import { dataResetService } from '../data-reset/service';
import { subscriptionService } from '../subscription/service';

function startOfDay(daysAgo: number) {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - daysAgo);
  return date;
}

function parseEventData(data: string | null) {
  if (!data) return null;
  try {
    return JSON.parse(data) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function readStringField(data: Record<string, unknown> | null, key: string, fallback: string) {
  const value = data?.[key];
  return typeof value === 'string' && value.trim() ? value : fallback;
}

function readNumberField(data: Record<string, unknown> | null, key: string, fallback = 0) {
  const value = data?.[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function parseSubscriptionBody(input: unknown) {
  if (!input || typeof input !== 'object') return {};
  const body = input as { product?: unknown; days?: unknown; lifetime?: unknown };
  return {
    product: body.product === 'business' ? 'business' as const : 'premium' as const,
    days: typeof body.days === 'number' ? body.days : typeof body.days === 'string' ? Number(body.days) : undefined,
    lifetime: body.lifetime === true,
  };
}

function parseRevokeBody(input: unknown) {
  if (!input || typeof input !== 'object') return {};
  const body = input as { product?: unknown };
  return {
    product: body.product === 'business' ? 'business' as const : 'premium' as const,
  };
}

export class AdminService {
  async getOverview() {
    const now = new Date();
    const today = startOfDay(0);
    const sevenDaysAgo = startOfDay(7);
    const thirtyDaysAgo = startOfDay(30);

    const [
      usersTotal,
      usersToday,
      users7d,
      transactionsTotal,
      transactionsToday,
      accountsTotal,
      eventsToday,
      pendingActions,
      premiumUsers,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { createdAt: { gte: today } } }),
      prisma.user.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
      prisma.transaction.count(),
      prisma.transaction.count({ where: { createdAt: { gte: today } } }),
      prisma.account.count(),
      prisma.productEvent.count({ where: { createdAt: { gte: today } } }),
      prisma.aIPendingAction.count({ where: { status: 'pending' } }),
      prisma.user.count({ where: { tier: { not: 'FREE' } } }),
    ]);

    const events = await prisma.productEvent.findMany({
      where: { createdAt: { gte: thirtyDaysAgo } },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });

    const screenViews = events.filter((event) => event.event === 'screen_view');
    const screenLeaves = events.filter((event) => event.event === 'screen_leave' || event.event === 'session_pause');
    const sourceEvents = events.filter((event) => event.event === 'session_start');

    const screens = new Map<string, number>();
    for (const event of screenViews) {
      const data = parseEventData(event.data);
      const screen = readStringField(data, 'screen', 'unknown');
      screens.set(screen, (screens.get(screen) ?? 0) + 1);
    }

    const exits = new Map<string, { exits: number; duration: number }>();
    for (const event of screenLeaves) {
      const data = parseEventData(event.data);
      const screen = readStringField(data, 'screen', 'unknown');
      const durationMs = readNumberField(data, 'durationMs', 0);
      const current = exits.get(screen) ?? { exits: 0, duration: 0 };
      exits.set(screen, { exits: current.exits + 1, duration: current.duration + Math.max(0, durationMs) });
    }

    const sources = new Map<string, number>();
    for (const event of sourceEvents) {
      const data = parseEventData(event.data);
      const source = readStringField(data, 'source', 'direct');
      sources.set(source, (sources.get(source) ?? 0) + 1);
    }

    const activeUserIds = new Set(events.map((event) => event.userId).filter(Boolean));
    const totalStarted = sourceEvents.length;
    const didTransaction = new Set(
      events
        .filter((event) => event.event === 'transaction_created' || event.event === 'ai_confirmed')
        .map((event) => event.userId)
        .filter(Boolean),
    );

    return {
      generatedAt: now.toISOString(),
      metrics: {
        usersTotal,
        usersToday,
        users7d,
        activeUsers30d: activeUserIds.size,
        premiumUsers,
        transactionsTotal,
        transactionsToday,
        accountsTotal,
        eventsToday,
        pendingActions,
      },
      acquisition: Array.from(sources.entries()).map(([source, count]) => ({ source, count })).sort((a, b) => b.count - a.count),
      screens: Array.from(screens.entries()).map(([screen, count]) => ({ screen, count })).sort((a, b) => b.count - a.count),
      dropoff: Array.from(exits.entries())
        .map(([screen, value]) => ({
          screen,
          exits: value.exits,
          avgDurationMs: value.exits ? Math.round(value.duration / value.exits) : 0,
        }))
        .sort((a, b) => b.exits - a.exits),
      funnel: [
        { step: 'Открыли приложение', count: totalStarted },
        { step: 'Авторизованы', count: activeUserIds.size },
        { step: 'Создали действие', count: didTransaction.size },
      ],
      monitoring: monitoringService.getSnapshot(),
    };
  }

  async getUsers() {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        id: true,
        telegramId: true,
        firstName: true,
        lastName: true,
        username: true,
        tier: true,
        isAdmin: true,
        referralCode: true,
        referralBalance: true,
        xp: true,
        level: true,
        streakDays: true,
        lastActiveAt: true,
        createdAt: true,
        subscription: {
          select: {
            premiumUntil: true,
            businessUntil: true,
            trialUntil: true,
            premiumLifetime: true,
            businessLifetime: true,
          },
        },
        _count: {
          select: {
            accounts: true,
            transactions: true,
            referrals: true,
          },
        },
      },
    });

    return users.map((user) => ({
      ...user,
      telegramId: user.telegramId.toString(),
    }));
  }

  async getEvents() {
    const events = await prisma.productEvent.findMany({
      orderBy: { createdAt: 'desc' },
      take: 120,
    });

    const userIds = Array.from(new Set(events.map((event) => event.userId).filter((id): id is string => Boolean(id))));
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, firstName: true, username: true },
    });
    const usersById = new Map(users.map((user) => [user.id, user]));

    return events.map((event) => ({
      id: event.id,
      event: event.event,
      data: parseEventData(event.data),
      createdAt: event.createdAt,
      user: event.userId ? usersById.get(event.userId) ?? null : null,
    }));
  }

  getMonitoring() {
    return monitoringService.getSnapshot();
  }

  async resetUser(userId: string, mode: unknown) {
    return dataResetService.reset({ userId }, mode);
  }

  async resetAllUsers(mode: unknown) {
    return dataResetService.reset({ allUsers: true }, mode);
  }

  async grantSubscription(userId: string, input: unknown) {
    return subscriptionService.grant(userId, parseSubscriptionBody(input));
  }

  async revokeSubscription(userId: string, input: unknown) {
    const body = parseRevokeBody(input);
    return subscriptionService.revoke(userId, body.product);
  }

  async restartTrial(userId: string) {
    return subscriptionService.restartTrial(userId);
  }
}
