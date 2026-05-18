import { apiClient } from '@/shared/api/client';

export type CompanionStateDto = {
  mood?: 'calm' | 'focused' | 'warning' | 'celebrating' | string;
  level?: number;
  streakDays?: number;
  xp?: number;
  message?: string;
  recentEvents?: Array<{
    id?: string;
    type?: string;
    title?: string;
    message?: string;
    createdAt?: string;
  }>;
};

const fallback: CompanionStateDto = {
  mood: 'calm',
  level: 1,
  streakDays: 0,
  xp: 0,
  message: 'Финансовая картина собирается. Начни с одного действия.',
  recentEvents: [],
};

export const companionApi = {
  async getState() {
    try {
      return await apiClient.get<CompanionStateDto>('/companion/state');
    } catch {
      return fallback;
    }
  },

  async getEvents() {
    try {
      return await apiClient.get<CompanionStateDto['recentEvents']>('/companion/events');
    } catch {
      return [];
    }
  },
};
