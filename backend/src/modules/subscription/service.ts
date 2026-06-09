import { prisma } from '../../lib/prisma';
import { BadRequestError, ForbiddenError, NotFoundError } from '../../shared/core/errors';
import type { Subscription } from '@prisma/client';

export type StoreProduct = 'premium' | 'business';
export type GrantMode = 'days' | 'lifetime';
export type SubscriptionUsageKind = 'voiceCommands' | 'receiptScans' | 'advancedReports';

export type SubscriptionLimits = {
  voiceCommandsPerDay: number;
  receiptScansPerMonth: number;
  advancedReportsPerMonth: number;
};

type SubscriptionStatusCode = 'free' | 'trial' | 'premium' | 'business';

type SubscriptionAccess = {
  status: SubscriptionStatusCode;
  hasPremium: boolean;
  hasBusiness: boolean;
  trialActive: boolean;
  trialUsed: boolean;
  premiumUntil: string | null;
  businessUntil: string | null;
  trialUntil: string | null;
  premiumLifetime: boolean;
  businessLifetime: boolean;
};

type SubscriptionFeatureMap = Record<string, boolean> & {
  store: boolean;
  referralRewards: boolean;
  basicReports: boolean;
  basicLimits: boolean;
  basicVoicePin: boolean;
  longVoiceDialog: boolean;
  advancedAnalytics: boolean;
  advancedReports: boolean;
  receiptScan: boolean;
  creditAdvice: boolean;
  businessWorkspace: boolean;
  businessReports: boolean;
};

type UsageLimitBucket = {
  used: number;
  limit: number;
  remaining: number;
};

type SubscriptionUsageSnapshot = {
  voiceCommandsToday: UsageLimitBucket;
  receiptScansThisMonth: UsageLimitBucket;
  advancedReportsThisMonth: UsageLimitBucket;
};

type SubscriptionStatus = {
  access: SubscriptionAccess;
  features: SubscriptionFeatureMap;
  limits: SubscriptionLimits;
  usage: SubscriptionUsageSnapshot;
  referralBalance: number;
};

