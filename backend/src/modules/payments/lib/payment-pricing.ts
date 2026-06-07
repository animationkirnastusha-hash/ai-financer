import type { StoreProduct } from '../../subscription/service';

export type PaymentDuration = 'month' | 'year';

export type StorePricePlan = {
  amount: number;
  baseAmount: number;
  currency: 'RUB';
  title: string;
  description: string;
  days: number;
  discountPercent: number;
  monthsCharged: number;
};

const RUB = 'RUB' as const;

export const STORE_PRICE_CATALOG: Record<StoreProduct, Record<PaymentDuration, StorePricePlan>> = {
  premium: {
    month: {
      amount: 56_000,
      baseAmount: 70_000,
      currency: RUB,
      title: 'Premium на месяц',
      description: 'Premium доступ на 30 дней',
      days: 30,
      discountPercent: 20,
      monthsCharged: 1,
    },
    year: {
      amount: 630_000,
      baseAmount: 840_000,
      currency: RUB,
      title: 'Premium на год',
      description: 'Premium доступ на 12 месяцев, оплата как за 9 месяцев',
      days: 365,
      discountPercent: 25,
      monthsCharged: 9,
    },
  },
  business: {
    month: {
      amount: 120_000,
      baseAmount: 150_000,
      currency: RUB,
      title: 'Business на месяц',
      description: 'Business доступ на 30 дней. Premium включён',
      days: 30,
      discountPercent: 20,
      monthsCharged: 1,
    },
    year: {
      amount: 1_350_000,
      baseAmount: 1_800_000,
      currency: RUB,
      title: 'Business на год',
      description: 'Business доступ на 12 месяцев, оплата как за 9 месяцев. Premium включён',
      days: 365,
      discountPercent: 25,
      monthsCharged: 9,
    },
  },
};

function getStarsRubRate(): number {
  const raw = Number(process.env.TELEGRAM_STARS_RUB_RATE || 1);
  return Number.isFinite(raw) && raw > 0 ? raw : 1;
}

export function toStarsAmount(rubKopecks: number): number {
  const rub = Math.ceil(rubKopecks / 100);
  return Math.max(1, Math.round(rub / getStarsRubRate()));
}

export function getPricePlan(product: StoreProduct, duration: PaymentDuration): StorePricePlan {
  return STORE_PRICE_CATALOG[product][duration];
}
