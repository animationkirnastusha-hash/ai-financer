import { commonDictionary } from './common';
import { navigationDictionary } from './navigation';
import { textChatDictionary } from './text-chat';
import { onboardingDictionary } from './onboarding';
import { settingsDictionary } from './settings';
import { accountsDictionary } from './accounts';
import { transactionsDictionary } from './transactions';
import { journalDictionary } from './journal';
import { dashboardDictionary } from './dashboard';
import { receiptsDictionary } from './receipts';
import { storeDictionary } from './store';
import { premiumDictionary } from './premium';
import { businessDictionary } from './business';
import { referralDictionary } from './referral';
import { profileDictionary } from './profile';
import { limitsDictionary } from './limits';
import { miscDictionary } from './misc';

export const ruDictionary = {
  ...commonDictionary,
  ...navigationDictionary,
  ...textChatDictionary,
  ...onboardingDictionary,
  ...settingsDictionary,
  ...accountsDictionary,
  ...transactionsDictionary,
  ...journalDictionary,
  ...dashboardDictionary,
  ...receiptsDictionary,
  ...storeDictionary,
  ...premiumDictionary,
  ...businessDictionary,
  ...referralDictionary,
  ...profileDictionary,
  ...limitsDictionary,
  ...miscDictionary,
} as const;
