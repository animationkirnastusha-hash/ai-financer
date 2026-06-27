import { create } from 'zustand';
import { authApi, type AuthUserDto } from '@/features/chat/api/auth.api';
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
const AUTH_GUEST_DEVICE_ID_KEY = 'auth-guest-device-id';

function getOrCreateGuestDeviceId() {
  let value = localStorage.getItem(AUTH_GUEST_DEVICE_ID_KEY);
  if (value && value.length >= 12) return value;

  value = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `guest-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  localStorage.setItem(AUTH_GUEST_DEVICE_ID_KEY, value);
  return value;
}

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
      const hasTelegramInitData = Boolean(initData && initData.length > 20);

      /**
       * В официальном Telegram всегда перелогиниваемся через initData.
       * Если клиент не отдаёт initData, временно используем отдельный
       * device-id, чтобы пользователь не попадал в общую dev-базу.
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
       * Неофициальный Telegram / web fallback без initData.
       * Официальный initData-flow выше не меняется.
       */
      clearLegacyAuthStorage();

      const fallbackDeviceId = getOrCreateGuestDeviceId();
      const response = await authApi.login(undefined, fallbackDeviceId);

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
