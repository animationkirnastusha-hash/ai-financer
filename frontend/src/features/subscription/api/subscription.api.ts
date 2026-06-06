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

export type SubscriptionStatusDto = {
  access: SubscriptionAccess;
  features: Record<string, boolean>;
  limits: {
    voiceCommandsPerDay: number;
    receiptScansPerMonth: number;
    advancedReportsPerMonth: number;
  };
  referralBalance: number;
};

export const subscriptionApi = {
  me: () => apiClient.get<SubscriptionStatusDto>('/subscription/me'),
  startTrial: () => apiClient.post<SubscriptionStatusDto>('/subscription/trial/start'),
};
