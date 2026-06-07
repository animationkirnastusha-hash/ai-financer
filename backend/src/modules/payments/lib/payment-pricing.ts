import type { StoreProduct } from '../../subscription/service';

export type PaymentDuration = 'month' | 'year';

export type StorePricePlan = {
  amount: number;
  baseAmount: number;
  currency: 'RUB';
  starsAmount: number;
  starsBaseAmount: number;
  starsCurrency: 'XTR';
  title: string;
  description: string;
  days: number;
  discountPercent: number;
  monthsCharged: number;
};

const RUB = 'RUB' as const;
const XTR = 'XTR' as const;

export const STORE_PRICE_CATALOG: Record<StoreProduct, Record<PaymentDuration, StorePricePlan>> = {
  premium: {
    month: {
      amount: 39_900,
      baseAmount: 49_900,
      currency: RUB,
      starsAmount: 399,
      starsBaseAmount: 499,
      starsCurrency: XTR,
      title: 'Premium на месяц',
      description: 'Premium доступ на 30 дней',
      days: 30,
      discountPercent: 20,
      monthsCharged: 1,
    },
    year: {
      amount: 359_000,
      baseAmount: 478_800,
      currency: RUB,
      starsAmount: 3_590,
      starsBaseAmount: 4_788,
      starsCurrency: XTR,
      title: 'Premium на год',
      description: 'Premium доступ на 12 месяцев, оплата как за 9 месяцев',
      days: 365,
      discountPercent: 25,
      monthsCharged: 9,
    },
  },
  business: {
    month: {
      amount: 89_900,
      baseAmount: 119_900,
      currency: RUB,
      starsAmount: 899,
      starsBaseAmount: 1_199,
      starsCurrency: XTR,
      title: 'Business на месяц',
      description: 'Business доступ на 30 дней. Premium включён',
      days: 30,
      discountPercent: 25,
      monthsCharged: 1,
    },
    year: {
      amount: 809_000,
      baseAmount: 1_078_800,
      currency: RUB,
      starsAmount: 8_090,
      starsBaseAmount: 10_788,
      starsCurrency: XTR,
      title: 'Business на год',
      description: 'Business доступ на 12 месяцев, оплата как за 9 месяцев. Premium включён',
      days: 365,
      discountPercent: 25,
      monthsCharged: 9,
    },
  },
};

export function getPricePlan(product: StoreProduct, duration: PaymentDuration): StorePricePlan {
  return STORE_PRICE_CATALOG[product][duration];
}
