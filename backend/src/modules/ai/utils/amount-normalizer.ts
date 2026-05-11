import { AICurrency } from '../types';

export const SUPPORTED_CURRENCIES: AICurrency[] = ['RUB', 'USD', 'EUR', 'VND'];

const CURRENCY_RATES_TO_RUB: Record<AICurrency, number> = {
  RUB: 1,
  USD: 100,
  EUR: 110,
  VND: 0.004,
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

const RU_THOUSAND = new Set(['тысяча', 'тысячи', 'тысяч', 'тыс']);
const RU_MILLION = new Set(['миллион', 'миллиона', 'миллионов', 'млн']);

export function normalizeCurrency(value: unknown, fallback: AICurrency = 'RUB'): AICurrency {
  if (typeof value !== 'string') return fallback;
  const raw = value.trim().toLowerCase();
  const upper = raw.toUpperCase();

  if (SUPPORTED_CURRENCIES.includes(upper as AICurrency)) return upper as AICurrency;
  if (/[₽]|\b(rub|ruble|rubles|руб|рубл|рублей|рубля|рубли|р|rur)\b/i.test(raw)) return 'RUB';
  if (/[$]|\b(usd|dollar|dollars|bucks|бакс|баксы|доллар|доллара|долларов)\b/i.test(raw)) return 'USD';
  if (/[€]|\b(eur|euro|евро)\b/i.test(raw)) return 'EUR';
  if (/\b(vnd|dong|đồng|донг|донгов|вьетнамск)/i.test(raw)) return 'VND';

  return fallback;
}

export function extractCurrencyFromText(text: string, fallback?: AICurrency): AICurrency | undefined {
  const found = normalizeCurrency(text, fallback ?? 'RUB');
  if (found !== 'RUB') return found;
  if (/[₽]|\b(rub|ruble|rubles|руб|рубл|рублей|рубля|рубли|р|rur)\b/i.test(text)) return 'RUB';
  return fallback;
}

function parseRussianNumberWords(value: string): number | null {
  const tokens = value.toLowerCase().replace(/ё/g, 'е').split(/[^а-яa-z0-9]+/i).filter(Boolean);
  if (tokens.length === 0) return null;

  let total = 0;
  let group = 0;
  let matched = false;

  for (const token of tokens) {
    if (RU_SMALL[token] !== undefined) {
      group += RU_SMALL[token];
      matched = true;
      continue;
    }

    if (RU_THOUSAND.has(token)) {
      total += (group || 1) * 1000;
      group = 0;
      matched = true;
      continue;
    }

    if (RU_MILLION.has(token)) {
      total += (group || 1) * 1_000_000;
      group = 0;
      matched = true;
      continue;
    }
  }

  const result = total + group;
  return matched && result > 0 ? result : null;
}

export function normalizeMoneyAmount(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) return Math.round(value);
  if (typeof value !== 'string') return null;

  const source = value.trim();
  if (!source) return null;

  const words = parseRussianNumberWords(source);
  if (words) return words;

  const compact = source.toLowerCase().replace(',', '.').replace(/\s+/g, '');
  const multiplier = /(?:k|к|тыс|thousand)$/i.test(compact)
    ? 1000
    : /(?:m|м|млн|million)$/i.test(compact)
      ? 1_000_000
      : 1;

  const numeric = compact.replace(/(?:k|к|тыс|thousand|m|м|млн|million)$/i, '').replace(/[^0-9.]/g, '');
  const parsed = Number(numeric);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;

  return Math.round(parsed * multiplier);
}

export function extractAmountCandidates(text: string): number[] {
  const candidates: number[] = [];
  const normalized = text.replace(/ё/g, 'е');

  const digitPattern = /(?:\d+[\s\d]*(?:[.,]\d+)?)(?:\s*(?:к|k|тыс\.?|thousand|м|m|млн|million))?/gi;
  for (const match of normalized.matchAll(digitPattern)) {
    const amount = normalizeMoneyAmount(match[0]);
    if (amount) candidates.push(amount);
  }

  const wordPattern = /(?:(?:один|одна|одно|два|две|три|четыре|пять|шесть|семь|восемь|девять|десять|одиннадцать|двенадцать|тринадцать|четырнадцать|пятнадцать|шестнадцать|семнадцать|восемнадцать|девятнадцать|двадцать|тридцать|сорок|пятьдесят|шестьдесят|семьдесят|восемьдесят|девяносто|сто|двести|триста|четыреста|пятьсот|шестьсот|семьсот|восемьсот|девятьсот)\s+)*(?:тысяча|тысячи|тысяч|миллион|миллиона|миллионов)/gi;
  for (const match of normalized.matchAll(wordPattern)) {
    const amount = normalizeMoneyAmount(match[0]);
    if (amount) candidates.push(amount);
  }

  return Array.from(new Set(candidates));
}

export function convertMoney(amount: number, from: AICurrency, to: AICurrency) {
  if (from === to) return Math.round(amount);
  const amountInRub = amount * CURRENCY_RATES_TO_RUB[from];
  return Math.round(amountInRub / CURRENCY_RATES_TO_RUB[to]);
}
