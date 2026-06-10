import { apiClient } from '@/shared/api/client';

export type AdminOverview = {
  generatedAt: string;
  metrics: {
    usersTotal: number;
    usersToday: number;
    users7d: number;
    activeUsers30d: number;
    premiumUsers: number;
    transactionsTotal: number;
    transactionsToday: number;
    accountsTotal: number;
    eventsToday: number;
    pendingActions: number;
  };
  acquisition: Array<{ source: string; count: number }>;
  screens: Array<{ screen: string; count: number }>;
  funnel: Array<{ step: string; count: number }>;
  dropoff: Array<{ screen: string; exits: number; avgDurationMs: number }>;
  monitoring: AdminMonitoring;
};

export type AdminMonitoring = {
  status: string;
  uptimeSec: number;
  windowMinutes: number;
  totals: {
    requests: number;
    errors: number;
    errorRate: number;
    slowRequests: number;
    avgMs: number;
    p95Ms: number;
  };
  topEndpoints: Array<{ path: string; count: number; errors: number; avgMs: number }>;
  recentAlerts: Array<{
    id: string;
    level: 'warning' | 'critical';
    title: string;
    message: string;
    createdAt: string;
    meta?: Record<string, unknown>;
  }>;
};

export type AdminUser = {
  id: string;
  telegramId: string;
  firstName: string;
  lastName: string | null;
  username: string | null;
  tier: string;
  isAdmin: boolean;
  referralCode: string | null;
  referralBalance: number;
  xp: number;
  level: number;
  streakDays: number;
  lastActiveAt: string | null;
  createdAt: string;
  subscription?: {
    premiumUntil: string | null;
    businessUntil: string | null;
    trialUntil: string | null;
    premiumLifetime: boolean;
    businessLifetime: boolean;
  } | null;
  _count: {
    accounts: number;
    transactions: number;
    referrals: number;
  };
};

export type AdminEvent = {
  id: string;
  event: string;
  data: Record<string, unknown> | null;
  createdAt: string;
  user: {
    firstName: string;
    username: string | null;
  } | null;
};

export type AdminAITrainingExample = {
  id: string;
  userId: string | null;
  input: string;
  aiOutput: string | null;
  correctedOutput: string | null;
  success: boolean;
  error: string | null;
  model: string | null;
  latencyMs: number | null;
  createdAt: string;
};

export type AdminResetMode = 'finance' | 'full';
export type AdminSubscriptionProduct = 'premium' | 'business';

export const adminApi = {
  overview: () => apiClient.get<AdminOverview>('/admin/overview'),
  users: () => apiClient.get<{ users: AdminUser[] }>('/admin/users'),
  events: () => apiClient.get<{ events: AdminEvent[] }>('/admin/events'),
  monitoring: () => apiClient.get<AdminMonitoring>('/admin/monitoring'),
  resetUser: (userId: string, mode: AdminResetMode) => apiClient.post<{ success: boolean }>('/admin/users/' + userId + '/reset', { mode }),
  resetAll: (mode: AdminResetMode) => apiClient.post<{ success: boolean }>('/admin/reset', { mode }),
  grantSubscription: (userId: string, product: AdminSubscriptionProduct, days: number) =>
    apiClient.post<{ success: boolean }>('/admin/users/' + userId + '/subscription/grant', { product, days }),
  grantLifetimeSubscription: (userId: string, product: AdminSubscriptionProduct) =>
    apiClient.post<{ success: boolean }>('/admin/users/' + userId + '/subscription/grant', { product, lifetime: true }),
  revokeSubscription: (userId: string, product: AdminSubscriptionProduct) =>
    apiClient.post<{ success: boolean }>('/admin/users/' + userId + '/subscription/revoke', { product }),
  restartTrial: (userId: string) => apiClient.post<{ success: boolean }>('/admin/users/' + userId + '/trial/restart'),
  processReferralRewards: () => apiClient.post<{ success: boolean; result: { referrers: number; checked: number; awarded: number } }>('/admin/referrals/process'),
  aiTraining: () => apiClient.get<{ items: AdminAITrainingExample[] }>('/admin/ai-training'),
  updateAITraining: (exampleId: string, payload: { correctedOutput?: string; success?: boolean }) =>
    apiClient.patch<{ success: boolean; result: AdminAITrainingExample }>('/admin/ai-training/' + exampleId, payload),
};
