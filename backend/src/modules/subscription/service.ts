import { prisma } from '../../lib/prisma';
import { BadRequestError, NotFoundError } from '../../shared/core/errors';

export type StoreProduct = 'premium' | 'business';
export type GrantMode = 'days' | 'lifetime';

type GrantInput = {
  product?: StoreProduct;
  days?: number;
  lifetime?: boolean;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const TRIAL_DAYS = 7;

function asDateOrNull(value: Date | null | undefined) {
  return value ? value.toISOString() : null;
}

function isFuture(value: Date | null | undefined, now = new Date()) {
  return Boolean(value && value.getTime() > now.getTime());
}

function addDaysFromBase(base: Date | null | undefined, days: number) {
  const now = new Date();
  const start = base && base.getTime() > now.getTime() ? base : now;
  return new Date(start.getTime() + Math.max(1, Math.round(days)) * DAY_MS);
}

function normalizeProduct(value: unknown): StoreProduct {
  return value === 'business' ? 'business' : 'premium';
}

function normalizeDays(value: unknown) {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) return 30;
  return Math.min(3650, Math.max(1, Math.round(parsed)));
}

export class SubscriptionService {
  private async ensureUser(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, isAdmin: true, tier: true },
    });
    if (!user) throw new NotFoundError('User not found');
    return user;
  }

  private async ensureSubscription(userId: string) {
    await this.ensureUser(userId);

    return prisma.subscription.upsert({
      where: { userId },
      create: { userId },
      update: {},
    });
  }

  private getAccess(subscription: Awaited<ReturnType<typeof prisma.subscription.findUnique>>, isAdmin: boolean) {
    const now = new Date();
    const trialActive = isFuture(subscription?.trialUntil, now);
    const premiumActive = Boolean(isAdmin || subscription?.premiumLifetime || isFuture(subscription?.premiumUntil, now) || trialActive || subscription?.businessLifetime || isFuture(subscription?.businessUntil, now));
    const businessActive = Boolean(isAdmin || subscription?.businessLifetime || isFuture(subscription?.businessUntil, now));

    const status = businessActive ? 'business' : premiumActive ? (trialActive && !subscription?.premiumLifetime && !isFuture(subscription?.premiumUntil, now) ? 'trial' : 'premium') : 'free';

    return {
      status,
      hasPremium: premiumActive,
      hasBusiness: businessActive,
      trialActive,
      trialUsed: Boolean(subscription?.trialStartedAt),
      premiumUntil: asDateOrNull(subscription?.premiumUntil),
      businessUntil: asDateOrNull(subscription?.businessUntil),
      trialUntil: asDateOrNull(subscription?.trialUntil),
      premiumLifetime: Boolean(subscription?.premiumLifetime || isAdmin),
      businessLifetime: Boolean(subscription?.businessLifetime || isAdmin),
    };
  }

  private getFeatureMap(access: { hasPremium: boolean; hasBusiness: boolean }) {
    return {
      store: true,
      referralRewards: true,
      basicReports: true,
      basicLimits: true,
      basicVoicePin: true,
      longVoiceDialog: access.hasPremium,
      advancedAnalytics: access.hasPremium,
      advancedReports: access.hasPremium,
      receiptScan: access.hasPremium,
      creditAdvice: access.hasPremium,
      businessWorkspace: access.hasBusiness,
      businessReports: access.hasBusiness,
    };
  }

  private getLimits(access: { hasPremium: boolean; hasBusiness: boolean }) {
    if (access.hasBusiness) {
      return { voiceCommandsPerDay: 1000, receiptScansPerMonth: 250, advancedReportsPerMonth: 100 };
    }
    if (access.hasPremium) {
      return { voiceCommandsPerDay: 500, receiptScansPerMonth: 100, advancedReportsPerMonth: 50 };
    }
    return { voiceCommandsPerDay: 50, receiptScansPerMonth: 0, advancedReportsPerMonth: 0 };
  }

  async getStatus(userId: string) {
    const user = await this.ensureUser(userId);
    const subscription = await this.ensureSubscription(userId);
    const access = this.getAccess(subscription, user.isAdmin);

    return {
      access,
      features: this.getFeatureMap(access),
      limits: this.getLimits(access),
      referralBalance: await this.getReferralBalance(userId),
    };
  }

  private async getReferralBalance(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { referralBalance: true } });
    return user?.referralBalance ?? 0;
  }

  async startTrial(userId: string) {
    const subscription = await this.ensureSubscription(userId);
    if (subscription.trialStartedAt) {
      throw new BadRequestError('Trial already used');
    }

    const now = new Date();
    await prisma.subscription.update({
      where: { userId },
      data: {
        trialStartedAt: now,
        trialUntil: new Date(now.getTime() + TRIAL_DAYS * DAY_MS),
      },
    });
    await this.syncUserTier(userId);
    return this.getStatus(userId);
  }

  async restartTrial(userId: string) {
    await this.ensureSubscription(userId);
    const now = new Date();
    await prisma.subscription.update({
      where: { userId },
      data: {
        trialStartedAt: now,
        trialUntil: new Date(now.getTime() + TRIAL_DAYS * DAY_MS),
      },
    });
    await this.syncUserTier(userId);
    return this.getStatus(userId);
  }

  async grant(userId: string, input: GrantInput) {
    const product = normalizeProduct(input.product);
    const subscription = await this.ensureSubscription(userId);

    if (input.lifetime) {
      await prisma.subscription.update({
        where: { userId },
        data: product === 'business'
          ? { businessLifetime: true, premiumLifetime: true }
          : { premiumLifetime: true },
      });
      await this.syncUserTier(userId);
      return this.getStatus(userId);
    }

    const days = normalizeDays(input.days);
    const premiumUntil = addDaysFromBase(subscription.premiumUntil, days);

    if (product === 'business') {
      const businessUntil = addDaysFromBase(subscription.businessUntil, days);
      await prisma.subscription.update({
        where: { userId },
        data: { premiumUntil, businessUntil },
      });
    } else {
      await prisma.subscription.update({
        where: { userId },
        data: { premiumUntil },
      });
    }

    await this.syncUserTier(userId);
    return this.getStatus(userId);
  }

  async revoke(userId: string, product?: unknown) {
    const normalized = normalizeProduct(product);
    await this.ensureSubscription(userId);

    await prisma.subscription.update({
      where: { userId },
      data: normalized === 'business'
        ? { businessUntil: null, businessLifetime: false }
        : { premiumUntil: null, trialUntil: null, premiumLifetime: false, businessUntil: null, businessLifetime: false },
    });

    await this.syncUserTier(userId);
    return this.getStatus(userId);
  }

  async syncUserTier(userId: string) {
    const user = await this.ensureUser(userId);
    const subscription = await this.ensureSubscription(userId);
    const access = this.getAccess(subscription, user.isAdmin);
    const tier = access.hasBusiness ? 'BUSINESS' : access.hasPremium ? 'PREMIUM' : 'FREE';
    await prisma.user.update({ where: { id: userId }, data: { tier } });
    return tier;
  }
}

export const subscriptionService = new SubscriptionService();
