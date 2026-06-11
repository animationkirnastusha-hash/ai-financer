import { extraRuntimeTextDictionary } from '@/shared/lib/i18n.extra';
import { authNavigationRuntimeDictionary } from './runtime-dictionary/auth-navigation';
import { accountsTransactionsRuntimeDictionary } from './runtime-dictionary/accounts-transactions';
import { voiceTaxonomyRuntimeDictionary } from './runtime-dictionary/voice-taxonomy';
import { goalsObligationsRuntimeDictionary } from './runtime-dictionary/goals-obligations';
import { settingsPremiumOnboardingRuntimeDictionary } from './runtime-dictionary/settings-premium-onboarding';
import { statusRuntimeDictionary } from './runtime-dictionary/status';

export const runtimeTextDictionary: Record<string, string> = {
  ...authNavigationRuntimeDictionary,
  ...accountsTransactionsRuntimeDictionary,
  ...voiceTaxonomyRuntimeDictionary,
  ...goalsObligationsRuntimeDictionary,
  ...settingsPremiumOnboardingRuntimeDictionary,
  ...statusRuntimeDictionary,
};

export const combinedRuntimeTextDictionary: Record<string, string> = {
  ...runtimeTextDictionary,
  ...extraRuntimeTextDictionary,
};
