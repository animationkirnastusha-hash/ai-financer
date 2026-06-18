import { create } from 'zustand';
import { authApi, type AuthUserDto } from '@/features/chat/api/auth.api';
import { hasTelegramRuntime } from '@/shared/lib/telegram';
import { clearAccessToken, setAccessToken } from '@/features/auth/lib/accessToken';
import { useSettingsStore } from '@/features/settings/model/settings.store';
import type { AppLanguage } from '@/features/settings/model/settings.types';

type AuthState = {
  user: AuthUserDto | null;
  token: string | null;
  isReady: boolean;
  isLoading: boolean;
  error: string | null;

  bootstrap: (initData?: string) => Promise<void>;
  loginWithFallbackCode: (code: string) => Promise<void>;
  syncUserLocale: (locale: AppLanguage) => Promise<void>;
  logout: () => void;
};

const AUTH_MODE_KEY = 'auth-mode';

function clearLegacyAuthStorage() {
  localStorage.removeItem('auth-token');
  localStorage.removeItem(AUTH_MODE_KEY);
}

function saveAuth(response: { token: string; mode: string; user: AuthUserDto }) {
  setAccessToken(response.token);
  localStorage.setItem(AUTH_MODE_KEY, response.mode);
}

function applyRemoteLocale(user: AuthUserDto | null | undefined) {
  if (user?.locale) {
    useSettingsStore.getState().applyRemoteLanguage(user.locale);
  }
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  isReady: false,
  isLoading: false,
  error: null,

  bootstrap: async (initData) => {
    set({ isLoading: true, error: null });

    try {
      const telegramRuntime = hasTelegramRuntime();
      const hasTelegramInitData = Boolean(initData && initData.length > 20);

      /**
       * Если приложение открыто внутри Telegram, но initData нет —
       * не используем старый dev-token, иначе разные люди увидят одну базу.
       * Дальше AuthBootstrap покажет безопасный вход через код из бота.
       */
      if (telegramRuntime && !hasTelegramInitData) {
        clearAccessToken();
        clearLegacyAuthStorage();

        throw new Error('Не удалось подтвердить вход через Telegram');
      }

      /**
       * В Telegram всегда перелогиниваемся через initData.
       */
      if (hasTelegramInitData) {
        clearAccessToken();
        clearLegacyAuthStorage();

        const response = await authApi.login(initData);

        saveAuth(response);
        applyRemoteLocale(response.user);

        set({
          user: response.user,
          token: response.token,
          isReady: true,
          isLoading: false,
        });

        return;
      }

      /**
       * Вне Telegram: dev/web режим.
       */
      clearLegacyAuthStorage();

      const response = await authApi.login();

      saveAuth(response);
      applyRemoteLocale(response.user);

      set({
        user: response.user,
        token: response.token,
        isReady: true,
        isLoading: false,
      });
    } catch (error) {
      console.error('Auth bootstrap failed', error);

      clearAccessToken();
      clearLegacyAuthStorage();

      set({
        user: null,
        token: null,
        isReady: true,
        isLoading: false,
        error:
          error instanceof Error
            ? error.message
            : 'Не удалось авторизоваться',
      });
    }
  },

  loginWithFallbackCode: async (code) => {
    set({ isLoading: true, error: null });

    try {
      const response = await authApi.verifyFallbackCode(code);

      saveAuth(response);
      applyRemoteLocale(response.user);

      set({
        user: response.user,
        token: response.token,
        isReady: true,
        isLoading: false,
        error: null,
      });
    } catch (error) {
      set({
        user: null,
        token: null,
        isReady: true,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Код входа не подошёл',
      });
    }
  },

  syncUserLocale: async (locale) => {
    const currentUser = get().user;
    if (!currentUser) return;

    set({ user: { ...currentUser, locale } });

    try {
      const response = await authApi.updateLocale(locale);
      set({ user: response.user });
    } catch {
      set({ user: currentUser });
    }
  },

  logout: () => {
    clearAccessToken();
    clearLegacyAuthStorage();

    set({
      user: null,
      token: null,
      isReady: true,
      isLoading: false,
      error: null,
    });
  },
}));
