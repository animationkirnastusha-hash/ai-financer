import { AICurrency } from '../types';

export const SUPPORTED_CURRENCIES: AICurrency[] = ['RUB', 'USD', 'EUR', 'VND'];

const CURRENCY_RATES_TO_RUB: Record<AICurrency, number> = {
  RUB: 1,
  USD: 100,
  EUR: 110,
  VND: 0.004,
};

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
  тысяча: 1000,
  тысячи: 1000,
  тысяч: 1000,
  миллион: 1_000_000,
  миллиона: 1_000_000,
  миллионов: 1_000_000,
};

const THOUSAND_WORDS = new Set(['к', 'k', 'тыс', 'тыс.', 'тысяч', 'тысяча', 'тысячи', 'тыщ', 'nghìn', 'ngan', 'thousand']);
const MILLION_WORDS = new Set(['млн', 'млн.', 'миллион', 'миллиона', 'миллионов', 'million', 'triệu']);
const CURRENCY_WORDS = '(?:₽|руб\\.?|rur|rub|rouble|ruble|рубл(?:ей|я|ь)?|\\$|usd|доллар(?:ов|ы|а)?|бакс(?:ов|ы|а)?|dollar|€|eur|евро|euro|vnd|донг(?:ов|и|а)?|dong|đ|₫)';
const MONEY_CONTEXT_WORDS = '(?:баланс(?:ом)?|сумм[аы]?|цель|на|положи|пополн(?:и|ить)?|добавь|доход|расход|перев(?:еди|од)?|стоит|стоимость|цена)';

export function normalizeCurrency(value: unknown, fallback: AICurrency = 'RUB'): AICurrency {
  if (typeof value !== 'string') return fallback;
  const raw = value.trim().toLowerCase();
  const upper = raw.toUpperCase();

  if (SUPPORTED_CURRENCIES.includes(upper as AICurrency)) return upper as AICurrency;
  if (/(^|\s)(₽|руб\.?|rur|rub|rouble|ruble|рубл(?:ей|я|ь)?)(\s|$)/iu.test(raw)) return 'RUB';
  if (/(^|\s)(\$|usd|доллар(?:ов|ы|а)?|бакс(?:ов|ы|а)?|dollar)(\s|$)/iu.test(raw)) return 'USD';
  if (/(^|\s)(€|eur|евро|euro)(\s|$)/iu.test(raw)) return 'EUR';
  if (/(^|\s)(vnd|донг(?:ов|и|а)?|dong|đ|₫)(\s|$)/iu.test(raw)) return 'VND';

  return fallback;
}

export function detectCurrencyInText(text: unknown, fallback?: AICurrency): AICurrency | undefined {
  if (typeof text !== 'string' || !text.trim()) return fallback;
  return normalizeCurrency(text, fallback ?? 'RUB');
}

export function normalizeMoneyAmount(value: unknown, contextText?: string): number | null {
  const fromContext = extractMoneyAmountFromText(contextText);
  const fromValue = extractMoneyAmountFromValue(value);

  if (fromContext !== null) {
    if (fromValue !== null && suspiciousAmountMismatch(fromValue, fromContext)) return fromContext;
    return fromContext;
  }

  return fromValue;
}

export function extractMoneyAmountFromText(text: unknown): number | null {
  if (typeof text !== 'string') return null;
  const normalized = normalizeText(text);
  if (!normalized) return null;

  const candidates = collectMoneyCandidates(normalized);
  if (candidates.length) {
    candidates.sort((a, b) => b.score - a.score || a.index - b.index);
    return candidates[0].amount;
  }

  return russianNumberWordsToNumber(normalized);
}

function extractMoneyAmountFromValue(value: unknown): number | null {
  if (typeof value === 'number') return toSafeInteger(value);
  if (typeof value !== 'string') return null;

  const normalized = normalizeText(value);
  if (!normalized) return null;

  const candidates = collectMoneyCandidates(normalized);
  if (candidates.length) {
    candidates.sort((a, b) => b.score - a.score || a.index - b.index);
    return candidates[0].amount;
  }

  return russianNumberWordsToNumber(normalized);
}

