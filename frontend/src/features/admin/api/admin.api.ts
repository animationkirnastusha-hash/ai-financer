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

export const adminApi = {
  overview: () => apiClient.get<AdminOverview>('/admin/overview'),
  users: () => apiClient.get<{ users: AdminUser[] }>('/admin/users'),
  events: () => apiClient.get<{ events: AdminEvent[] }>('/admin/events'),
  monitoring: () => apiClient.get<AdminMonitoring>('/admin/monitoring'),
};
