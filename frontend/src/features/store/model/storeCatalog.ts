import type { StorePaymentProduct } from '@/features/payments/api/payments.api';
import type { I18nKey } from '@/shared/lib/i18n';

export type StoreCardTone = 'premium' | 'business' | 'bundle' | 'referral';

export type StoreCard = {
  id: string;
  product?: StorePaymentProduct;
  eyebrow: I18nKey;
  title: I18nKey;
  caption: I18nKey;
  items: I18nKey[];
  action: I18nKey;
  price: I18nKey;
  tone: StoreCardTone;
  comingSoon?: boolean;
};

export type StoreFeature = {
  title: I18nKey;
  caption: I18nKey;
};

export const storeProductCards: StoreCard[] = [
  {
    id: 'premium',
    product: 'premium',
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
    price: 'store.showcase.premiumPrice',
    tone: 'premium',
  },
  {
    id: 'business',
    product: 'business',
    eyebrow: 'store.business.eyebrow',
    title: 'store.business.title',
    caption: 'store.business.caption',
    comingSoon: true,
    items: [
      'store.business.item.workspace',
      'store.business.item.reports',
      'store.business.item.premiumGift',
    ],
    action: 'store.action.businessSoon',
    price: 'store.showcase.businessSoonPrice',
    tone: 'business',
  },
];

export const storeCards = storeProductCards;

export const storeFeatures: StoreFeature[] = [
  { title: 'store.features.forecast.title', caption: 'store.features.forecast.caption' },
  { title: 'store.features.reports.title', caption: 'store.features.reports.caption' },
  { title: 'store.features.receipts.title', caption: 'store.features.receipts.caption' },
  { title: 'store.features.voice.title', caption: 'store.features.voice.caption' },
];
