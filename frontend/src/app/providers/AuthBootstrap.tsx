import { useEffect, type PropsWithChildren } from 'react';

import { useAuthStore } from '@/features/auth/model/auth.store';
import { getTelegramInitData, getTelegramUserPreview } from '@/shared/lib/telegram';

export function AuthBootstrap({ children }: PropsWithChildren) {
  const isReady = useAuthStore((state) => state.isReady);
  const isLoading = useAuthStore((state) => state.isLoading);
  const error = useAuthStore((state) => state.error);
  const bootstrap = useAuthStore((state) => state.bootstrap);
console.log('[TG] window.Telegram:', window.Telegram);
console.log('[TG] initData:', window.Telegram?.WebApp?.initData);
console.log('[TG] initDataUnsafe:', window.Telegram?.WebApp?.initDataUnsafe);
  useEffect(() => {
    const initData = getTelegramInitData();

    void bootstrap(initData);
  }, [bootstrap]);

  if (!isReady || isLoading) {
    const previewUser = getTelegramUserPreview();

    return (
      <div className="flex h-dvh items-center justify-center bg-[#070b10] px-6 text-center text-sm text-white/60">
        <div>
          <div>Авторизация через Telegram...</div>

          {previewUser ? (
            <div className="mt-2 text-xs text-white/35">
              {previewUser.username
                ? `@${previewUser.username}`
                : previewUser.first_name}
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-dvh items-center justify-center bg-[#070b10] px-6 text-center text-white">
        <div className="max-w-[360px] rounded-[28px] border border-red-400/15 bg-red-400/10 p-5">
          <div className="text-lg font-semibold">Не удалось войти</div>

          <div className="mt-2 text-sm leading-6 text-white/60">{error}</div>

          <div className="mt-4 text-xs leading-5 text-white/35">
            Открой приложение именно через Telegram Mini App. Для production
            нужен HTTPS URL и TELEGRAM_BOT_TOKEN на backend.
          </div>
        </div>
      </div>
    );
  }

  return children;
}