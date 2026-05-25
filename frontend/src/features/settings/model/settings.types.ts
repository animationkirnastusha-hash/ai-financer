export type SubscriptionPlan = 'free' | 'pro' | 'premium';

export type AppCurrency = 'RUB' | 'USD' | 'EUR' | 'KZT' | 'UZS' | 'KGS' | 'AMD' | 'GEL' | 'AZN';

export type AppLanguage = 'ru' | 'en';

export type AppSettings = {
  appLanguage: AppLanguage;

  companionName: string;
  voiceWakeWordEnabled: boolean;
  voiceActiveWindowSeconds: number;

  voiceEnabled: boolean;
  voiceBetaEnabled: boolean;
  voiceRepliesEnabled: boolean;
  voiceAlwaysOnEnabled: boolean;
  voicePermissionPrompted: boolean;
  textInputEnabled: boolean;
  aiInsightsEnabled: boolean;
  subscriptionPlan: SubscriptionPlan;

  mainCurrency: AppCurrency;
  primaryAccountId: string | null;
  incomeAccountId: string | null;

  secondaryCurrencyEnabled: boolean;
  secondaryCurrency: AppCurrency;
  rubToUsdRate: number;
  rubToEurRate: number;
};
