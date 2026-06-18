import { apiClient } from '@/shared/api/client';

export type AuthUserDto = {
  id: string;
  publicId?: string;
  telegramId?: string;
  username?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  photoUrl?: string | null;
  tier?: string;
  isAdmin?: boolean;
  locale?: 'en' | 'ru' | null;
};

export type LoginResponse = {
  token: string;
  user: AuthUserDto;
  mode: 'development' | 'telegram' | 'telegram_fallback' | string;
};

export type FallbackInfoResponse = {
  enabled: boolean;
  botUsername: string | null;
  botUrl: string | null;
  ttlSeconds: number;
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

  updateLocale: (locale: 'en' | 'ru') =>
    apiClient.patch<{
      user: AuthUserDto;
    }>('/auth/locale', { locale }),

  fallbackInfo: () => apiClient.get<FallbackInfoResponse>('/auth/fallback/info'),

  verifyFallbackCode: (code: string) =>
    apiClient.post<LoginResponse>('/auth/fallback/verify-code', { code }),
};
