export type SubscriptionPlan = 'free' | 'pro' | 'premium';

export type AppCurrency = 'RUB' | 'USD' | 'EUR' | 'KZT' | 'UZS' | 'KGS' | 'AMD' | 'GEL' | 'AZN';

export type AppLanguage = 'ru' | 'en';
export type AppLanguageSource = 'telegram' | 'user';

export type AppSettings = {
  appLanguage: AppLanguage;
  appLanguageSource: AppLanguageSource;

  companionName: string;

  voiceEnabled: boolean;
  voiceBetaEnabled: boolean;
  voiceRepliesEnabled: boolean;
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
