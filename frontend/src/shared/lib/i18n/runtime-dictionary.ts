import { extraRuntimeTextDictionary } from '@/shared/lib/i18n.extra';
import { authNavigationRuntimeDictionary } from './runtime-dictionary/auth-navigation';
import { accountsTransactionsRuntimeDictionary } from './runtime-dictionary/accounts-transactions';
import { goalsObligationsRuntimeDictionary } from './runtime-dictionary/goals-obligations';
import { statusRuntimeDictionary } from './runtime-dictionary/status';

export const runtimeTextDictionary: Record<string, string> = {
  ...authNavigationRuntimeDictionary,
  ...accountsTransactionsRuntimeDictionary,
  ...goalsObligationsRuntimeDictionary,
  ...statusRuntimeDictionary,
};

export const combinedRuntimeTextDictionary: Record<string, string> = {
  ...runtimeTextDictionary,
  ...extraRuntimeTextDictionary,
};
