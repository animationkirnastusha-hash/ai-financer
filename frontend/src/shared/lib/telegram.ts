type TelegramWebApp = {
  initData?: string;
  initDataUnsafe?: {
    user?: {
      id: number;
      first_name?: string;
      last_name?: string;
      username?: string;
      photo_url?: string;
      language_code?: string;
    };
  };
  ready?: () => void;
  expand?: () => void;
  enableClosingConfirmation?: () => void;
  disableVerticalSwipes?: () => void;
  openInvoice?: (url: string, callback?: (status: 'paid' | 'cancelled' | 'failed' | 'pending' | string) => void) => void;
  setHeaderColor?: (color: string) => void;
  setBackgroundColor?: (color: string) => void;
  HapticFeedback?: {
    impactOccurred?: (style: 'light' | 'medium' | 'heavy') => void;
    selectionChanged?: () => void;
  };
};

declare global {
  interface Window {
    Telegram?: {
      WebApp?: TelegramWebApp;
    };
  }
}

export function getTelegramWebApp() {
  return window.Telegram?.WebApp ?? null;
}

export function getTelegramInitData() {
  return window.Telegram?.WebApp?.initData ?? '';
}

export function hasTelegramRuntime() {
  return Boolean(window.Telegram?.WebApp);
}

export function initTelegramMiniApp() {
  const webApp = getTelegramWebApp();

  if (!webApp) return;

  webApp.ready?.();
  webApp.expand?.();
  webApp.enableClosingConfirmation?.();
  webApp.disableVerticalSwipes?.();
  webApp.setHeaderColor?.('#0b1016');
  webApp.setBackgroundColor?.('#090d13');
}

export function telegramHaptic(type: 'light' | 'medium' | 'heavy' = 'light') {
  getTelegramWebApp()?.HapticFeedback?.impactOccurred?.(type);
}

export function getTelegramUserPreview() {
  return getTelegramWebApp()?.initDataUnsafe?.user ?? null;
}
export function openTelegramInvoice(url: string, callback?: (status: string) => void) {
  const webApp = getTelegramWebApp();
  if (webApp?.openInvoice) {
    webApp.openInvoice(url, callback);
    return true;
  }
  return false;
}

export function getTelegramClientLanguageCode() {
  return getTelegramWebApp()?.initDataUnsafe?.user?.language_code ?? '';
}
