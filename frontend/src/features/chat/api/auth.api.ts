import { apiClient } from '@/shared/api/client';

export type AuthUserDto = {
  id: string;
  telegramId?: string;
  username?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  photoUrl?: string | null;
  tier?: string;
  isAdmin?: boolean;
};

export type LoginResponse = {
  token: string;
  user: AuthUserDto;
  mode: 'development' | 'telegram' | string;
};

export const authApi = {
  login: (initData?: string) =>
    apiClient.post<LoginResponse>('/auth/login', {
      initData,
    }),

  me: () =>
    apiClient.get<{
      user: AuthUserDto;
    }>('/auth/me'),
};