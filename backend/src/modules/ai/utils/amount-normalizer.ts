import { AICurrency } from '../types';

export const SUPPORTED_CURRENCIES: AICurrency[] = ['RUB', 'USD', 'EUR', 'VND'];

const CURRENCY_RATES_TO_RUB: Record<AICurrency, number> = {
  RUB: 1,
  USD: 100,
  EUR: 110,
  VND: 0.004,
};

const NUMBER_WORDS_RU: Record<string, number> = {
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
};

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .replace(/[₽]/g, ' руб ')
    .replace(/[$]/g, ' usd ')
    .replace(/[€]/g, ' eur ')
    .replace(/[,]/g, '.')
    .replace(/[\u00a0\u202f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseRussianWords(text: string) {
  const tokens = normalizeText(text).split(/\s+/).filter(Boolean);
  let current = 0;
  let total = 0;
  let seen = false;

  for (const token of tokens) {
    if (NUMBER_WORDS_RU[token] !== undefined) {
      current += NUMBER_WORDS_RU[token];
      seen = true;
      continue;
    }

    if (/^тыс/.test(token) || /^тысяч/.test(token)) {
      total += (current || 1) * 1000;
      current = 0;
      seen = true;
      continue;
    }

    if (/^млн/.test(token) || /^миллион/.test(token)) {
      total += (current || 1) * 1_000_000;
      current = 0;
      seen = true;
      continue;
    }
  }

  const result = total + current;
  return seen && result > 0 ? result : null;
}

export function normalizeCurrency(value: unknown, fallback: AICurrency = 'RUB'): AICurrency {
  if (typeof value !== 'string') return fallback;

  const text = normalizeText(value);
  const upper = text.toUpperCase();

  if (SUPPORTED_CURRENCIES.includes(upper as AICurrency)) return upper as AICurrency;

  if (/(^|\s)(rub|ruble|rubles|руб|рубл|рублей|рубля|₽)(\s|$)/i.test(text)) return 'RUB';
  if (/(^|\s)(usd|dollar|dollars|бакс|баксов|доллар|долларов|\$)(\s|$)/i.test(text)) return 'USD';
  if (/(^|\s)(eur|euro|euros|евро|€)(\s|$)/i.test(text)) return 'EUR';
  if (/(^|\s)(vnd|dong|đồng|донг|донгов)(\s|$)/i.test(text)) return 'VND';

  return fallback;
}

export function extractCurrencyFromText(value: unknown, fallback: AICurrency = 'RUB'): AICurrency {
  return normalizeCurrency(value, fallback);
}

export function normalizeMoneyAmount(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return Math.round(value);
  }

  if (typeof value !== 'string') return null;

  const text = normalizeText(value);
  if (!text) return null;

  const wordAmount = parseRussianWords(text);
  if (wordAmount !== null) return Math.round(wordAmount);

  const compact = text.replace(/(?<=\d)\s+(?=\d{3}(\D|$))/g, '');
  const numberMatch = compact.match(/(\d+(?:\.\d+)?)/);
  if (!numberMatch) return null;

  const rawNumber = Number(numberMatch[1]);
  if (!Number.isFinite(rawNumber) || rawNumber <= 0) return null;

  const tail = compact.slice(numberMatch.index! + numberMatch[0].length);
  const hasThousands = /^(\s)*(к|k|тыс\.?|тысяч|thousand|nghìn|ngan)\b/i.test(tail)
    || /\b(к|k|тыс\.?|тысяч|thousand|nghìn|ngan)\b/i.test(text);
  const hasMillions = /^(\s)*(м|m|млн\.?|million|triệu)\b/i.test(tail)
    || /\b(млн\.?|million|triệu)\b/i.test(text);

  const multiplier = hasMillions ? 1_000_000 : hasThousands ? 1000 : 1;
  return Math.round(rawNumber * multiplier);
}

export function convertMoney(amount: number, from: AICurrency, to: AICurrency) {
  if (from === to) return Math.round(amount);
  const amountInRub = amount * CURRENCY_RATES_TO_RUB[from];
  return Math.round(amountInRub / CURRENCY_RATES_TO_RUB[to]);
}
