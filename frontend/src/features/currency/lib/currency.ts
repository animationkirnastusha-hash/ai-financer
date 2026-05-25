export type AppCurrencyCode = 'RUB' | 'USD' | 'EUR' | 'KZT' | 'UZS' | 'KGS' | 'AMD' | 'GEL' | 'AZN';

export type CurrencyProfile = {
  code: AppCurrencyCode;
  label: string;
  symbol: string;
  countries: string[];
};

export const APP_CURRENCIES: CurrencyProfile[] = [
  { code: 'RUB', label: 'Российский рубль', symbol: '₽', countries: ['RU'] },
  { code: 'USD', label: 'Доллар США', symbol: '$', countries: ['US'] },
  { code: 'EUR', label: 'Евро', symbol: '€', countries: ['DE', 'FR', 'ES', 'IT', 'FI', 'NL', 'PT', 'AT', 'BE', 'IE', 'LV', 'LT', 'EE'] },
  { code: 'KZT', label: 'Казахстанский тенге', symbol: '₸', countries: ['KZ'] },
  { code: 'UZS', label: 'Узбекский сум', symbol: 'soʻm', countries: ['UZ'] },
  { code: 'KGS', label: 'Кыргызский сом', symbol: 'с', countries: ['KG'] },
  { code: 'AMD', label: 'Армянский драм', symbol: '֏', countries: ['AM'] },
  { code: 'GEL', label: 'Грузинский лари', symbol: '₾', countries: ['GE'] },
  { code: 'AZN', label: 'Азербайджанский манат', symbol: '₼', countries: ['AZ'] },
];

const RUB_RATES: Record<AppCurrencyCode, number> = {
  RUB: 1,
  USD: 90,
  EUR: 100,
  KZT: 0.2,
  UZS: 0.007,
  KGS: 1,
  AMD: 0.23,
  GEL: 33,
  AZN: 53,
};

export function isAppCurrency(value: unknown): value is AppCurrencyCode {
  return typeof value === 'string' && APP_CURRENCIES.some((item) => item.code === value.toUpperCase());
}

export function normalizeCurrency(value: unknown, fallback: AppCurrencyCode = 'RUB'): AppCurrencyCode {
  if (typeof value !== 'string') return fallback;
  const upper = value.trim().toUpperCase();
  return isAppCurrency(upper) ? upper : fallback;
}

export function getCurrencyProfile(code: string): CurrencyProfile {
  const normalized = normalizeCurrency(code);
  return APP_CURRENCIES.find((item) => item.code === normalized) ?? APP_CURRENCIES[0];
}

export function convertCurrency(amount: number, from: string, to: string, overrides?: Partial<Record<AppCurrencyCode, number>>) {
  const source = normalizeCurrency(from);
  const target = normalizeCurrency(to);
  const rates = { ...RUB_RATES, ...(overrides ?? {}) };
  const sourceRate = rates[source] || 1;
  const targetRate = rates[target] || 1;
  if (!Number.isFinite(amount)) return 0;
  return (amount * sourceRate) / targetRate;
}

export function detectCurrencyByTelegramCountry(countryCode?: string | null): AppCurrencyCode {
  const upper = typeof countryCode === 'string' ? countryCode.trim().toUpperCase() : '';
  const profile = APP_CURRENCIES.find((item) => item.countries.includes(upper));
  return profile?.code ?? 'RUB';
}
