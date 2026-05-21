import { useEffect, useRef } from 'react';
import { useNavigationStore } from '@/features/navigation/model/navigation.store';
import { useAuthStore } from '@/features/auth/model/auth.store';
import { productAnalyticsApi } from '@/features/product-analytics/api/productAnalytics.api';
import { getTelegramWebApp } from '@/shared/lib/telegram';

type TelegramTrackingData = {
  initDataUnsafe?: {
    start_param?: string;
  };
  platform?: string;
  version?: string;
};

function getTelegramTrackingData() {
  return getTelegramWebApp() as unknown as TelegramTrackingData | null;
}

function getSource() {
  const params = new URLSearchParams(window.location.search);
  const utmSource = params.get('utm_source');
  const startParam = getTelegramTrackingData()?.initDataUnsafe?.start_param;

  if (utmSource) return utmSource;
  if (startParam) return `telegram:${startParam}`;
  if (document.referrer) {
    try {
      return new URL(document.referrer).hostname;
    } catch {
      return document.referrer;
    }
  }

  return 'direct';
}

function fireAndForget(event: string, data?: Record<string, unknown>) {
  void productAnalyticsApi.track(event, data).catch((error) => {
    if (import.meta.env.DEV) console.warn('[analytics] event was not sent', event, error);
  });
}

export function ProductAnalyticsTracker() {
  const currentScreen = useNavigationStore((state) => state.currentScreen);
  const user = useAuthStore((state) => state.user);
  const isReady = useAuthStore((state) => state.isReady);
  const startedRef = useRef(false);
  const lastScreenRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isReady || !user || startedRef.current) return;
    startedRef.current = true;

    const telegram = getTelegramTrackingData();

    fireAndForget('session_start', {
      source: getSource(),
      path: window.location.pathname,
      query: window.location.search,
      platform: telegram?.platform ?? 'web',
      telegramVersion: telegram?.version ?? null,
      language: navigator.language,
    });
  }, [isReady, user]);

  useEffect(() => {
    if (!isReady || !user) return;
    if (lastScreenRef.current === currentScreen) return;
    lastScreenRef.current = currentScreen;

    fireAndForget('screen_view', {
      screen: currentScreen,
      source: getSource(),
    });
  }, [currentScreen, isReady, user]);

  return null;
}
