import { prisma } from '../../lib/prisma';
import { BadRequestError, ForbiddenError, NotFoundError } from '../../shared/core/errors';
import type { AIOperationEvent, Subscription } from '@prisma/client';

export type StoreProduct = 'premium' | 'business' | 'bundle_try' | 'bundle_week';
export type SubscriptionProduct = 'premium' | 'business';
export type BundleProduct = 'bundle_try' | 'bundle_week';
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

type PackageCreditBucket = {
  granted: number;
  used: number;
  remaining: number;
};

type ActivePackage = {
  id: string;
  product: BundleProduct;
  title: string;
  expiresAt: string;
  voiceCommands: number;
  receiptScans: number;
  advancedReports: number;
  reports: number;
};

type PackageCreditsSnapshot = {
  voiceCommands: PackageCreditBucket;
  receiptScans: PackageCreditBucket;
  advancedReports: PackageCreditBucket;
  reports: PackageCreditBucket;
  activePacks: ActivePackage[];
};

type SubscriptionStatus = {
  access: SubscriptionAccess;
  features: SubscriptionFeatureMap;
  limits: SubscriptionLimits;
  usage: SubscriptionUsageSnapshot;
  packageCredits: PackageCreditsSnapshot;
  referralBalance: number;
};

type GrantInput = {
  product?: SubscriptionProduct;
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

const BUNDLE_GRANTED_EVENT = 'subscription.bundle.granted';

const BUNDLE_CATALOG: Record<BundleProduct, {
  title: string;
  days: number;
  voiceCommands: number;
  receiptScans: number;
  advancedReports: number;
  reports: number;
}> = {
  bundle_try: {
    title: 'Попробовать Фину',
    days: 30,
    voiceCommands: 10,
    receiptScans: 2,
    advancedReports: 1,
    reports: 0,
  },
  bundle_week: {
    title: 'На неделю',
    days: 30,
    voiceCommands: 30,
    receiptScans: 5,
    advancedReports: 2,
    reports: 1,
  },
};

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

function normalizeProduct(value: unknown): SubscriptionProduct {
  return value === 'business' ? 'business' : 'premium';
}

function normalizeBundleProduct(value: unknown): BundleProduct {
  if (value === 'bundle_week') return 'bundle_week';
  if (value === 'bundle_try') return 'bundle_try';
  throw new BadRequestError('Unknown bundle');
}

function normalizeDays(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) return 30;
  return Math.min(3650, Math.max(1, Math.round(parsed)));
}

function parsePayload(value: string | null | undefined): Record<string, unknown> | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

