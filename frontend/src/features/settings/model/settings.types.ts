export type SubscriptionPlan = 'free' | 'pro' | 'premium';

export type AppCurrency = 'RUB' | 'USD' | 'EUR';

export type AppSettings = {
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