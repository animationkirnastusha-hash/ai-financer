import { commonDictionary } from './common';
import { navigationDictionary } from './navigation';
import { textChatDictionary } from './text-chat';
import { onboardingDictionary } from './onboarding';
import { settingsDictionary } from './settings';
import { accountsDictionary } from './accounts';
import { transactionsDictionary } from './transactions';
import { dashboardDictionary } from './dashboard';
import { receiptsDictionary } from './receipts';
import { storeDictionary } from './store';
import { premiumDictionary } from './premium';
import { businessDictionary } from './business';
import { referralDictionary } from './referral';
import { limitsDictionary } from './limits';
import { miscDictionary } from './misc';

export const enDictionary = {
  ...commonDictionary,
  ...navigationDictionary,
  ...textChatDictionary,
  ...onboardingDictionary,
  ...settingsDictionary,
  ...accountsDictionary,
  ...transactionsDictionary,
  ...dashboardDictionary,
  ...receiptsDictionary,
  ...storeDictionary,
  ...premiumDictionary,
  ...businessDictionary,
  ...referralDictionary,
  ...limitsDictionary,
  ...miscDictionary,
} as const;
