import { prisma } from '../../lib/prisma';
import { monitoringService } from '../monitoring/monitoring.instance';

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
    const sourceEvents = events.filter((event) => event.event === 'session_start');

    const screens = new Map<string, number>();
    for (const event of screenViews) {
      const data = parseEventData(event.data);
      const screen = typeof data?.screen === 'string' ? data.screen : 'unknown';
      screens.set(screen, (screens.get(screen) ?? 0) + 1);
    }

    const sources = new Map<string, number>();
    for (const event of sourceEvents) {
      const data = parseEventData(event.data);
      const source = typeof data?.source === 'string' && data.source ? data.source : 'direct';
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
}
