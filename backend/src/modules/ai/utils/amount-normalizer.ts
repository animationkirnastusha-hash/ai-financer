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
    if (fromValue !== null && suspiciousAmountMismatch(fromValue, fromContext)) {
      return fromContext;
    }

    // Source user text is always more trusted than LLM output.
    return fromContext;
  }

  return fromValue;
}

export function extractMoneyAmountFromText(text: unknown): number | null {
  if (typeof text !== 'string') return null;
  const normalized = normalizeText(text);
  if (!normalized) return null;

  const candidates = collectNumericCandidates(normalized);
  if (candidates.length) return chooseMoneyCandidate(normalized, candidates);

  return russianNumberWordsToNumber(normalized);
}


type NumericCandidate = {
  value: number;
  start: number;
  end: number;
  raw: string;
  scaled: boolean;
  grouped: boolean;
};

const CURRENCY_HINT_RE = /^(\s)*(₽|руб\.?|rur|rub|rouble|ruble|рубл(?:ей|я|ь)?|\$|usd|доллар(?:ов|ы|а)?|бакс(?:ов|ы|а)?|€|eur|евро|vnd|донг(?:ов|и|а)?|dong|đ|₫)/iu;
const MONEY_VERB_RE = /(баланс|сумм(?:а|у|ой)?|цель|бюджет|доход|расход|потрат|купил|купила|оплат|перев(?:еди|ести|од)|пополни|положи|зарплат|стоим|цена|за|на)$/iu;
const ACCOUNT_NUMBER_HINT_RE = /(карта|карту|карты|сч[её]т|счета|кошел[её]к|наличка)$/iu;

function collectNumericCandidates(text: string): NumericCandidate[] {
  const candidates: NumericCandidate[] = [];

  for (const match of text.matchAll(/(?:^|[^\p{L}\p{N}])([0-9]{1,3}(?:\s+[0-9]{3})+)(?=$|[^\p{L}\p{N}])/giu)) {
    const raw = match[1];
    const value = toSafeInteger(Number(raw.replace(/\s+/g, '')));
    if (value !== null) candidates.push({ value, start: (match.index ?? 0) + match[0].indexOf(raw), end: (match.index ?? 0) + match[0].indexOf(raw) + raw.length, raw, scaled: false, grouped: true });
  }

  for (const match of text.matchAll(/(?:^|[^\p{L}\p{N}])([0-9]+(?:[.,][0-9]+)?)\s*(к|k|тыс\.?|тысяч(?:а|и)?|тыщ|nghìn|ngan|thousand|млн\.?|миллион(?:а|ов)?|million|triệu)(?=$|[^\p{L}\p{N}])/giu)) {
    const raw = match[1];
    const token = match[2];
    const value = toSafeInteger(Number(raw.replace(',', '.')) * scaleFromToken(token));
    if (value !== null) candidates.push({ value, start: (match.index ?? 0) + match[0].indexOf(raw), end: (match.index ?? 0) + match[0].indexOf(token) + token.length, raw: `${raw} ${token}`, scaled: true, grouped: false });
  }

  for (const match of text.matchAll(/(?:^|[^\p{L}\p{N}])([0-9]+(?:[.,][0-9]+)?)(?=$|[^\p{L}\p{N}])/giu)) {
    const raw = match[1];
    const value = toSafeInteger(Number(raw.replace(',', '.')));
    if (value !== null) candidates.push({ value, start: (match.index ?? 0) + match[0].indexOf(raw), end: (match.index ?? 0) + match[0].indexOf(raw) + raw.length, raw, scaled: false, grouped: false });
  }

  return candidates
    .filter((candidate, index, all) => all.findIndex((item) => item.start === candidate.start && item.end === candidate.end) === index)
    .sort((a, b) => a.start - b.start);
}

function chooseMoneyCandidate(text: string, candidates: NumericCandidate[]): number | null {
  let best: { candidate: NumericCandidate; score: number } | null = null;

  for (const candidate of candidates) {
    const before = text.slice(Math.max(0, candidate.start - 28), candidate.start).trim();
    const after = text.slice(candidate.end, Math.min(text.length, candidate.end + 28)).trim();
    let score = 0;

    if (candidate.scaled || candidate.grouped) score += 8;
    if (CURRENCY_HINT_RE.test(after)) score += 30;
    if (MONEY_VERB_RE.test(before)) score += 14;
    if (ACCOUNT_NUMBER_HINT_RE.test(before) && !CURRENCY_HINT_RE.test(after)) score -= 12;
    if (String(Math.trunc(candidate.value)).length >= 8 && !candidate.scaled && !candidate.grouped && !CURRENCY_HINT_RE.test(after)) score -= 28;
    score += candidate.start / Math.max(text.length, 1);

    if (!best || score > best.score) best = { candidate, score };
  }

  return best?.candidate.value ?? null;
}

function extractMoneyAmountFromValue(value: unknown): number | null {
  if (typeof value === 'number') return toSafeInteger(value);
  if (typeof value !== 'string') return null;

  const normalized = normalizeText(value);
  if (!normalized) return null;

  const groupedNumeric = normalized.match(/(?:^|[^\p{L}\p{N}])([0-9]{1,3}(?:\s+[0-9]{3})+)(?=$|[^\p{L}\p{N}])/iu);
  if (groupedNumeric) {
    return toSafeInteger(Number(groupedNumeric[1].replace(/\s+/g, '')));
  }

  const numericWithScale = normalized.match(/(?:^|[^\p{L}\p{N}])([0-9]+(?:[.,][0-9]+)?)\s*(к|k|тыс\.?|тысяч(?:а|и)?|тыщ|nghìn|ngan|thousand|млн\.?|миллион(?:а|ов)?|million|triệu)(?=$|[^\p{L}\p{N}])/iu);
  if (numericWithScale) {
    return toSafeInteger(Number(numericWithScale[1].replace(',', '.')) * scaleFromToken(numericWithScale[2]));
  }

  const plainNumeric = normalized.match(/(?:^|[^\p{L}\p{N}])([0-9]+(?:[.,][0-9]+)?)(?=$|[^\p{L}\p{N}])/iu);
  if (plainNumeric) {
    return toSafeInteger(Number(plainNumeric[1].replace(',', '.')));
  }

  return russianNumberWordsToNumber(normalized);
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
