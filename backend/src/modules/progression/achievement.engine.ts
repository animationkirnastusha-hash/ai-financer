import { prisma } from '../../lib/prisma';

interface AchievementSeed {
  key: string;
  title: string;
  description: string;
  icon: string;
  xpReward: number;
}

const ACHIEVEMENTS: AchievementSeed[] = [
  {
    key: 'first_action',
    title: 'Первое действие',
    description: 'Пользователь впервые зафиксировал финансовое действие.',
    icon: '⚡',
    xpReward: 10,
  },
  {
    key: 'first_account',
    title: 'Первый счёт',
    description: 'Создан первый счёт для управления деньгами.',
    icon: '💳',
    xpReward: 10,
  },
  {
    key: 'streak_3',
    title: '3 дня контроля',
    description: 'Финансовая активность 3 дня подряд.',
    icon: '🔥',
    xpReward: 25,
  },
  {
    key: 'streak_7',
    title: 'Неделя дисциплины',
    description: 'Финансовая активность 7 дней подряд.',
    icon: '🏆',
    xpReward: 50,
  },
  {
    key: 'referral_first_active',
    title: 'Финансовый союзник',
    description: 'Первый приглашённый пользователь стал активным.',
    icon: '🤝',
    xpReward: 50,
  },
];

export class AchievementEngine {
  async ensureDefinitions() {
    await Promise.all(
      ACHIEVEMENTS.map((achievement) =>
        prisma.achievementDefinition.upsert({
          where: { key: achievement.key },
          update: {
            title: achievement.title,
            description: achievement.description,
            icon: achievement.icon,
            xpReward: achievement.xpReward,
          },
          create: achievement,
        }),
      ),
    );
  }

  async evaluate(userId: string) {
    await this.ensureDefinitions();

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        streakDays: true,
        accounts: { select: { id: true }, take: 1 },
        activities: { select: { id: true }, take: 1 },
        referralSources: {
          where: { status: 'completed' },
          select: { id: true },
          take: 1,
        },
      },
    });

    if (!user) return [];

    const keys = new Set<string>();

    if (user.activities.length > 0) keys.add('first_action');
    if (user.accounts.length > 0) keys.add('first_account');
    if (user.streakDays >= 3) keys.add('streak_3');
    if (user.streakDays >= 7) keys.add('streak_7');
    if (user.referralSources.length > 0) keys.add('referral_first_active');

    const unlocked = [];

    for (const key of keys) {
      const definition = await prisma.achievementDefinition.findUnique({ where: { key } });
      if (!definition) continue;

      const achievement = await prisma.userAchievement.upsert({
        where: {
          userId_achievementId: {
            userId,
            achievementId: definition.id,
          },
        },
        update: {},
        create: {
          userId,
          achievementId: definition.id,
        },
        include: { achievement: true },
      });

      unlocked.push(achievement);
    }

    return unlocked;
  }
}

export const achievementEngine = new AchievementEngine();
