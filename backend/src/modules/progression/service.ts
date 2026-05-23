import { prisma } from '../../lib/prisma';
import { BadRequestError, NotFoundError } from '../../shared/core/errors';
import { achievementEngine } from './achievement.engine';
import { companionLevelFromXP, levelFromXP, XP_RULES } from './xp-rules';
import type { ActivityType, AddProgressionInput, ProgressionSnapshot } from './types';
import { streakService } from './streak.service';

function serializePayload(payload: unknown): string | undefined {
  if (payload === undefined) return undefined;

  try {
    return JSON.stringify(payload);
  } catch {
    return JSON.stringify({ raw: String(payload) });
  }
}

function parsePayload(payload: string | null) {
  if (!payload) return null;

  try {
    return JSON.parse(payload);
  } catch {
    return { raw: payload };
  }
}

function normalizeReferralCode(value: unknown) {
  return String(value ?? '')
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .slice(0, 32);
}

function makeReferralCode(userId: string) {
  return `af_${userId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 10)}`.toLowerCase();
}

export class ProgressionService {
  async getSnapshot(userId: string): Promise<ProgressionSnapshot> {
    await this.ensureProfile(userId);
    await achievementEngine.evaluate(userId);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        xp: true,
        level: true,
        streakDays: true,
        lastActiveAt: true,
        referralCode: true,
        referralBalance: true,
        progressionProfile: true,
        activities: {
          orderBy: { createdAt: 'desc' },
          take: 12,
        },
        achievements: {
          orderBy: { unlockedAt: 'desc' },
          include: { achievement: true },
        },
      },
    });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    const activitiesToday = await prisma.userActivity.count({
      where: { userId, createdAt: { gte: today } },
    });

    const computedLevel = levelFromXP(user.xp);
    const computedCompanionLevel = companionLevelFromXP(user.xp);

    if (user.level !== computedLevel || user.progressionProfile?.companionLevel !== computedCompanionLevel) {
      await prisma.user.update({
        where: { id: userId },
        data: {
          level: computedLevel,
          progressionProfile: {
            upsert: {
              create: {
                totalXP: user.xp,
                companionLevel: computedCompanionLevel,
                companionMood: user.progressionProfile?.companionMood ?? 'neutral',
              },
              update: {
                totalXP: user.xp,
                companionLevel: computedCompanionLevel,
              },
            },
          },
        },
      });
    }

    return {
      xp: user.xp,
      level: computedLevel,
      streakDays: user.streakDays,
      lastActiveAt: user.lastActiveAt?.toISOString() ?? null,
      companionLevel: computedCompanionLevel,
      companionMood: user.progressionProfile?.companionMood ?? 'neutral',
      referralCode: user.referralCode,
      referralBalance: user.referralBalance,
      activitiesToday,
      recentActivities: user.activities.map((activity) => ({
        id: activity.id,
        type: activity.type,
        xpEarned: activity.xpEarned,
        payload: parsePayload(activity.payload),
        createdAt: activity.createdAt.toISOString(),
      })),
      achievements: user.achievements.map((item) => ({
        key: item.achievement.key,
        title: item.achievement.title,
        description: item.achievement.description,
        icon: item.achievement.icon,
        xpReward: item.achievement.xpReward,
        unlockedAt: item.unlockedAt.toISOString(),
      })),
    };
  }

  async addXP(input: AddProgressionInput) {
    const xpEarned = XP_RULES[input.rule] ?? 0;

    if (!input.userId) {
      throw new BadRequestError('userId is required');
    }

    const now = new Date();
    const payload = serializePayload(input.payload);

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: input.userId },
        select: {
          id: true,
          xp: true,
          level: true,
          streakDays: true,
          lastActiveAt: true,
          referralCode: true,
        },
      });

      if (!user) {
        throw new NotFoundError('User not found');
      }

      const isNewDay = streakService.isNewActiveDay(user.lastActiveAt, now);
      const nextStreakDays = streakService.getNextStreak(user.streakDays, user.lastActiveAt, now);
      const streakBonus = isNewDay && nextStreakDays > 1 ? XP_RULES.STREAK_BONUS : 0;
      const nextXP = user.xp + xpEarned + streakBonus;
      const nextLevel = levelFromXP(nextXP);
      const nextCompanionLevel = companionLevelFromXP(nextXP);
      const referralCode = user.referralCode ?? makeReferralCode(user.id);

      const updated = await tx.user.update({
        where: { id: input.userId },
        data: {
          xp: nextXP,
          level: nextLevel,
          streakDays: nextStreakDays,
          lastActiveAt: now,
          referralCode,
          progressionProfile: {
            upsert: {
              create: {
                totalXP: nextXP,
                companionLevel: nextCompanionLevel,
                companionMood: this.resolveMood(input.type, nextStreakDays),
              },
              update: {
                totalXP: nextXP,
                companionLevel: nextCompanionLevel,
                companionMood: this.resolveMood(input.type, nextStreakDays),
              },
            },
          },
        },
        select: {
          xp: true,
          level: true,
          streakDays: true,
          lastActiveAt: true,
          progressionProfile: true,
        },
      });

      const activity = await tx.userActivity.create({
        data: {
          userId: input.userId,
          type: input.type,
          payload,
          xpEarned: xpEarned + streakBonus,
        },
      });

      return { updated, activity, xpEarned, streakBonus };
    });

    await achievementEngine.evaluate(input.userId);

    return {
      xpEarned: result.xpEarned,
      streakBonus: result.streakBonus,
      totalXPEarned: result.xpEarned + result.streakBonus,
      xp: result.updated.xp,
      level: result.updated.level,
      streakDays: result.updated.streakDays,
      companionLevel: result.updated.progressionProfile?.companionLevel ?? companionLevelFromXP(result.updated.xp),
      companionMood: result.updated.progressionProfile?.companionMood ?? 'neutral',
      activityId: result.activity.id,
    };
  }

  async trackActivity(userId: string, type: ActivityType, payload?: unknown) {
    const rule = this.ruleForActivity(type);
    return this.addXP({ userId, type, rule, payload });
  }


  async rollbackTransactionActivities(userId: string, transactionIds: string[]) {
    const ids = new Set(transactionIds.filter(Boolean));
    if (ids.size === 0) return { revertedActivities: 0, revertedXP: 0 };

    const activities = await prisma.userActivity.findMany({
      where: {
        userId,
        type: { in: ['expense_created', 'income_created', 'transfer_created'] },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    const matched = activities.filter((activity) => {
      const payload = parsePayload(activity.payload) as any;
      const transactionId = payload?.transactionId
        ?? payload?.result?.transactionId
        ?? payload?.result?.transaction?.id;
      return typeof transactionId === 'string' && ids.has(transactionId);
    });

    if (matched.length === 0) return { revertedActivities: 0, revertedXP: 0 };

    const revertedXP = matched.reduce((sum, activity) => sum + Math.max(0, Number(activity.xpEarned) || 0), 0);
    const activityIds = matched.map((activity) => activity.id);

    const result = await prisma.$transaction(async (tx) => {
      await tx.userActivity.deleteMany({ where: { id: { in: activityIds }, userId } });

      const user = await tx.user.findUnique({ where: { id: userId }, select: { xp: true } });
      const nextXP = Math.max(0, (user?.xp ?? 0) - revertedXP);
      const nextLevel = levelFromXP(nextXP);
      const nextCompanionLevel = companionLevelFromXP(nextXP);

      await tx.user.update({
        where: { id: userId },
        data: {
          xp: nextXP,
          level: nextLevel,
          progressionProfile: {
            upsert: {
              create: {
                totalXP: nextXP,
                companionLevel: nextCompanionLevel,
                companionMood: 'neutral',
              },
              update: {
                totalXP: nextXP,
                companionLevel: nextCompanionLevel,
              },
            },
          },
        },
      });

      return { revertedActivities: activityIds.length, revertedXP };
    });

    return result;
  }

  async ensureProfile(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, xp: true, referralCode: true },
    });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    const referralCode = user.referralCode ?? makeReferralCode(user.id);

    await prisma.user.update({
      where: { id: userId },
      data: {
        referralCode,
        progressionProfile: {
          upsert: {
            create: {
              totalXP: user.xp,
              companionLevel: companionLevelFromXP(user.xp),
              companionMood: 'neutral',
            },
            update: {},
          },
        },
      },
    });
  }

  async applyReferralCode(userId: string, rawCode: unknown) {
    const code = normalizeReferralCode(rawCode);

    if (!code) {
      throw new BadRequestError('Referral code is required');
    }

    const [user, referrer] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId }, select: { id: true, referrerId: true, referralCode: true } }),
      prisma.user.findFirst({ where: { referralCode: code }, select: { id: true, referralCode: true } }),
    ]);

    if (!user) throw new NotFoundError('User not found');
    if (!referrer) throw new NotFoundError('Referral code not found');
    if (referrer.id === userId) throw new BadRequestError('Cannot use your own referral code');
    if (user.referrerId) throw new BadRequestError('Referral code is already applied');

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { referrerId: referrer.id },
      });

      await tx.referralTransaction.create({
        data: {
          userId: referrer.id,
          fromUserId: userId,
          amount: XP_RULES.REFERRAL_REGISTERED,
          level: 1,
          type: 'xp',
          status: 'pending',
        },
      });
    });

    await this.addXP({
      userId: referrer.id,
      rule: 'REFERRAL_REGISTERED',
      type: 'referral_registered',
      payload: { invitedUserId: userId },
    });

    return this.getSnapshot(userId);
  }

  async activateReferral(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, referrerId: true },
    });

    if (!user?.referrerId) return null;

    const pending = await prisma.referralTransaction.findFirst({
      where: {
        fromUserId: userId,
        userId: user.referrerId,
        status: 'pending',
      },
    });

    if (!pending) return null;

    await prisma.$transaction(async (tx) => {
      await tx.referralTransaction.update({
        where: { id: pending.id },
        data: {
          status: 'completed',
          amount: XP_RULES.REFERRAL_ACTIVE,
          completedAt: new Date(),
        },
      });

      await tx.user.update({
        where: { id: user.referrerId! },
        data: {
          referralBalance: { increment: XP_RULES.REFERRAL_ACTIVE },
        },
      });
    });

    return this.addXP({
      userId: user.referrerId,
      rule: 'REFERRAL_ACTIVE',
      type: 'referral_active',
      payload: { invitedUserId: userId },
    });
  }

  private ruleForActivity(type: ActivityType) {
    switch (type) {
      case 'expense_created':
        return 'EXPENSE_CREATED';
      case 'income_created':
        return 'INCOME_CREATED';
      case 'account_created':
        return 'ACCOUNT_CREATED';
      case 'transfer_created':
        return 'TRANSFER_CREATED';
      case 'category_created':
        return 'CATEGORY_CREATED';
      case 'section_created':
        return 'SECTION_CREATED';
      case 'budget_created':
        return 'BUDGET_CREATED';
      case 'goal_completed':
        return 'GOAL_COMPLETED';
      case 'referral_active':
        return 'REFERRAL_ACTIVE';
      case 'referral_registered':
        return 'REFERRAL_REGISTERED';
      case 'daily_activity':
      case 'ai_action_confirmed':
      case 'manual_action_completed':
      default:
        return 'DAILY_ACTIVITY';
    }
  }

  private resolveMood(type: ActivityType, streakDays: number) {
    if (type === 'expense_created') return 'focused';
    if (type === 'income_created') return 'positive';
    if (type === 'referral_active' || type === 'referral_registered') return 'social';
    if (streakDays >= 7) return 'proud';
    if (streakDays >= 3) return 'motivated';
    return 'neutral';
  }
}

export const progressionService = new ProgressionService();
