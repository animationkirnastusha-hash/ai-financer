import type { AdminOverview } from '@/features/admin/api/admin.api';

export type AdminTab = 'overview' | 'users' | 'events' | 'monitoring' | 'training' | 'tools';

export type AdminLoadError = {
  overview?: string;
  users?: string;
  events?: string;
};

export type AdminMonitoring = NonNullable<AdminOverview['monitoring']>;