function collectMoneyCandidates(text: string) {
  const candidates: Array<{ amount: number; score: number; index: number }> = [];
  const regex = /(?:^|[^\p{L}\p{N}])([0-9]{1,15}(?:[.,][0-9]+)?)(?:\s+([0-9]{3}))?\s*([а-яёa-z.$€₽₫]+)?(?=$|[^\p{L}\p{N}])/giu;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    const rawNumber = match[2] ? `${match[1]}${match[2]}` : match[1];
    const numeric = Number(rawNumber.replace(',', '.'));
    if (!Number.isFinite(numeric)) continue;

    const scaleToken = match[3] && (THOUSAND_WORDS.has(match[3].toLowerCase()) || MILLION_WORDS.has(match[3].toLowerCase())) ? match[3] : '';
    const amount = toSafeInteger(numeric * (scaleToken ? scaleFromToken(scaleToken) : 1));
    if (!amount) continue;

    const start = Math.max(0, match.index - 28);
    const end = Math.min(text.length, regex.lastIndex + 28);
    const nearby = text.slice(start, end);
    const token = match[3] ?? '';
    let score = 0;

    if (new RegExp(CURRENCY_WORDS, 'iu').test(token) || new RegExp(CURRENCY_WORDS, 'iu').test(nearby)) score += 80;
    if (new RegExp(MONEY_CONTEXT_WORDS, 'iu').test(nearby)) score += 35;
    if (scaleToken) score += 25;
    if (String(Math.trunc(amount)).length >= 8 && !new RegExp(CURRENCY_WORDS, 'iu').test(nearby)) score -= 90;
    if (/автотест|test|id|номер|названи/iu.test(nearby) && !new RegExp(CURRENCY_WORDS, 'iu').test(nearby)) score -= 40;

    if (score >= 0) candidates.push({ amount, score, index: match.index });
  }

  return candidates;
}

export function convertMoney(amount: number, from: AICurrency, to: AICurrency) {
  if (from === to) return Math.round(amount);
  const amountInRub = amount * CURRENCY_RATES_TO_RUB[from];
  return Math.round(amountInRub / CURRENCY_RATES_TO_RUB[to]);
}

function scaleFromToken(token: string) {
  const clean = token.trim().toLowerCase().replace(/\.$/, '');
  if (THOUSAND_WORDS.has(clean)) return 1_000;
  if (MILLION_WORDS.has(clean)) return 1_000_000;
  return 1;
}

function normalizeText(text: string) {
  return text
    .replace(/[\u00A0\u202F]/g, ' ')
    .replace(/[₽$€₫]/g, ' $& ')
    .replace(/([0-9])([а-яёa-z])/giu, '$1 $2')
    .replace(/([а-яёa-z])([0-9])/giu, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function toSafeInteger(value: number) {
  if (!Number.isFinite(value) || value <= 0) return null;
  const rounded = Math.round(value);
  if (!Number.isSafeInteger(rounded) || rounded <= 0) return null;
  return rounded;
}

function suspiciousAmountMismatch(fromValue: number, fromContext: number) {
  if (fromValue === fromContext) return false;
  const max = Math.max(fromValue, fromContext);
  const min = Math.max(Math.min(fromValue, fromContext), 1);
  return max / min >= 10;
}

function russianNumberWordsToNumber(raw: string) {
  const words = raw
    .replace(/[^а-яё\s-]/giu, ' ')
    .split(/[\s-]+/)
    .map((word) => word.trim())
    .filter(Boolean);

  if (words.length === 0) return null;

  let total = 0;
  let current = 0;
  let matched = false;

  for (const word of words) {
    const value = RU_NUMBER_WORDS[word];
    if (value === undefined) continue;

    matched = true;

    if (value === 1000 || value === 1_000_000) {
      total += (current || 1) * value;
      current = 0;
      continue;
    }

    current += value;
  }

  if (!matched) return null;
  return toSafeInteger(total + current);
}
