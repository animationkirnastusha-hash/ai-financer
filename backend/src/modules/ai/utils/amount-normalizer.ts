import { AICurrency } from '../types';

export const SUPPORTED_CURRENCIES: AICurrency[] = ['RUB', 'USD', 'EUR', 'VND'];

const CURRENCY_RATES_TO_RUB: Record<AICurrency, number> = {
  RUB: 1,
  USD: 100,
  EUR: 110,
  VND: 0.004,
};

const SCALE_WORDS: Array<[RegExp, number]> = [
  [/(тыс(?:\.|яч[аи]?|яч|ячи|ячами)?|тысяч|тыщи|тыщ|к|k|nghìn|ngan|thousand)/i, 1_000],
  [/(млн|миллион(?:а|ов)?|million|triệu)/i, 1_000_000],
];

const RU_NUMBER_WORDS: Record<string, number> = {
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

export function normalizeCurrency(value: unknown, fallback: AICurrency = 'RUB'): AICurrency {
  if (typeof value !== 'string') return fallback;
  const raw = value.trim().toLowerCase();
  const upper = raw.toUpperCase();

  if (SUPPORTED_CURRENCIES.includes(upper as AICurrency)) return upper as AICurrency;
  if (/₽|руб|rur|rub|rouble|ruble|рубл/.test(raw)) return 'RUB';
  if (/\$|usd|доллар|долларов|доллары|бакс|баксов|dollar/.test(raw)) return 'USD';
  if (/€|eur|евро|euro/.test(raw)) return 'EUR';
  if (/vnd|донг|донгов|dong|đ|₫/.test(raw)) return 'VND';

  return fallback;
}

export function detectCurrencyInText(text: unknown, fallback?: AICurrency): AICurrency | undefined {
  if (typeof text !== 'string' || !text.trim()) return fallback;
  const raw = text.toLowerCase();

  if (/₽|руб|rur|rub|rouble|ruble|рубл/.test(raw)) return 'RUB';
  if (/\$|usd|доллар|долларов|доллары|бакс|баксов|dollar/.test(raw)) return 'USD';
  if (/€|eur|евро|euro/.test(raw)) return 'EUR';
  if (/vnd|донг|донгов|dong|đ|₫/.test(raw)) return 'VND';

  return fallback;
}

export function normalizeMoneyAmount(value: unknown, contextText?: string): number | null {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    const contextScale = contextText ? detectScale(contextText) : 1;
    if (value < 1000 && contextScale > 1) return Math.round(value * contextScale);
    return Math.round(value);
  }

  const parts = [typeof value === 'string' ? value : '', contextText ?? '']
    .filter(Boolean)
    .join(' ')
    .trim();

  if (!parts) return null;

  const raw = parts.toLowerCase();
  const compact = raw.replace(/[,]/g, '.').replace(/\s+/g, '');
  const numeric = compact.match(/\d+(?:\.\d+)?/);

  if (numeric) {
    const parsedNumber = Number(numeric[0]);
    if (!Number.isFinite(parsedNumber) || parsedNumber <= 0) return null;
    return Math.round(parsedNumber * detectScale(raw));
  }

  const wordsValue = russianNumberWordsToNumber(raw);
  if (wordsValue > 0) return Math.round(wordsValue * detectScale(raw));

  return null;
}

export function convertMoney(amount: number, from: AICurrency, to: AICurrency) {
  if (from === to) return Math.round(amount);
  const amountInRub = amount * CURRENCY_RATES_TO_RUB[from];
  return Math.round(amountInRub / CURRENCY_RATES_TO_RUB[to]);
}

function detectScale(raw: string) {
  return SCALE_WORDS.find(([pattern]) => pattern.test(raw))?.[1] ?? 1;
}

function russianNumberWordsToNumber(raw: string) {
  const words = raw
    .replace(/[^а-яё\s-]/gi, ' ')
    .split(/[\s-]+/)
    .map((word) => word.trim())
    .filter(Boolean);

  return words.reduce((sum, word) => sum + (RU_NUMBER_WORDS[word] ?? 0), 0);
}
