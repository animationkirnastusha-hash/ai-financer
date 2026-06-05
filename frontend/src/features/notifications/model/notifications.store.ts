import { create } from 'zustand';
import {
  notificationsApi,
  type NotificationDto,
  type NotificationSettingsDto,
  type UpdateNotificationSettingsPayload,
} from '@/features/notifications/api/notifications.api';

type NotificationsState = {
  items: NotificationDto[];
  unreadCount: number;
  settings: NotificationSettingsDto | null;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  load: (force?: boolean) => Promise<void>;
  loadUnreadCount: () => Promise<void>;
  loadSettings: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  remove: (id: string) => Promise<void>;
  updateSettings: (input: UpdateNotificationSettingsPayload) => Promise<void>;
};

let lastLoadedAt = 0;

export const useNotificationsStore = create<NotificationsState>((set, get) => ({
  items: [],
  unreadCount: 0,
  settings: null,
  isLoading: false,
  isSaving: false,
  error: null,

  load: async (force = false) => {
    const now = Date.now();
    if (!force && now - lastLoadedAt < 15000 && get().items.length > 0) return;
    set({ isLoading: true, error: null });
    try {
      const items = await notificationsApi.list();
      lastLoadedAt = Date.now();
      set({ items, unreadCount: items.filter((item) => !item.isRead).length });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Не удалось загрузить уведомления.' });
    } finally {
      set({ isLoading: false });
    }
  },

  loadUnreadCount: async () => {
    try {
      const unreadCount = await notificationsApi.unreadCount();
      set({ unreadCount });
    } catch {
      // Счётчик не должен ломать интерфейс.
    }
  },

  loadSettings: async () => {
    try {
      const settings = await notificationsApi.settings();
      set({ settings });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Не удалось загрузить настройки уведомлений.' });
    }
  },

  markRead: async (id) => {
    const previous = get().items;
    set({ items: previous.map((item) => item.id === id ? { ...item, isRead: true } : item), unreadCount: Math.max(0, get().unreadCount - 1) });
    try {
      const updated = await notificationsApi.markRead(id);
      set({ items: get().items.map((item) => item.id === id ? updated : item) });
    } catch {
      set({ items: previous, unreadCount: previous.filter((item) => !item.isRead).length });
    }
  },

  markAllRead: async () => {
    const previous = get().items;
    set({ items: previous.map((item) => ({ ...item, isRead: true })), unreadCount: 0 });
    try {
      await notificationsApi.markAllRead();
    } catch {
      set({ items: previous, unreadCount: previous.filter((item) => !item.isRead).length });
    }
  },

  remove: async (id) => {
    const previous = get().items;
    const next = previous.filter((item) => item.id !== id);
    set({ items: next, unreadCount: next.filter((item) => !item.isRead).length });
    try {
      await notificationsApi.remove(id);
    } catch {
      set({ items: previous, unreadCount: previous.filter((item) => !item.isRead).length });
    }
  },

  updateSettings: async (input) => {
    set({ isSaving: true, error: null });
    try {
      const settings = await notificationsApi.updateSettings(input);
      set({ settings });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Не удалось сохранить настройки.' });
    } finally {
      set({ isSaving: false });
    }
  },
}));
