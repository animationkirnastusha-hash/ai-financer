import { create } from 'zustand';
import type {
  AppCurrency,
  AppLanguage,
  AppLanguageSource,
  AppSettings,
  SubscriptionPlan,
} from '@/features/settings/model/settings.types';

type SettingsState = AppSettings & {
  setAppLanguage: (language: AppLanguage) => void;
  applyTelegramLanguage: (languageCode?: string | null) => void;
  applyRemoteLanguage: (languageCode?: string | null) => void;

  setCompanionName: (name: string) => void;

  setVoiceEnabled: (value: boolean) => void;
  setVoiceBetaEnabled: (value: boolean) => void;
  setVoiceRepliesEnabled: (value: boolean) => void;
  setVoicePermissionPrompted: (value: boolean) => void;
  setFinaOverlayDensity: (value: number) => void;
  resetFinaOverlayDensity: () => void;
  setTextInputEnabled: (value: boolean) => void;
  setAIInsightsEnabled: (value: boolean) => void;
  setSubscriptionPlan: (plan: SubscriptionPlan) => void;

  setMainCurrency: (currency: AppCurrency) => void;
  setPrimaryAccountId: (accountId: string | null) => void;
  setIncomeAccountId: (accountId: string | null) => void;

  setSecondaryCurrencyEnabled: (value: boolean) => void;
  setSecondaryCurrency: (currency: AppCurrency) => void;
  setRubToUsdRate: (rate: number) => void;
  setRubToEurRate: (rate: number) => void;
};

const STORAGE_KEY = 'ai-financer-settings';
const FIXED_COMPANION_NAME = 'Fina';

function normalizeLanguage(value: unknown): AppLanguage {
  return value === 'en' ? 'en' : 'ru';
}

function normalizeTelegramLanguage(_languageCode?: string | null): AppLanguage {
  return 'ru';
}

function normalizeLanguageSource(value: unknown): AppLanguageSource {
  return value === 'user' ? 'user' : 'telegram';
}

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) return fallback;
  return Math.min(max, Math.max(min, Math.round(numberValue)));
}

function detectDefaultFinaOverlayDensity(): number {
  if (typeof navigator === 'undefined') return 72;
  const userAgent = navigator.userAgent.toLowerCase();
  if (userAgent.includes('android')) return 76;
  if (userAgent.includes('iphone') || userAgent.includes('ipad') || userAgent.includes('ipod')) return 62;
  return 68;
}

const defaultSettings: AppSettings = {
  appLanguage: 'ru',
  appLanguageSource: 'telegram',

  companionName: FIXED_COMPANION_NAME,

  voiceEnabled: true,
  voiceBetaEnabled: true,
  voiceRepliesEnabled: true,
  voicePermissionPrompted: false,
  finaOverlayDensity: detectDefaultFinaOverlayDensity(),
  textInputEnabled: true,
  aiInsightsEnabled: true,
  subscriptionPlan: 'free',

  mainCurrency: 'RUB',
  primaryAccountId: null,
  incomeAccountId: null,

  secondaryCurrencyEnabled: false,
  secondaryCurrency: 'USD',
  rubToUsdRate: 90,
  rubToEurRate: 100,
};

function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultSettings;

    const parsed = JSON.parse(raw) as Partial<AppSettings>;

    const appLanguageSource = normalizeLanguageSource(parsed.appLanguageSource);

    return {
      ...defaultSettings,
      ...parsed,
      appLanguage: appLanguageSource === 'user' ? normalizeLanguage(parsed.appLanguage) : 'ru',
      appLanguageSource,
      companionName: FIXED_COMPANION_NAME,
      voiceRepliesEnabled: parsed.voiceRepliesEnabled === false ? false : true,
      voicePermissionPrompted: Boolean(parsed.voicePermissionPrompted),
      finaOverlayDensity: clampNumber(parsed.finaOverlayDensity, 40, 90, defaultSettings.finaOverlayDensity),
      textInputEnabled: parsed.textInputEnabled === false ? false : true,
    };
  } catch {
    return defaultSettings;
  }
}