type GrantInput = {
  product?: StoreProduct;
  days?: number;
  lifetime?: boolean;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const TRIAL_DAYS = 7;

const USAGE_EVENT = {
  voiceCommands: 'subscription.voice_command.used',
  receiptScans: 'subscription.receipt_scan.used',
  advancedReports: 'subscription.advanced_report.used',
} as const;

function asDateOrNull(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

function isFuture(value: Date | null | undefined, now = new Date()): boolean {
  return Boolean(value && value.getTime() > now.getTime());
}

function addDaysFromBase(base: Date | null | undefined, days: number): Date {
  const now = new Date();
  const start = base && base.getTime() > now.getTime() ? base : now;
  return new Date(start.getTime() + Math.max(1, Math.round(days)) * DAY_MS);
}

function startOfDay(date = new Date()): Date {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
}

function startOfMonth(date = new Date()): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function clampRemaining(limit: number, used: number): number {
  return Math.max(0, limit - used);
}

function normalizeProduct(value: unknown): StoreProduct {
  return value === 'business' ? 'business' : 'premium';
}

function normalizeDays(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) return 30;
  return Math.min(3650, Math.max(1, Math.round(parsed)));
}

export class SubscriptionService {
  private async ensureUser(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, tier: true },
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

  private getAccess(subscription: Subscription | null): SubscriptionAccess {
    const now = new Date();
    const trialActive = isFuture(subscription?.trialUntil, now);
    const businessActive = Boolean(subscription?.businessLifetime || isFuture(subscription?.businessUntil, now));
    const premiumActive = Boolean(subscription?.premiumLifetime || isFuture(subscription?.premiumUntil, now) || trialActive || businessActive);

    const status: SubscriptionStatusCode = businessActive
      ? 'business'
      : premiumActive
        ? (trialActive && !subscription?.premiumLifetime && !isFuture(subscription?.premiumUntil, now) ? 'trial' : 'premium')
        : 'free';

    return {
      status,
      hasPremium: premiumActive,
      hasBusiness: businessActive,
      trialActive,
      trialUsed: Boolean(subscription?.trialStartedAt),
      premiumUntil: asDateOrNull(subscription?.premiumUntil),
      businessUntil: asDateOrNull(subscription?.businessUntil),
      trialUntil: asDateOrNull(subscription?.trialUntil),
      premiumLifetime: Boolean(subscription?.premiumLifetime),
      businessLifetime: Boolean(subscription?.businessLifetime),
    };
  }

  private getFeatureMap(access: { hasPremium: boolean; hasBusiness: boolean }): SubscriptionFeatureMap {
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

  private getLimits(access: { hasPremium: boolean; hasBusiness: boolean }): SubscriptionLimits {
    if (access.hasBusiness) {
      return { voiceCommandsPerDay: 1000, receiptScansPerMonth: 250, advancedReportsPerMonth: 100 };
    }
    if (access.hasPremium) {
      return { voiceCommandsPerDay: 500, receiptScansPerMonth: 100, advancedReportsPerMonth: 50 };
    }
    return { voiceCommandsPerDay: 50, receiptScansPerMonth: 0, advancedReportsPerMonth: 0 };
  }

  async getStatus(userId: string): Promise<SubscriptionStatus> {
    await this.ensureUser(userId);
    const subscription = await this.ensureSubscription(userId);
    const access = this.getAccess(subscription);
    const limits = this.getLimits(access);

    return {
      access,
      features: this.getFeatureMap(access),
      limits,
      usage: await this.getUsageSnapshot(userId, limits),
      referralBalance: await this.getReferralBalance(userId),
    };
  }

  async getUsageSnapshot(userId: string, limitsInput?: SubscriptionLimits): Promise<SubscriptionUsageSnapshot> {
    const limits: SubscriptionLimits = limitsInput ?? (await this.getStatus(userId)).limits;
    const today = startOfDay();
    const month = startOfMonth();

    const [voiceCommandsToday, receiptScansThisMonth, advancedReportsThisMonth] = await Promise.all([
      prisma.aIOperationEvent.count({
        where: {
          userId,
          type: USAGE_EVENT.voiceCommands,
          createdAt: { gte: today },
        },
      }),
      prisma.aIOperationEvent.count({
        where: {
          userId,
          type: USAGE_EVENT.receiptScans,
          createdAt: { gte: month },
        },
      }),
      prisma.aIOperationEvent.count({
        where: {
          userId,
          type: USAGE_EVENT.advancedReports,
          createdAt: { gte: month },
        },
      }),
    ]);

    return {
      voiceCommandsToday: {
        used: voiceCommandsToday,
        limit: limits.voiceCommandsPerDay,
        remaining: clampRemaining(limits.voiceCommandsPerDay, voiceCommandsToday),
      },
      receiptScansThisMonth: {
        used: receiptScansThisMonth,
        limit: limits.receiptScansPerMonth,
        remaining: clampRemaining(limits.receiptScansPerMonth, receiptScansThisMonth),
      },
      advancedReportsThisMonth: {
        used: advancedReportsThisMonth,
        limit: limits.advancedReportsPerMonth,
        remaining: clampRemaining(limits.advancedReportsPerMonth, advancedReportsThisMonth),
      },
    };
  }

  async assertVoiceCommandAllowed(userId: string): Promise<UsageLimitBucket> {
    const status = await this.getStatus(userId);
    const voice = status.usage.voiceCommandsToday;
    if (voice.remaining <= 0) {
      throw new ForbiddenError('Voice command limit reached', {
        feature: 'voiceCommands',
        used: voice.used,
        limit: voice.limit,
      });
    }
    return voice;
  }

  async recordUsage(userId: string, kind: SubscriptionUsageKind, details?: Record<string, unknown>): Promise<SubscriptionStatus> {
    await prisma.aIOperationEvent.create({
      data: {
        userId,
        type: USAGE_EVENT[kind],
        severity: 'info',
        scope: kind,
        message: 'usage_recorded',
        payload: details ? JSON.stringify(details) : null,
      },
    });
    return this.getStatus(userId);
  }

  async getFeatureAccess(userId: string, feature: string): Promise<{
    feature: string;
    allowed: boolean;
    access: SubscriptionAccess;
    limits: SubscriptionLimits;
    usage: SubscriptionUsageSnapshot;
  }> {
    const status = await this.getStatus(userId);
    return {
      feature,
      allowed: Boolean(status.features[feature]),
      access: status.access,
      limits: status.limits,
      usage: status.usage,
    };
  }

  private async getReferralBalance(userId: string): Promise<number> {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { referralBalance: true } });
    return user?.referralBalance ?? 0;
  }

  async startTrial(userId: string): Promise<SubscriptionStatus> {
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

  async restartTrial(userId: string): Promise<SubscriptionStatus> {
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

  async grant(userId: string, input: GrantInput): Promise<SubscriptionStatus> {
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

  async revoke(userId: string, product?: unknown): Promise<SubscriptionStatus> {
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

  async syncUserTier(userId: string): Promise<'FREE' | 'PREMIUM' | 'BUSINESS'> {
    await this.ensureUser(userId);
    const subscription = await this.ensureSubscription(userId);
    const access = this.getAccess(subscription);
    const tier: 'FREE' | 'PREMIUM' | 'BUSINESS' = access.hasBusiness ? 'BUSINESS' : access.hasPremium ? 'PREMIUM' : 'FREE';
    await prisma.user.update({ where: { id: userId }, data: { tier } });
    return tier;
  }
}

export const subscriptionService = new SubscriptionService();
