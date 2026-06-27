export type PaymentDuration = 'month' | 'year' | 'once';
export type PaymentStoreProduct = 'premium' | 'bundle_try' | 'bundle_week';

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

export const STORE_PRICE_CATALOG: Record<PaymentStoreProduct, Partial<Record<PaymentDuration, StorePricePlan>>> = {
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

export function getAvailableDurations(product: PaymentStoreProduct): PaymentDuration[] {
  return product === 'premium' ? ['month', 'year'] : ['once'];
}

export function getPricePlan(product: PaymentStoreProduct, duration: PaymentDuration): StorePricePlan {
  const plan = STORE_PRICE_CATALOG[product]?.[duration];
  if (!plan) {
    const fallback = getAvailableDurations(product)[0] ?? 'once';
    const fallbackPlan = STORE_PRICE_CATALOG[product]?.[fallback];
    if (!fallbackPlan) throw new Error(`Unknown store price plan: ${product}/${duration}`);
    return fallbackPlan;
  }
  return plan;
}
