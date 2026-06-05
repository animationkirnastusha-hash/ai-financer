import { apiClient } from '@/shared/api/client';

export type NotificationDto = {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  severity?: 'info' | 'warning' | 'danger' | 'success' | string;
  relatedEntityType?: string | null;
  relatedEntityId?: string | null;
  action?: string | null;
  dueAt?: string | null;
  isRead: boolean;
  readAt?: string | null;
  archivedAt?: string | null;
  createdAt: string;
};

export type NotificationSettingsDto = {
  id: string;
  userId: string;
  inAppEnabled: boolean;
  telegramEnabled: boolean;
  remindDaysBefore: number;
  remindOnDueDate: boolean;
  remindOverdue: boolean;
  quietHoursEnabled: boolean;
  quietHoursFrom?: string | null;
  quietHoursTo?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type UpdateNotificationSettingsPayload = Partial<Pick<NotificationSettingsDto,
  'inAppEnabled' | 'telegramEnabled' | 'remindDaysBefore' | 'remindOnDueDate' | 'remindOverdue' | 'quietHoursEnabled' | 'quietHoursFrom' | 'quietHoursTo'
>>;

export const notificationsApi = {
  async list() {
    const payload = await apiClient.get<{ notifications?: NotificationDto[] } | NotificationDto[]>('/notifications');
    return Array.isArray(payload) ? payload : payload.notifications ?? [];
  },

  async unreadCount() {
    const payload = await apiClient.get<{ count: number }>('/notifications/unread-count');
    return Number(payload.count || 0);
  },

  async markRead(id: string) {
    const payload = await apiClient.post<{ notification: NotificationDto }>(`/notifications/${id}/read`);
    return payload.notification;
  },

  async markAllRead() {
    await apiClient.post('/notifications/read-all');
  },

  async remove(id: string) {
    await apiClient.delete(`/notifications/${id}`);
  },

  async settings() {
    const payload = await apiClient.get<{ settings: NotificationSettingsDto }>('/notifications/settings');
    return payload.settings;
  },

  async updateSettings(input: UpdateNotificationSettingsPayload) {
    const payload = await apiClient.patch<{ settings: NotificationSettingsDto }>('/notifications/settings', input);
    return payload.settings;
  },
};
