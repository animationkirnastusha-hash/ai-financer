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
  referralBalance: number;
};

export type SubscriptionFeatureAccessDto = {
  feature: string;
  allowed: boolean;
  access: SubscriptionAccess;
  limits: SubscriptionStatusDto['limits'];
  usage?: SubscriptionStatusDto['usage'];
};

export const subscriptionApi = {
  me: () => apiClient.get<SubscriptionStatusDto>('/subscription/me'),
  startTrial: () => apiClient.post<SubscriptionStatusDto>('/subscription/trial/start'),
  feature: (feature: string) => apiClient.get<SubscriptionFeatureAccessDto>(`/subscription/features/${encodeURIComponent(feature)}`),
};
