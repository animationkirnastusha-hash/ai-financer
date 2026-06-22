import type { StoreProduct } from '../../subscription/service';

export type PaymentDuration = 'month' | 'year' | 'once';

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

export const STORE_PRICE_CATALOG: Record<StoreProduct, Partial<Record<PaymentDuration, StorePricePlan>>> = {
  premium: {
    month: {
      amount: 39_900,
      baseAmount: 49_900,
      currency: RUB,
      starsAmount: 414,
      starsBaseAmount: 518,
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
      starsAmount: 3_727,
      starsBaseAmount: 4_970,
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
      starsAmount: 934,
      starsBaseAmount: 1_245,
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
      starsAmount: 8_394,
      starsBaseAmount: 11_199,
      starsCurrency: XTR,
      title: 'Business на год',
      description: 'Business доступ на 12 месяцев, оплата как за 9 месяцев. Premium включён',
      days: 365,
      discountPercent: 25,
      monthsCharged: 9,
    },
  },
  bundle_try: {
    once: {
      amount: 9_900,
      baseAmount: 9_900,
      currency: RUB,
      starsAmount: 103,
      starsBaseAmount: 103,
      starsCurrency: XTR,
      title: 'Попробовать Фину',
      description: '10 голосовых действий, 2 чека и 1 глубокий разбор на 30 дней',
      days: 30,
      discountPercent: 0,
      monthsCharged: 0,
    },
  },
  bundle_week: {
    once: {
      amount: 19_900,
      baseAmount: 19_900,
      currency: RUB,
      starsAmount: 207,
      starsBaseAmount: 207,
      starsCurrency: XTR,
      title: 'На неделю',
      description: '30 голосовых действий, 5 чеков, 2 разбора и 1 отчёт на 30 дней',
      days: 30,
      discountPercent: 0,
      monthsCharged: 0,
    },
  },
};

export function getAvailableDurations(product: StoreProduct): PaymentDuration[] {
  return product === 'premium' || product === 'business' ? ['month', 'year'] : ['once'];
}

export function getPricePlan(product: StoreProduct, duration: PaymentDuration): StorePricePlan {
  const plan = STORE_PRICE_CATALOG[product]?.[duration];
  if (!plan) {
    const fallback = getAvailableDurations(product)[0] ?? 'once';
    const fallbackPlan = STORE_PRICE_CATALOG[product]?.[fallback];
    if (!fallbackPlan) throw new Error(`Unknown store price plan: ${product}/${duration}`);
    return fallbackPlan;
  }
  return plan;
}