function readNumber(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : 0;
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function isBundleUsage(event: AIOperationEvent): boolean {
  return parsePayload(event.payload)?.creditSource === 'bundle';
}

function buildCreditBucket(granted: number, used: number): PackageCreditBucket {
  return { granted, used, remaining: Math.max(0, granted - used) };
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

  private getFeatureMap(access: { hasPremium: boolean; hasBusiness: boolean }, packageCredits: PackageCreditsSnapshot): SubscriptionFeatureMap {
    const hasReceiptCredits = packageCredits.receiptScans.remaining > 0;
    const hasAnalysisCredits = packageCredits.advancedReports.remaining > 0 || packageCredits.reports.remaining > 0;

    return {
      store: true,
      referralRewards: true,
      basicReports: true,
      basicLimits: true,
      basicVoicePin: true,
      longVoiceDialog: access.hasPremium,
      advancedAnalytics: access.hasPremium || hasAnalysisCredits,
      advancedReports: access.hasPremium || hasAnalysisCredits,
      receiptScan: access.hasPremium || hasReceiptCredits,
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
    return { voiceCommandsPerDay: 10, receiptScansPerMonth: 0, advancedReportsPerMonth: 0 };
  }

  async getStatus(userId: string): Promise<SubscriptionStatus> {
    await this.ensureUser(userId);
    const subscription = await this.ensureSubscription(userId);
    const access = this.getAccess(subscription);
    const limits = this.getLimits(access);
    const [usage, packageCredits, referralBalance] = await Promise.all([
      this.getUsageSnapshot(userId, limits),
      this.getPackageCredits(userId),
      this.getReferralBalance(userId),
    ]);

    return {
      access,
      features: this.getFeatureMap(access, packageCredits),
      limits,
      usage,
      packageCredits,
      referralBalance,
    };
  }

  async getPackageCredits(userId: string): Promise<PackageCreditsSnapshot> {
    const now = new Date();
    const grantEvents = await prisma.aIOperationEvent.findMany({
      where: { userId, type: BUNDLE_GRANTED_EVENT },
      orderBy: { createdAt: 'asc' },
      take: 200,
    });

    const activePacks: ActivePackage[] = [];
    let voiceGranted = 0;
    let receiptsGranted = 0;
    let analysesGranted = 0;
    let reportsGranted = 0;
    let earliestActiveGrant: Date | null = null;

    for (const event of grantEvents) {
      const payload = parsePayload(event.payload);
      const expiresText = readString(payload?.expiresAt);
      const expiresAt = expiresText ? new Date(expiresText) : null;
      if (!expiresAt || expiresAt.getTime() <= now.getTime()) continue;

      const product = payload?.product === 'bundle_week' ? 'bundle_week' : 'bundle_try';
      const pack: ActivePackage = {
        id: event.id,
        product,
        title: readString(payload?.title) ?? BUNDLE_CATALOG[product].title,
        expiresAt: expiresAt.toISOString(),
        voiceCommands: readNumber(payload?.voiceCommands),
        receiptScans: readNumber(payload?.receiptScans),
        advancedReports: readNumber(payload?.advancedReports),
        reports: readNumber(payload?.reports),
      };

      activePacks.push(pack);
      voiceGranted += pack.voiceCommands;
      receiptsGranted += pack.receiptScans;
      analysesGranted += pack.advancedReports;
      reportsGranted += pack.reports;
      if (!earliestActiveGrant || event.createdAt.getTime() < earliestActiveGrant.getTime()) earliestActiveGrant = event.createdAt;
    }

    const usageEvents = earliestActiveGrant
      ? await prisma.aIOperationEvent.findMany({
        where: {
          userId,
          type: { in: [USAGE_EVENT.voiceCommands, USAGE_EVENT.receiptScans, USAGE_EVENT.advancedReports] },
          createdAt: { gte: earliestActiveGrant },
        },
        orderBy: { createdAt: 'asc' },
        take: 500,
      })
      : [];

    const bundleUsageEvents = usageEvents.filter(isBundleUsage);
    const voiceUsed = bundleUsageEvents.filter((event) => event.type === USAGE_EVENT.voiceCommands).length;
    const receiptsUsed = bundleUsageEvents.filter((event) => event.type === USAGE_EVENT.receiptScans).length;
    const analysesUsed = bundleUsageEvents.filter((event) => event.type === USAGE_EVENT.advancedReports).length;

    return {
      voiceCommands: buildCreditBucket(voiceGranted, voiceUsed),
      receiptScans: buildCreditBucket(receiptsGranted, receiptsUsed),
      advancedReports: buildCreditBucket(analysesGranted, analysesUsed),
      reports: buildCreditBucket(reportsGranted, 0),
      activePacks,
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
    if (voice.remaining > 0) return voice;

    const packageVoice = status.packageCredits.voiceCommands;
    if (packageVoice.remaining > 0) {
      return { used: packageVoice.used, limit: packageVoice.granted, remaining: packageVoice.remaining };
    }

    throw new ForbiddenError('Voice command limit reached', {
      feature: 'voiceCommands',
      used: voice.used,
      limit: voice.limit,
    });
  }

  private getUsageCreditSource(kind: SubscriptionUsageKind, status: SubscriptionStatus): 'base' | 'subscription' | 'bundle' {
    if (kind === 'voiceCommands') {
      if (status.usage.voiceCommandsToday.remaining > 0) return status.access.hasPremium ? 'subscription' : 'base';
      if (status.packageCredits.voiceCommands.remaining > 0) return 'bundle';
      return status.access.hasPremium ? 'subscription' : 'base';
    }

    if (kind === 'receiptScans') {
      if (status.access.hasPremium && status.usage.receiptScansThisMonth.remaining > 0) return 'subscription';
      if (status.packageCredits.receiptScans.remaining > 0) return 'bundle';
      return status.access.hasPremium ? 'subscription' : 'base';
    }

    if (status.access.hasPremium && status.usage.advancedReportsThisMonth.remaining > 0) return 'subscription';
    if (status.packageCredits.advancedReports.remaining > 0 || status.packageCredits.reports.remaining > 0) return 'bundle';
    return status.access.hasPremium ? 'subscription' : 'base';
  }

  async recordUsage(userId: string, kind: SubscriptionUsageKind, details?: Record<string, unknown>): Promise<SubscriptionStatus> {
    const statusBefore = await this.getStatus(userId);
    const creditSource = this.getUsageCreditSource(kind, statusBefore);

    await prisma.aIOperationEvent.create({
      data: {
        userId,
        type: USAGE_EVENT[kind],
        severity: 'info',
        scope: kind,
        message: 'usage_recorded',
        payload: JSON.stringify({ ...(details ?? {}), creditSource }),
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
    packageCredits: PackageCreditsSnapshot;
  }> {
    const status = await this.getStatus(userId);
    return {
      feature,
      allowed: Boolean(status.features[feature]),
      access: status.access,
      limits: status.limits,
      usage: status.usage,
      packageCredits: status.packageCredits,
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

  async grantBundle(userId: string, productInput: unknown): Promise<SubscriptionStatus> {
    await this.ensureUser(userId);
    const product = normalizeBundleProduct(productInput);
    const bundle = BUNDLE_CATALOG[product];
    const now = new Date();
    const expiresAt = new Date(now.getTime() + bundle.days * DAY_MS);

    await prisma.aIOperationEvent.create({
      data: {
        userId,
        type: BUNDLE_GRANTED_EVENT,
        severity: 'info',
        scope: 'store_bundle',
        message: 'bundle_granted',
        payload: JSON.stringify({
          product,
          title: bundle.title,
          voiceCommands: bundle.voiceCommands,
          receiptScans: bundle.receiptScans,
          advancedReports: bundle.advancedReports,
          reports: bundle.reports,
          expiresAt: expiresAt.toISOString(),
        }),
      },
    });

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
