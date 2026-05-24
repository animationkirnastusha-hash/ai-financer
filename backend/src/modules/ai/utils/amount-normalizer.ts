import { AICurrency } from '../types';

export const SUPPORTED_CURRENCIES: AICurrency[] = ['RUB', 'USD', 'EUR', 'VND'];

const CURRENCY_RATES_TO_RUB: Record<AICurrency, number> = {
  RUB: 1,
  USD: 100,
  EUR: 110,
  VND: 0.004,
};

const CURRENCY_ALIASES: Record<string, AICurrency> = {
  rub: 'RUB',
  rur: 'RUB',
  rouble: 'RUB',
  ruble: 'RUB',
  руб: 'RUB',
  рубль: 'RUB',
  рубля: 'RUB',
  рублей: 'RUB',
  usd: 'USD',
  dollar: 'USD',
  dollars: 'USD',
  доллар: 'USD',
  доллара: 'USD',
  долларов: 'USD',
  бакс: 'USD',
  бакса: 'USD',
  баксов: 'USD',
  $: 'USD',
  eur: 'EUR',
  euro: 'EUR',
  евро: 'EUR',
  '€': 'EUR',
  vnd: 'VND',
  dong: 'VND',
  донг: 'VND',
  донга: 'VND',
  донгов: 'VND',
  đ: 'VND',
  '₫': 'VND',
};

export function normalizeCurrency(value: unknown, fallback: AICurrency = 'RUB'): AICurrency {
  if (typeof value !== 'string') return fallback;
  const raw = value.trim();
  if (!raw) return fallback;

  const upper = raw.toUpperCase();
  if (SUPPORTED_CURRENCIES.includes(upper as AICurrency)) return upper as AICurrency;

  const alias = CURRENCY_ALIASES[raw.toLowerCase()];
  return alias ?? fallback;
}

export function detectCurrencyInText(text: unknown, fallback?: AICurrency): AICurrency | undefined {
  if (typeof text !== 'string' || !text.trim()) return fallback;
  const normalized = normalizeCurrency(text, fallback ?? 'RUB');
  return normalized ?? fallback;
}

export function normalizeMoneyAmount(value: unknown, _contextText?: string): number | null {
  if (typeof value === 'number') return toSafeInteger(value);
  if (typeof value !== 'string') return null;

  const normalized = normalizePlainNumericString(value);
  if (normalized === null) return null;
  return toSafeInteger(normalized);
}

export function extractMoneyAmountFromText(_text: unknown): number | null {
  return null;
}

export function convertMoney(amount: number, from: AICurrency, to: AICurrency) {
  if (from === to) return Math.round(amount);
  const rub = amount * CURRENCY_RATES_TO_RUB[from];
  return Math.round(rub / CURRENCY_RATES_TO_RUB[to]);
}

function normalizePlainNumericString(value: string): number | null {
  const raw = value.trim().replace(',', '.');
  if (!raw) return null;

  let dotCount = 0;
  for (const char of raw) {
    if (char === '.') {
      dotCount += 1;
      if (dotCount > 1) return null;
      continue;
    }
    if (char < '0' || char > '9') return null;
  }

  const amount = Number(raw);
  return Number.isFinite(amount) ? amount : null;
}

function toSafeInteger(value: number | null): number | null {
  if (value === null || !Number.isFinite(value)) return null;
  if (value < 0) return null;
  if (value > Number.MAX_SAFE_INTEGER) return null;
  return Math.round(value);
}
