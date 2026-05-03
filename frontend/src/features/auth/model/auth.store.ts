import { create } from 'zustand';
import { authApi, type AuthUserDto } from '@/features/chat/api/auth.api';
import { hasTelegramRuntime } from '@/shared/lib/telegram';

type AuthState = {
  user: AuthUserDto | null;
  token: string | null;
  isReady: boolean;
  isLoading: boolean;
  error: string | null;

  bootstrap: (initData?: string) => Promise<void>;
  logout: () => void;
};

const TOKEN_KEY = 'auth-token';
const AUTH_MODE_KEY = 'auth-mode';

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: localStorage.getItem(TOKEN_KEY),
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
       * НЕ используем старый dev-token, иначе разные люди увидят одну базу.
       */
      if (telegramRuntime && !hasTelegramInitData) {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(AUTH_MODE_KEY);

        throw new Error(
          'Telegram initData не получен. Открой приложение через кнопку бота или обнови Mini App.',
        );
      }

      /**
       * В Telegram всегда перелогиниваемся через initData.
       */
      if (hasTelegramInitData) {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(AUTH_MODE_KEY);

        const response = await authApi.login(initData);

        localStorage.setItem(TOKEN_KEY, response.token);
        localStorage.setItem(AUTH_MODE_KEY, response.mode);

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
      const existingToken = localStorage.getItem(TOKEN_KEY);

      if (existingToken) {
        try {
          const me = await authApi.me();

          set({
            user: me.user,
            token: existingToken,
            isReady: true,
            isLoading: false,
          });

          return;
        } catch {
          localStorage.removeItem(TOKEN_KEY);
          localStorage.removeItem(AUTH_MODE_KEY);
        }
      }

      const response = await authApi.login();

      localStorage.setItem(TOKEN_KEY, response.token);
      localStorage.setItem(AUTH_MODE_KEY, response.mode);

      set({
        user: response.user,
        token: response.token,
        isReady: true,
        isLoading: false,
      });
    } catch (error) {
      console.error('Auth bootstrap failed', error);

      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(AUTH_MODE_KEY);

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

  logout: () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(AUTH_MODE_KEY);

    set({
      user: null,
      token: null,
      isReady: true,
      isLoading: false,
      error: null,
    });
  },
}));