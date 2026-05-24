import { AICurrency } from '../types';

export const SUPPORTED_CURRENCIES: AICurrency[] = ['RUB', 'USD', 'EUR', 'VND'];

const CURRENCY_RATES_TO_RUB: Record<AICurrency, number> = {
  RUB: 1,
  USD: 100,
  EUR: 110,
  VND: 0.004,
};

export function normalizeCurrency(value: unknown, fallback: AICurrency = 'RUB'): AICurrency {
  if (typeof value !== 'string') return fallback;
  const raw = value.trim().toLowerCase();
  const upper = raw.toUpperCase();

  if (SUPPORTED_CURRENCIES.includes(upper as AICurrency)) return upper as AICurrency;
  if (raw === '₽' || raw === 'руб' || raw === 'руб.' || raw === 'rur' || raw === 'rub' || raw === 'rouble' || raw === 'ruble') return 'RUB';
  if (raw === '$' || raw === 'usd' || raw === 'доллар' || raw === 'доллары' || raw === 'долларов' || raw === 'бакс' || raw === 'баксы' || raw === 'баксов' || raw === 'dollar') return 'USD';
  if (raw === '€' || raw === 'eur' || raw === 'евро' || raw === 'euro') return 'EUR';
  if (raw === 'vnd' || raw === 'донг' || raw === 'донги' || raw === 'донгов' || raw === 'dong' || raw === 'đ' || raw === '₫') return 'VND';

  return fallback;
}

export function detectCurrencyInText(text: unknown, fallback?: AICurrency): AICurrency | undefined {
  if (typeof text !== 'string' || !text.trim()) return fallback;
  const tokens = text
    .toLowerCase()
    .replace(/[.,;:!?()\[\]{}]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

  for (const token of tokens) {
    const normalized = normalizeCurrency(token, '__fallback__' as AICurrency);
    if (normalized !== ('__fallback__' as AICurrency)) return normalized;
  }

  return fallback;
}

/**
 * Accepts only structured numeric contract values produced by the AI tool contract.
 * This function intentionally does not read natural-language command text.
 */
export function normalizeMoneyAmount(value: unknown, _contextText?: string): number | null {
  if (typeof value === 'number') return toSafeInteger(value);
  if (typeof value !== 'string') return null;

  const raw = value.trim().replace(',', '.');
  if (!raw) return null;

  // Structured numeric value only. No suffixes, no words, no embedded command text.
  if (!/^\d{1,15}(?:\.\d{1,2})?$/.test(raw)) return null;

  return toSafeInteger(Number(raw));
}

export function convertMoney(amount: number, from: AICurrency, to: AICurrency) {
  if (from === to) return Math.round(amount);
  const amountInRub = amount * CURRENCY_RATES_TO_RUB[from];
  return Math.round(amountInRub / CURRENCY_RATES_TO_RUB[to]);
}

function toSafeInteger(value: number) {
  if (!Number.isFinite(value) || value <= 0) return null;
  const rounded = Math.round(value);
  if (!Number.isSafeInteger(rounded) || rounded <= 0) return null;
  return rounded;
}
