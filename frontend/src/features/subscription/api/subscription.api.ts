import { apiClient } from '@/shared/api/client';

export type SubscriptionAccess = {
  status: 'free' | 'trial' | 'premium' | 'business' | string;
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

export type SubscriptionUsageCounter = {
  used: number;
  limit: number;
  remaining: number;
};

export type SubscriptionPackageCredit = {
  granted: number;
  used: number;
  remaining: number;
};

export type SubscriptionActivePack = {
  id: string;
  product: 'bundle_try' | 'bundle_week' | string;
  title: string;
  expiresAt: string;
  voiceCommands: number;
  receiptScans: number;
  advancedReports: number;
  reports: number;
};

export type SubscriptionPackageCreditsDto = {
  voiceCommands: SubscriptionPackageCredit;
  receiptScans: SubscriptionPackageCredit;
  advancedReports: SubscriptionPackageCredit;
  reports: SubscriptionPackageCredit;
  activePacks: SubscriptionActivePack[];
};

export type SubscriptionStatusDto = {
  access: SubscriptionAccess;
  features: Record<string, boolean>;
  limits: {
    voiceCommandsPerDay: number;
    receiptScansPerMonth: number;
    advancedReportsPerMonth: number;
  };
  usage?: {
    voiceCommandsToday: SubscriptionUsageCounter;
    receiptScansThisMonth: SubscriptionUsageCounter;
    advancedReportsThisMonth: SubscriptionUsageCounter;
  };
  packageCredits?: SubscriptionPackageCreditsDto;
  referralBalance: number;
};

export type SubscriptionFeatureAccessDto = {
  feature: string;
  allowed: boolean;
  access: SubscriptionAccess;
  limits: SubscriptionStatusDto['limits'];
  usage?: SubscriptionStatusDto['usage'];
  packageCredits?: SubscriptionPackageCreditsDto;
};

export type StartTrialPayload = {
  telegramReminderConsent: boolean;
};

export const subscriptionApi = {
  me: () => apiClient.get<SubscriptionStatusDto>('/subscription/me'),
  startTrial: (payload: StartTrialPayload) => apiClient.post<SubscriptionStatusDto>('/subscription/trial/start', payload),
  feature: (feature: string) => apiClient.get<SubscriptionFeatureAccessDto>(`/subscription/features/${encodeURIComponent(feature)}`),
};
