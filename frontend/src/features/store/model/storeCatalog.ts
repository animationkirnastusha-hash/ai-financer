import type { I18nKey } from '@/shared/lib/i18n';

export type StoreCardTone = 'premium' | 'business' | 'referral';

export type StoreCard = {
  eyebrow: I18nKey;
  title: I18nKey;
  caption: I18nKey;
  items: I18nKey[];
  action: I18nKey;
  tone: StoreCardTone;
};

export type StoreFeature = {
  title: I18nKey;
  caption: I18nKey;
};

export const storeCards: StoreCard[] = [
  {
    eyebrow: 'store.premium.eyebrow',
    title: 'store.premium.title',
    caption: 'store.premium.caption',
    items: [
      'store.premium.item.analytics',
      'store.premium.item.reports',
      'store.premium.item.receipts',
      'store.premium.item.voice',
    ],
    action: 'store.action.premium',
    tone: 'premium',
  },
  {
    eyebrow: 'store.business.eyebrow',
    title: 'store.business.title',
    caption: 'store.business.caption',
    items: [
      'store.business.item.workspace',
      'store.business.item.reports',
      'store.business.item.premiumGift',
    ],
    action: 'store.action.business',
    tone: 'business',
  },
  {
    eyebrow: 'store.referral.eyebrow',
    title: 'store.referral.title',
    caption: 'store.referral.caption',
    items: [
      'store.referral.item.invite',
      'store.referral.item.purchase',
      'store.referral.item.balance',
    ],
    action: 'store.action.referral',
    tone: 'referral',
  },
];

export const storeFeatures: StoreFeature[] = [
  { title: 'store.features.forecast.title', caption: 'store.features.forecast.caption' },
  { title: 'store.features.reports.title', caption: 'store.features.reports.caption' },
  { title: 'store.features.receipts.title', caption: 'store.features.receipts.caption' },
  { title: 'store.features.voice.title', caption: 'store.features.voice.caption' },
];
