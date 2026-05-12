import { AICurrency } from '../types';

export const SUPPORTED_CURRENCIES: AICurrency[] = ['RUB', 'USD', 'EUR', 'VND'];

const CURRENCY_RATES_TO_RUB: Record<AICurrency, number> = {
  RUB: 1,
  USD: 100,
  EUR: 110,
  VND: 0.004,
};

const CURRENCY_ALIASES: Record<string, AICurrency> = {
  RUB: 'RUB',
  RUR: 'RUB',
  RUBLES: 'RUB',
  RUBLE: 'RUB',
  РУБ: 'RUB',
  РУБЛЬ: 'RUB',
  РУБЛЯ: 'RUB',
  РУБЛЕЙ: 'RUB',
  РУБЛИ: 'RUB',
  '₽': 'RUB',
  USD: 'USD',
  DOLLAR: 'USD',
  DOLLARS: 'USD',
  ДОЛЛАР: 'USD',
  ДОЛЛАРА: 'USD',
  ДОЛЛАРОВ: 'USD',
  БАКС: 'USD',
  БАКСОВ: 'USD',
  '$': 'USD',
  EUR: 'EUR',
  EURO: 'EUR',
  ЕВРО: 'EUR',
  '€': 'EUR',
  VND: 'VND',
  DONG: 'VND',
  DONGS: 'VND',
  ДОНГ: 'VND',
  ДОНГОВ: 'VND',
  '₫': 'VND',
};

const RU_SMALL: Record<string, number> = {
  ноль: 0,
  один: 1,
  одна: 1,
  одно: 1,
  два: 2,
  две: 2,
  три: 3,
  четыре: 4,
  пять: 5,
  шесть: 6,
  семь: 7,
  восемь: 8,
  девять: 9,
  десять: 10,
  одиннадцать: 11,
  двенадцать: 12,
  тринадцать: 13,
  четырнадцать: 14,
  пятнадцать: 15,
  шестнадцать: 16,
  семнадцать: 17,
  восемнадцать: 18,
  девятнадцать: 19,
  двадцать: 20,
  тридцать: 30,
  сорок: 40,
  пятьдесят: 50,
  шестьдесят: 60,
  семьдесят: 70,
  восемьдесят: 80,
  девяносто: 90,
  сто: 100,
  двести: 200,
  триста: 300,
  четыреста: 400,
  пятьсот: 500,
  шестьсот: 600,
  семьсот: 700,
  восемьсот: 800,
  девятьсот: 900,
};

const EN_SMALL: Record<string, number> = {
  zero: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
  hundred: 100,
};

function cleanText(value: string) {
  return value
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[,]/g, '.')
    .replace(/[₽$€₫]/g, ' $& ')
    .replace(/[^\p{L}\p{N}.$€₽₫]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeCurrency(value: unknown, fallback: AICurrency = 'RUB'): AICurrency {
  if (typeof value !== 'string') return fallback;
  const raw = value.trim();
  if (!raw) return fallback;

  const upper = raw.toUpperCase();
  if (SUPPORTED_CURRENCIES.includes(upper as AICurrency)) return upper as AICurrency;

  const normalized = cleanText(raw).toUpperCase();
  const parts = normalized.split(/\s+/).filter(Boolean);
  for (const part of [normalized, ...parts]) {
    const currency = CURRENCY_ALIASES[part];
    if (currency) return currency;
  }

  return fallback;
}

function parseNumericAmount(text: string): number | null {
  const normalized = cleanText(text).replace(/\s+(?=\d)/g, '');
  const match = normalized.match(/(\d+(?:\.\d+)?)(?:\s*)(к|k|тыс|тысяч|тысяча|тысячи|thousand|млн|миллион|миллиона|миллионов|million|m)?/i);
  if (!match) return null;

  const base = Number(match[1]);
  if (!Number.isFinite(base) || base <= 0) return null;

  const suffix = (match[2] || '').toLowerCase();
  const multiplier = ['к', 'k', 'тыс', 'тысяч', 'тысяча', 'тысячи', 'thousand'].includes(suffix)
    ? 1000
    : ['млн', 'миллион', 'миллиона', 'миллионов', 'million', 'm'].includes(suffix)
      ? 1_000_000
      : 1;

  return Math.round(base * multiplier);
}

function parseWordsAmount(text: string): number | null {
  const tokens = cleanText(text).split(/\s+/).filter(Boolean);
  if (!tokens.length) return null;

  let total = 0;
  let current = 0;
  let matched = false;

  for (const token of tokens) {
    if (RU_SMALL[token] !== undefined) {
      current += RU_SMALL[token];
      matched = true;
      continue;
    }

    if (EN_SMALL[token] !== undefined) {
      const value = EN_SMALL[token];
      if (token === 'hundred') current = Math.max(current, 1) * 100;
      else current += value;
      matched = true;
      continue;
    }

    if (['тысяча', 'тысячи', 'тысяч', 'тыс', 'thousand'].includes(token)) {
      total += Math.max(current, 1) * 1000;
      current = 0;
      matched = true;
      continue;
    }

    if (['миллион', 'миллиона', 'миллионов', 'млн', 'million'].includes(token)) {
      total += Math.max(current, 1) * 1_000_000;
      current = 0;
      matched = true;
      continue;
    }
  }

  const result = total + current;
  return matched && result > 0 ? Math.round(result) : null;
}

export function normalizeMoneyAmount(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) return Math.round(value);
  if (typeof value !== 'string') return null;

  const numeric = parseNumericAmount(value);
  if (numeric) return numeric;

  return parseWordsAmount(value);
}

export function normalizeMoneyAmountFromCandidates(...values: unknown[]): number | null {
  for (const value of values) {
    const amount = normalizeMoneyAmount(value);
    if (amount) return amount;
  }

  return null;
}

export function convertMoney(amount: number, from: AICurrency, to: AICurrency) {
  if (from === to) return Math.round(amount);
  const amountInRub = amount * CURRENCY_RATES_TO_RUB[from];
  return Math.round(amountInRub / CURRENCY_RATES_TO_RUB[to]);
}
