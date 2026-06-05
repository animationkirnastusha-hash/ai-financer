import { useEffect, useMemo, useState, type FormEvent, type PropsWithChildren } from 'react';

import { authApi, type FallbackInfoResponse } from '@/features/chat/api/auth.api';
import { useAuthStore } from '@/features/auth/model/auth.store';
import { env } from '@/shared/config/env';
import { getTelegramInitData, getTelegramUserPreview, initTelegramMiniApp } from '@/shared/lib/telegram';
import { useI18n } from '@/shared/lib/i18n';

async function waitForTelegramInitData(timeoutMs = 1200) {
  initTelegramMiniApp();

  const startedAt = Date.now();
  let initData = getTelegramInitData();

  while (!initData && Date.now() - startedAt < timeoutMs) {
    await new Promise((resolve) => window.setTimeout(resolve, 80));
    initTelegramMiniApp();
    initData = getTelegramInitData();
  }

  return initData;
}

function AuthLoadingState() {
  const previewUser = getTelegramUserPreview();
  const { t } = useI18n();

  return (
    <div className="flex h-dvh items-center justify-center bg-[#070b10] px-6 text-center text-sm text-white/60">
      <div>
        <div>{t('auth.loading')}</div>

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

function FallbackLoginState({ error }: { error: string }) {
  const isLoading = useAuthStore((state) => state.isLoading);
  const loginWithFallbackCode = useAuthStore((state) => state.loginWithFallbackCode);
  const [code, setCode] = useState('');
  const [fallbackInfo, setFallbackInfo] = useState<FallbackInfoResponse | null>(null);
  const [localError, setLocalError] = useState('');
  const { t } = useI18n();

  useEffect(() => {
    let isMounted = true;

    authApi
      .fallbackInfo()
      .then((response) => {
        if (isMounted) setFallbackInfo(response);
      })
      .catch(() => {
        if (isMounted) setFallbackInfo(null);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const botUrl = useMemo(() => {
    return env.telegramBotUrl || fallbackInfo?.botUrl || '';
  }, [fallbackInfo?.botUrl]);

  const normalizedCode = code.replace(/\D/g, '').slice(0, 6);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setLocalError('');

    if (normalizedCode.length !== 6) {
      setLocalError(t('auth.code.error'));
      return;
    }

    await loginWithFallbackCode(normalizedCode);
  };

  return (
    <div className="flex min-h-dvh items-center justify-center bg-[#070b10] px-5 py-8 text-white">
      <div className="w-full max-w-[390px] rounded-[32px] border border-white/10 bg-white/[0.06] p-5 shadow-2xl shadow-black/30 backdrop-blur-xl">
        <div className="text-lg font-semibold">{t('auth.fallback.title')}</div>

        <div className="mt-2 text-sm leading-6 text-white/62">
          {error || t('auth.fallback.error')}
        </div>

        <div className="mt-4 rounded-[24px] border border-white/10 bg-black/20 p-4 text-sm leading-6 text-white/70">
          {t('auth.fallback.caption')}
        </div>

        <div className="mt-4 grid gap-2 text-sm text-white/70">
          <div>{t('auth.fallback.step1.prefix')} <span className="font-semibold text-white">/login</span>.</div>
          <div>{t('auth.fallback.step2')}</div>
          <div>{t('auth.fallback.step3')}</div>
        </div>

        {botUrl ? (
          <a
            className="mt-5 flex h-12 items-center justify-center rounded-2xl bg-white text-sm font-semibold text-[#101820]"
            href={botUrl}
            target="_blank"
            rel="noreferrer"
          >
            {t('auth.openBot')}
          </a>
        ) : (
          <div className="mt-5 rounded-2xl border border-amber-300/20 bg-amber-300/10 p-3 text-xs leading-5 text-amber-100/80">
            {t('auth.botNotConfigured')}
          </div>
        )}

        <form onSubmit={submit} className="mt-4 grid gap-3">
          <input
            inputMode="numeric"
            autoComplete="one-time-code"
            value={normalizedCode}
            onChange={(event) => setCode(event.target.value)}
            placeholder={t('auth.code.placeholder')}
            className="h-12 rounded-2xl border border-white/10 bg-black/25 px-4 text-center text-xl font-semibold tracking-[0.32em] text-white outline-none placeholder:text-sm placeholder:font-normal placeholder:tracking-normal placeholder:text-white/28 focus:border-white/28"
          />

          <button
            type="submit"
            disabled={isLoading}
            className="h-12 rounded-2xl bg-[#8df7cf] text-sm font-semibold text-[#092016] disabled:cursor-not-allowed disabled:opacity-55"
          >
            {isLoading ? t('common.checking') : t('auth.signIn')}
          </button>
        </form>

        {localError ? <div className="mt-3 text-center text-xs text-red-200">{localError}</div> : null}

        <div className="mt-4 text-center text-[11px] leading-5 text-white/35">
          {t('auth.fallback.footnote')}
        </div>
      </div>
    </div>
  );
}

export function AuthBootstrap({ children }: PropsWithChildren) {
  const isReady = useAuthStore((state) => state.isReady);
  const isLoading = useAuthStore((state) => state.isLoading);
  const error = useAuthStore((state) => state.error);
  const bootstrap = useAuthStore((state) => state.bootstrap);

  useEffect(() => {
    let cancelled = false;

    void waitForTelegramInitData().then((initData) => {
      if (!cancelled) void bootstrap(initData);
    });

    return () => {
      cancelled = true;
    };
  }, [bootstrap]);

  if (!isReady || isLoading) {
    return <AuthLoadingState />;
  }

  if (error) {
    return <FallbackLoginState error={error} />;
  }

  return children;
}
