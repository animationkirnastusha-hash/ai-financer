import { useEffect, useRef } from 'react';
import { useNavigationStore } from '@/features/navigation/model/navigation.store';
import { useAuthStore } from '@/features/auth/model/auth.store';
import { productAnalyticsApi } from '@/features/product-analytics/api/productAnalytics.api';
import { getTelegramWebApp } from '@/shared/lib/telegram';

type TelegramTrackingData = {
  initDataUnsafe?: {
    start_param?: string;
    user?: {
      language_code?: string;
    };
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
  void productAnalyticsApi.track(event, data).catch(() => undefined);
}

export function ProductAnalyticsTracker() {
  const currentScreen = useNavigationStore((state) => state.currentScreen);
  const user = useAuthStore((state) => state.user);
  const startedRef = useRef(false);
  const lastScreenRef = useRef<string | null>(null);
  const screenStartedAtRef = useRef(Date.now());

  useEffect(() => {
    if (!user || startedRef.current) return;
    startedRef.current = true;

    const telegram = getTelegramTrackingData();

    fireAndForget('session_start', {
      source: getSource(),
      path: window.location.pathname,
      query: window.location.search,
      platform: telegram?.platform ?? 'web',
      telegramVersion: telegram?.version,
      language: telegram?.initDataUnsafe?.user?.language_code ?? null,
    });
  }, [user]);

  useEffect(() => {
    if (!user) return;

    const now = Date.now();
    const previousScreen = lastScreenRef.current;

    if (previousScreen && previousScreen !== currentScreen) {
      fireAndForget('screen_leave', {
        screen: previousScreen,
        nextScreen: currentScreen,
        durationMs: Math.max(0, now - screenStartedAtRef.current),
      });
    }

    if (lastScreenRef.current === currentScreen) return;
    lastScreenRef.current = currentScreen;
    screenStartedAtRef.current = now;

    fireAndForget('screen_view', {
      screen: currentScreen,
      source: getSource(),
    });
  }, [currentScreen, user]);

  useEffect(() => {
    if (!user) return;

    const handleVisibility = () => {
      if (document.visibilityState !== 'hidden') return;
      const screen = lastScreenRef.current;
      if (!screen) return;
      fireAndForget('session_pause', {
        screen,
        durationMs: Math.max(0, Date.now() - screenStartedAtRef.current),
      });
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [user]);

  return null;
}
