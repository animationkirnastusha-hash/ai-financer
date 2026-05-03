import { apiClient } from '@/shared/api/client';
import type { PendingActionItem } from '@/features/pending-actions/model/pendingActions.types';

type PendingActionsResponse =
  | PendingActionItem[]
  | { items?: PendingActionItem[]; pendingActions?: PendingActionItem[] };

export const pendingActionsApi = {
  list: async (): Promise<PendingActionItem[]> => {
    const response = await apiClient.get<PendingActionsResponse>('/ai/pending-actions');

    if (Array.isArray(response)) return response;
    if (Array.isArray(response.items)) return response.items;
    if (Array.isArray(response.pendingActions)) return response.pendingActions;

    return [];
  },

  confirm: (pendingActionId: string) =>
    apiClient.post('/ai/confirm', { pendingActionId }),

  cancel: (pendingActionId: string) =>
    apiClient.post('/ai/cancel', { pendingActionId }),
};