export type CurrencyCode = 'RUB' | 'USD' | 'EUR' | 'VND';

export type AmountCandidate = {
  amount: number;
  currency?: CurrencyCode;
  raw: string;
  index: number;
  endIndex: number;
};

const RU_NUMBERS: Record<string, number> = {
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

const EN_NUMBERS: Record<string, number> = {
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
};

const VI_NUMBERS: Record<string, number> = {
  không: 0,
  mot: 1,
  một: 1,
  hai: 2,
  ba: 3,
  bon: 4,
  bốn: 4,
  nam: 5,
  năm: 5,
  sau: 6,
  sáu: 6,
  bay: 7,
  bảy: 7,
  tam: 8,
  tám: 8,
  chin: 9,
  chín: 9,
  muoi: 10,
  mười: 10,
};

const MULTIPLIERS: Record<string, number> = {
  тысяча: 1_000,
  тысячи: 1_000,
  тысяч: 1_000,
  тыща: 1_000,
  тыщи: 1_000,
  тыщ: 1_000,
  тыс: 1_000,
  k: 1_000,
  к: 1_000,
  thousand: 1_000,
  thousands: 1_000,
  nghin: 1_000,
  nghìn: 1_000,
  ngan: 1_000,
  ngàn: 1_000,
  миллион: 1_000_000,
  миллиона: 1_000_000,
  миллионов: 1_000_000,
  млн: 1_000_000,
  million: 1_000_000,
  millions: 1_000_000,
  trieu: 1_000_000,
  triệu: 1_000_000,
};

const SLANG: Record<string, number> = {
  чирик: 10_000,
  десятка: 10_000,
  двадцатка: 20_000,
  полтос: 50_000,
  сотка: 100_000,
  пятихатка: 500,
  косарь: 1_000,
  штука: 1_000,
  пятак: 5_000,
  пятерка: 5_000,
  пятерочка: 5_000,
};

const CURRENCY_PATTERNS: Array<[CurrencyCode, RegExp]> = [
  ['USD', /(?:\$|usd|usdt|доллар(?:а|ов|ах)?|бакс(?:а|ов|ах)?|dollars?|bucks?)/i],
  ['EUR', /(?:€|eur|евро|euro?s?)/i],
  ['VND', /(?:₫|vnd|донг(?:а|ов|ах)?|dong|đồng)/i],
  ['RUB', /(?:₽|rub|руб(?:ль|ля|лей|ли|лях)?|рубли|рублей|р\.?\b|ruble?s?|rouble?s?)/i],
];

const currencyCleaner = /(?:₽|rub|руб(?:ль|ля|лей|ли|лях)?|рубли|рублей|р\.?\b|ruble?s?|rouble?s?|\$|usd|usdt|доллар(?:а|ов|ах)?|бакс(?:а|ов|ах)?|dollars?|bucks?|€|eur|евро|euro?s?|₫|vnd|донг(?:а|ов|ах)?|dong|đồng)/gi;
const digitAmountPattern = /(\d+(?:[\s.,]\d{3})*(?:[.,]\d+)?|\d+(?:[.,]\d+)?)(?:\s*(кк|kk|к|k|тыс\.?|тысяч|тысячи|тыща|тыщи|тыщ|млн|миллион(?:а|ов)?|million|millions|thousand|thousands|nghin|nghìn|ngan|ngàn|trieu|triệu))?(?:\s*(₽|руб(?:ль|ля|лей|ли|лях)?|рубли|рублей|р\.?|rub|ruble?s?|\$|usd|доллар(?:а|ов|ах)?|бакс(?:а|ов|ах)?|dollars?|bucks?|€|eur|евро|euro?s?|₫|vnd|донг(?:а|ов|ах)?|dong|đồng))?/gi;
const wordAmountPattern = /((?:(?:ноль|один|одна|одно|два|две|три|четыре|пять|шесть|семь|восемь|девять|десять|одиннадцать|двенадцать|тринадцать|четырнадцать|пятнадцать|шестнадцать|семнадцать|восемнадцать|девятнадцать|двадцать|тридцать|сорок|пятьдесят|шестьдесят|семьдесят|восемьдесят|девяносто|сто|двести|триста|четыреста|пятьсот|шестьсот|семьсот|восемьсот|девятьсот|zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|không|mot|một|hai|ba|bon|bốn|nam|năm|sau|sáu|bay|bảy|tam|tám|chin|chín|muoi|mười)\s*)+(?:тысяча|тысячи|тысяч|тыща|тыщи|тыщ|тыс|миллион|миллиона|миллионов|млн|thousand|thousands|million|millions|nghin|nghìn|ngan|ngàn|trieu|triệu))(?:\s*(?:₽|руб(?:ль|ля|лей|ли|лях)?|рубли|рублей|р\.?|rub|\$|usd|доллар(?:а|ов|ах)?|бакс(?:а|ов|ах)?|€|eur|евро|₫|vnd|донг(?:а|ов|ах)?|dong|đồng))?/gi;
const slangAmountPattern = /(чирик|десятка|двадцатка|полтос|сотка|пятихатка|косарь|штука|пятак|пятерка|пятерочка)(?:\s*(?:₽|руб(?:ль|ля|лей)?|р\.?))?/gi;

function normalizeText(value: string) {
  return value.toLowerCase().replace(/ё/g, 'е').replace(/,/g, '.').replace(/\s+/g, ' ').trim();
}

export function extractCurrencyFromText(text: string, fallback?: CurrencyCode): CurrencyCode | undefined {
  const source = normalizeText(text);
  for (const [currency, pattern] of CURRENCY_PATTERNS) {
    if (pattern.test(source)) return currency;
  }
  return fallback;
}

export function detectCurrency(input: unknown, fallback: CurrencyCode = 'RUB'): CurrencyCode {
  return extractCurrencyFromText(String(input ?? ''), fallback) ?? fallback;
}

function tokenValue(token: string): number | undefined {
  return RU_NUMBERS[token] ?? EN_NUMBERS[token] ?? VI_NUMBERS[token];
}

function parseWordAmount(raw: string): number | null {
  const source = normalizeText(raw)
    .replace(/[₽$€₫]/g, ' ')
    .replace(currencyCleaner, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!source) return null;
  if (SLANG[source]) return SLANG[source];

  const tokens = source.split(' ');
  let total = 0;
  let current = 0;
  let matched = false;

  for (const token of tokens) {
    const direct = tokenValue(token);
    if (direct !== undefined) {
      current += direct;
      matched = true;
      continue;
    }

    if (token === 'hundred') {
      current = (current || 1) * 100;
      matched = true;
      continue;
    }

    const multiplier = MULTIPLIERS[token];
    if (multiplier) {
      total += (current || 1) * multiplier;
      current = 0;
      matched = true;
      continue;
    }

    return null;
  }

  const value = total + current;
  return matched && value > 0 ? Math.round(value) : null;
}

export function normalizeAmount(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null;

  const rawText = String(raw).trim();
  if (!rawText) return null;

  const phraseValue = parseWordAmount(rawText);
  if (phraseValue !== null) return phraseValue;

  const source = normalizeText(rawText)
    .replace(/[₽$€₫]/g, '')
    .replace(currencyCleaner, '')
    .replace(/\s/g, '');

  if (!source) return null;
  if (SLANG[source]) return SLANG[source];

  const multiplied = source.match(/^(\d+(?:\.\d+)?)(кк|kk|млн|million|millions|миллион|миллиона|миллионов|trieu|triệu|к|k|тыс\.?|тысяч|тысячи|тыща|тыщи|тыщ|thousand|thousands|nghin|nghìn|ngan|ngàn)$/i);
  if (multiplied) {
    const number = Number(multiplied[1]);
    const suffix = multiplied[2].toLowerCase();
    const multiplier = /^(кк|kk|млн|million|millions|миллион|миллиона|миллионов|trieu|triệu)$/.test(suffix) ? 1_000_000 : 1_000;
    return Math.round(number * multiplier);
  }

  if (/^\d+(?:\.\d+)?$/.test(source)) {
    const value = Number(source);
    return Number.isFinite(value) ? Math.round(value) : null;
  }

  return null;
}

function collectByPattern(text: string, pattern: RegExp, candidates: AmountCandidate[]) {
  pattern.lastIndex = 0;
  for (const match of text.matchAll(pattern)) {
    const raw = (match[0] || '').trim();
    if (!raw) continue;
    const amount = normalizeAmount(raw);
    if (!amount || amount <= 0) continue;
    const index = match.index ?? text.indexOf(raw);
    candidates.push({ amount, currency: extractCurrencyFromText(raw), raw, index, endIndex: index + raw.length });
  }
}

export function extractAmountCandidates(text: string): AmountCandidate[] {
  const normalized = normalizeText(text);
  const candidates: AmountCandidate[] = [];

  collectByPattern(normalized, wordAmountPattern, candidates);
  collectByPattern(normalized, slangAmountPattern, candidates);

  digitAmountPattern.lastIndex = 0;
  for (const match of normalized.matchAll(digitAmountPattern)) {
    const raw = match[0]?.trim();
    if (!raw) continue;
    const amount = normalizeAmount(raw);
    if (!amount || amount <= 0) continue;
    const hasSuffix = Boolean(match[2]);
    const hasCurrency = Boolean(match[3]);
    if (amount < 100 && !hasSuffix && !hasCurrency) continue;
    const index = match.index ?? normalized.indexOf(raw);
    candidates.push({ amount, currency: extractCurrencyFromText(raw), raw, index, endIndex: index + raw.length });
  }

  return candidates
    .filter((candidate, index, all) => {
      return !all.some((other, otherIndex) => {
        if (index === otherIndex) return false;
        const inside = candidate.index >= other.index && candidate.endIndex <= other.endIndex;
        return inside && other.raw.length > candidate.raw.length;
      });
    })
    .filter((candidate, index, all) => all.findIndex((other) => other.index === candidate.index && other.amount === candidate.amount) === index)
    .sort((a, b) => a.index - b.index);
}

export function extractAmountFromText(text: string): number | null {
  return extractAmountCandidates(text)[0]?.amount ?? null;
}

export function stripAmountFromText(text: string) {
  let result = text;
  for (const candidate of [...extractAmountCandidates(text)].sort((a, b) => b.index - a.index)) {
    result = `${result.slice(0, candidate.index)} ${result.slice(candidate.endIndex)}`;
  }

  return result
    .replace(currencyCleaner, ' ')
    .replace(/[₽$€₫]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
