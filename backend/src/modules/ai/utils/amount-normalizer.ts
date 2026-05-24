import { AICurrency } from '../types';

export const SUPPORTED_CURRENCIES: AICurrency[] = ['RUB', 'USD', 'EUR', 'VND'];

const CURRENCY_RATES_TO_RUB: Record<AICurrency, number> = {
  RUB: 1,
  USD: 100,
  EUR: 110,
  VND: 0.004,
};

/**
 * Normalizes a currency value that already came from the AI tool contract.
 * This function intentionally does not inspect a full user command.
 */
export function normalizeCurrency(value: unknown, fallback: AICurrency = 'RUB'): AICurrency {
  if (typeof value !== 'string') return fallback;
  const upper = value.trim().toUpperCase();
  if (SUPPORTED_CURRENCIES.includes(upper as AICurrency)) return upper as AICurrency;

  const clean = value.trim().toLowerCase();
  if (clean === '₽' || clean === 'руб' || clean === 'руб.' || clean === 'рубль' || clean === 'рубля' || clean === 'рублей') return 'RUB';
  if (clean === '$' || clean === 'usd' || clean === 'доллар' || clean === 'доллара' || clean === 'долларов') return 'USD';
  if (clean === '€' || clean === 'eur' || clean === 'евро') return 'EUR';
  if (clean === 'vnd' || clean === '₫' || clean === 'đ' || clean === 'донг' || clean === 'донга' || clean === 'донгов') return 'VND';

  return fallback;
}

/**
 * Kept for compatibility with validator code, but deliberately behaves like
 * normalizeCurrency over a contract field rather than a command-text parser.
 */
export function detectCurrencyInText(text: unknown, fallback?: AICurrency): AICurrency | undefined {
  if (typeof text !== 'string' || !text.trim()) return fallback;
  return normalizeCurrency(text, fallback ?? 'RUB');
}

/**
 * Normalizes an amount that already belongs to a structured tool field.
 * No regex extraction from natural-language commands is performed here.
 */
export function normalizeMoneyAmount(value: unknown, _contextText?: string): number | null {
  if (typeof value === 'number') return toSafeInteger(value);
  if (typeof value !== 'string') return null;

  const clean = value.trim().replace(/\s+/g, '');
  if (!clean) return null;

  // Strict contract format only: "300", "300.50", "300,50".
  // Shorthands like "5к" must be resolved by the AI planner before validation.
  if (!/^\d+(?:[.,]\d+)?$/.test(clean)) return null;
  return toSafeInteger(Number(clean.replace(',', '.')));
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
