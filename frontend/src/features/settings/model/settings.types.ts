export type SubscriptionPlan = 'free' | 'pro' | 'premium';

export type AppCurrency = 'RUB' | 'USD' | 'EUR';

export type AppLanguage = 'ru' | 'en';

export type AppSettings = {
  appLanguage: AppLanguage;

  voiceEnabled: boolean;
  voiceBetaEnabled: boolean;
  voiceRepliesEnabled: boolean;
  aiInsightsEnabled: boolean;
  subscriptionPlan: SubscriptionPlan;

  mainCurrency: AppCurrency;
  primaryAccountId: string | null;
  incomeAccountId: string | null;

  secondaryCurrencyEnabled: boolean;
  secondaryCurrency: Exclude<AppCurrency, 'RUB'>;
  rubToUsdRate: number;
  rubToEurRate: number;
};