function saveSettings(state: AppSettings) {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      appLanguage: state.appLanguage,
      appLanguageSource: state.appLanguageSource,
      companionName: FIXED_COMPANION_NAME,
      voiceEnabled: state.voiceEnabled,
      voiceBetaEnabled: state.voiceBetaEnabled,
      voiceRepliesEnabled: state.voiceRepliesEnabled,
      voicePermissionPrompted: state.voicePermissionPrompted,
      finaOverlayDensity: clampNumber(state.finaOverlayDensity, 40, 90, defaultSettings.finaOverlayDensity),
      textInputEnabled: state.textInputEnabled,
      aiInsightsEnabled: state.aiInsightsEnabled,
      subscriptionPlan: state.subscriptionPlan,
      mainCurrency: state.mainCurrency,
      primaryAccountId: state.primaryAccountId,
      incomeAccountId: state.incomeAccountId,
      secondaryCurrencyEnabled: state.secondaryCurrencyEnabled,
      secondaryCurrency: state.secondaryCurrency,
      rubToUsdRate: state.rubToUsdRate,
      rubToEurRate: state.rubToEurRate,
    }),
  );
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  ...loadSettings(),
  companionName: FIXED_COMPANION_NAME,

  setAppLanguage: (appLanguage) => {
    set({ appLanguage, appLanguageSource: 'user', companionName: FIXED_COMPANION_NAME });
    saveSettings(get());
  },

  applyTelegramLanguage: (languageCode) => {
    const state = get();
    if (state.appLanguageSource === 'user') return;

    const appLanguage = normalizeTelegramLanguage(languageCode);
    if (state.appLanguage === appLanguage && state.appLanguageSource === 'telegram') return;

    set({ appLanguage, appLanguageSource: 'telegram', companionName: FIXED_COMPANION_NAME });
    saveSettings(get());
  },

  applyRemoteLanguage: (languageCode) => {
    const state = get();
    if (state.appLanguageSource === 'user') return;

    const appLanguage = normalizeTelegramLanguage(languageCode);
    if (state.appLanguage === appLanguage && state.appLanguageSource === 'telegram') return;

    set({ appLanguage, appLanguageSource: 'telegram', companionName: FIXED_COMPANION_NAME });
    saveSettings(get());
  },

  setCompanionName: () => {
    set({ companionName: FIXED_COMPANION_NAME });
    saveSettings(get());
  },

  setVoiceEnabled: (value) => {
    set({ voiceEnabled: value });
    saveSettings(get());
  },

  setVoiceBetaEnabled: (value) => {
    set({ voiceBetaEnabled: value });
    saveSettings(get());
  },

  setVoiceRepliesEnabled: (value) => {
    set({ voiceRepliesEnabled: value });
    saveSettings(get());
  },

  setVoicePermissionPrompted: (value) => {
    set({ voicePermissionPrompted: value });
    saveSettings(get());
  },

  setFinaOverlayDensity: (value) => {
    set({ finaOverlayDensity: clampNumber(value, 40, 90, defaultSettings.finaOverlayDensity) });
    saveSettings(get());
  },

  resetFinaOverlayDensity: () => {
    set({ finaOverlayDensity: detectDefaultFinaOverlayDensity() });
    saveSettings(get());
  },

  setTextInputEnabled: (value) => {
    set({ textInputEnabled: value });
    saveSettings(get());
  },

  setAIInsightsEnabled: (value) => {
    set({ aiInsightsEnabled: value });
    saveSettings(get());
  },

  setSubscriptionPlan: (plan) => {
    set({ subscriptionPlan: plan });
    saveSettings(get());
  },

  setMainCurrency: (currency) => {
    set({ mainCurrency: currency });
    saveSettings(get());
  },

  setPrimaryAccountId: (accountId) => {
    set({ primaryAccountId: accountId });
    saveSettings(get());
  },

  setIncomeAccountId: (accountId) => {
    set({ incomeAccountId: accountId });
    saveSettings(get());
  },

  setSecondaryCurrencyEnabled: (value) => {
    set({ secondaryCurrencyEnabled: value });
    saveSettings(get());
  },

  setSecondaryCurrency: (currency) => {
    set({ secondaryCurrency: currency });
    saveSettings(get());
  },

  setRubToUsdRate: (rate) => {
    set({ rubToUsdRate: rate });
    saveSettings(get());
  },

  setRubToEurRate: (rate) => {
    set({ rubToEurRate: rate });
    saveSettings(get());
  },
}));
