import { apiClient } from '@/shared/api/client';

type AnalyticsPayload = Record<string, unknown>;

export const productAnalyticsApi = {
  track: (event: string, data?: AnalyticsPayload) =>
    apiClient.post<void>('/analytics/events', { event, data }),
};
