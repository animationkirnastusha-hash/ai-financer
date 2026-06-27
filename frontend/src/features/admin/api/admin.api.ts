import { apiClient } from '@/shared/api/client';

export type AdminOverview = {
  generatedAt: string;
  metrics: {
    usersTotal: number;
    usersToday: number;
    users7d: number;
    activeUsers30d: number;
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
  publicId: string;
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
export const adminApi = {
  overview: () => apiClient.get<AdminOverview>('/admin/overview'),
  users: (query = '') => {
    const search = query.trim();
    const suffix = search ? '?q=' + encodeURIComponent(search) : '';
    return apiClient.get<{ users: AdminUser[] }>('/admin/users' + suffix);
  },
  events: () => apiClient.get<{ events: AdminEvent[] }>('/admin/events'),
  monitoring: () => apiClient.get<AdminMonitoring>('/admin/monitoring'),
  resetUser: (userId: string, mode: AdminResetMode, confirm: string) => apiClient.post<{ success: boolean }>('/admin/users/' + userId + '/reset', { mode, confirm }),
  resetAll: (mode: AdminResetMode, confirm: string) => apiClient.post<{ success: boolean }>('/admin/reset', { mode, confirm }),
  restartTrial: (userId: string) => apiClient.post<{ success: boolean }>('/admin/users/' + userId + '/trial/restart'),
  processReferralRewards: () => apiClient.post<{ success: boolean; result: { referrers: number; checked: number; awarded: number } }>('/admin/referrals/process'),
  aiTraining: () => apiClient.get<{ items: AdminAITrainingExample[] }>('/admin/ai-training'),
  updateAITraining: (exampleId: string, payload: { correctedOutput?: string; success?: boolean }) =>
    apiClient.patch<{ success: boolean; result: AdminAITrainingExample }>('/admin/ai-training/' + exampleId, payload),
};
