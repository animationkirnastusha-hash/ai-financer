import { create } from 'zustand';
import type {
  AppCurrency,
  AppSettings,
  SubscriptionPlan,
} from '@/features/settings/model/settings.types';

type SettingsState = AppSettings & {
  setVoiceEnabled: (value: boolean) => void;
  setVoiceBetaEnabled: (value: boolean) => void;
  setVoiceRepliesEnabled: (value: boolean) => void;
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

const defaultSettings: AppSettings = {
  voiceEnabled: true,
  voiceBetaEnabled: true,
  voiceRepliesEnabled: false,
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
    };
  } catch {
    return defaultSettings;
  }
}

function saveSettings(state: AppSettings) {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      voiceEnabled: state.voiceEnabled,
      voiceBetaEnabled: state.voiceBetaEnabled,
      voiceRepliesEnabled: state.voiceRepliesEnabled,
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