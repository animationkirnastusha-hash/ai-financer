import { apiClient } from '@/shared/api/client';

export type DataResetMode = 'finance' | 'full';

export type DataResetResult = {
  mode: DataResetMode;
  scope: 'single' | 'all';
  userId: string | null;
  deleted: Record<string, number>;
  updated: Record<string, number>;
};

export const dataResetApi = {
  resetMe: (mode: DataResetMode) => apiClient.post<{ success: boolean; result: DataResetResult }>('/users/me/reset', { mode }),
};
