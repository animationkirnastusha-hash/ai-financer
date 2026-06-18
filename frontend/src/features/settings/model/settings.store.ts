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
  return value === 'ru' ? 'ru' : 'en';
}

function normalizeTelegramLanguage(languageCode?: string | null): AppLanguage {
  const value = String(languageCode ?? '').trim().toLowerCase();
  return value === 'ru' || value.startsWith('ru-') || value.startsWith('ru_') ? 'ru' : 'en';
}

function normalizeLanguageSource(value: unknown): AppLanguageSource {
  return value === 'user' ? 'user' : 'telegram';
}

const defaultSettings: AppSettings = {
  appLanguage: 'en',
  appLanguageSource: 'telegram',

  companionName: FIXED_COMPANION_NAME,

  voiceEnabled: true,
  voiceBetaEnabled: true,
  voiceRepliesEnabled: true,
  voicePermissionPrompted: false,
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

    return {
      ...defaultSettings,
      ...parsed,
      appLanguage: normalizeLanguage(parsed.appLanguage),
      appLanguageSource: normalizeLanguageSource(parsed.appLanguageSource),
      companionName: FIXED_COMPANION_NAME,
      voiceRepliesEnabled: parsed.voiceRepliesEnabled === false ? false : true,
      voicePermissionPrompted: Boolean(parsed.voicePermissionPrompted),
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
