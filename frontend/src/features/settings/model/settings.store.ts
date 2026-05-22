import { create } from 'zustand';
import type {
  AppCurrency,
  AppLanguage,
  AppSettings,
  SubscriptionPlan,
} from '@/features/settings/model/settings.types';

type SettingsState = AppSettings & {
  setAppLanguage: (language: AppLanguage) => void;

  setCompanionName: (name: string) => void;
  setVoiceWakeWordEnabled: (value: boolean) => void;
  setVoiceActiveWindowSeconds: (seconds: number) => void;

  setVoiceEnabled: (value: boolean) => void;
  setVoiceBetaEnabled: (value: boolean) => void;
  setVoiceRepliesEnabled: (value: boolean) => void;
  setVoiceAlwaysOnEnabled: (value: boolean) => void;
  setVoicePermissionPrompted: (value: boolean) => void;
  setTextInputEnabled: (value: boolean) => void;
  setAIInsightsEnabled: (value: boolean) => void;
  setSubscriptionPlan: (plan: SubscriptionPlan) => void;

  setMainCurrency: (currency: AppCurrency) => void;
  setPrimaryAccountId: (accountId: string | null) => void;
  setIncomeAccountId: (accountId: string | null) => void;

  setSecondaryCurrencyEnabled: (value: boolean) => void;
  setSecondaryCurrency: (currency: Exclude<AppCurrency, 'RUB'>) => void;
  setRubToUsdRate: (rate: number) => void;
  setRubToEurRate: (rate: number) => void;
};

const STORAGE_KEY = 'ai-financer-settings';
const DEFAULT_COMPANION_NAME = 'Фина';

const defaultSettings: AppSettings = {
  appLanguage: 'ru',

  companionName: DEFAULT_COMPANION_NAME,
  voiceWakeWordEnabled: true,
  voiceActiveWindowSeconds: 16,

  voiceEnabled: true,
  voiceBetaEnabled: true,
  voiceRepliesEnabled: false,
  voiceAlwaysOnEnabled: false,
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

function normalizeCompanionName(value: unknown) {
  if (typeof value !== 'string') return DEFAULT_COMPANION_NAME;
  const next = value.replace(/\s+/g, ' ').trim().slice(0, 24);
  return next || DEFAULT_COMPANION_NAME;
}

function normalizeActiveWindow(value: unknown) {
  if (typeof value !== 'number' || Number.isNaN(value)) return defaultSettings.voiceActiveWindowSeconds;
  return Math.min(45, Math.max(6, Math.round(value)));
}

function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultSettings;

    const parsed = JSON.parse(raw) as Partial<AppSettings>;

    return {
      ...defaultSettings,
      ...parsed,
      appLanguage: parsed.appLanguage === 'en' ? 'en' : 'ru',
      companionName: normalizeCompanionName(parsed.companionName),
      voiceWakeWordEnabled: parsed.voiceWakeWordEnabled === false ? false : true,
      voiceActiveWindowSeconds: normalizeActiveWindow(parsed.voiceActiveWindowSeconds),
      voiceAlwaysOnEnabled: Boolean(parsed.voiceAlwaysOnEnabled),
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
      companionName: normalizeCompanionName(state.companionName),
      voiceWakeWordEnabled: state.voiceWakeWordEnabled,
      voiceActiveWindowSeconds: normalizeActiveWindow(state.voiceActiveWindowSeconds),
      voiceEnabled: state.voiceEnabled,
      voiceBetaEnabled: state.voiceBetaEnabled,
      voiceRepliesEnabled: state.voiceRepliesEnabled,
      voiceAlwaysOnEnabled: state.voiceAlwaysOnEnabled,
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

  setAppLanguage: (appLanguage) => {
    set({ appLanguage });
    saveSettings(get());
  },

  setCompanionName: (companionName) => {
    set({ companionName: normalizeCompanionName(companionName) });
    saveSettings(get());
  },

  setVoiceWakeWordEnabled: (voiceWakeWordEnabled) => {
    set({ voiceWakeWordEnabled });
    saveSettings(get());
  },

  setVoiceActiveWindowSeconds: (voiceActiveWindowSeconds) => {
    set({ voiceActiveWindowSeconds: normalizeActiveWindow(voiceActiveWindowSeconds) });
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

  setVoiceAlwaysOnEnabled: (value) => {
    set({ voiceAlwaysOnEnabled: value });
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
