export type CurrencyCode = 'RUB' | 'USD' | 'EUR' | 'VND';

export type AmountCandidate = {
  amount: number;
  currency?: CurrencyCode;
  raw: string;
  index: number;
};

const WORD_NUMBERS_RU: Record<string, number> = {
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

const WORD_NUMBERS_EN: Record<string, number> = {
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

const WORD_NUMBERS_VI: Record<string, number> = {
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
  hai_mươi: 20,
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

const currencyWords: Array<[CurrencyCode, RegExp]> = [
  ['USD', /(?:\$|usd|usdt|доллар(?:а|ов)?|бакс(?:а|ов)?|bucks?|dollars?)/i],
  ['EUR', /(?:€|eur|евро|euro?s?)/i],
  ['VND', /(?:vnd|₫|донг(?:ов)?|dong|đồng)/i],
  ['RUB', /(?:₽|rub|руб(?:ль|ля|лей)?|р\.?\b|рубли|рублей)/i],
];

const numberWords = new Set([
  ...Object.keys(WORD_NUMBERS_RU),
  ...Object.keys(WORD_NUMBERS_EN),
  ...Object.keys(WORD_NUMBERS_VI).map((item) => item.replace('_', ' ')),
  ...Object.keys(MULTIPLIERS),
]);

function normalizeText(value: string) {
  return value.toLowerCase().replace(/ё/g, 'е').replace(/,/g, '.').replace(/\s+/g, ' ').trim();
}

export function detectCurrency(input: unknown, fallback: CurrencyCode = 'RUB'): CurrencyCode {
  const text = normalizeText(String(input ?? ''));
  for (const [currency, pattern] of currencyWords) {
    if (pattern.test(text)) return currency;
  }
  return fallback;
}

function tokenValue(token: string): number | undefined {
  const normalized = token.toLowerCase();
  return WORD_NUMBERS_RU[normalized] ?? WORD_NUMBERS_EN[normalized] ?? WORD_NUMBERS_VI[normalized];
}

function parseWordAmount(raw: string): number | null {
  const source = normalizeText(raw)
    .replace(/[₽$€₫]/g, ' ')
    .replace(/\b(?:rub|руб(?:ль|ля|лей)?|usd|доллар(?:а|ов)?|бакс(?:а|ов)?|eur|евро|vnd|донг(?:ов)?|dong|đồng)\b/g, ' ')
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
    .replace(/\b(?:rub|руб(?:ль|ля|лей)?|usd|доллар(?:а|ов)?|бакс(?:а|ов)?|eur|евро|vnd|донг(?:ов)?|dong|đồng)\b/g, '')
    .replace(/\s+/g, '');

  if (!source) return null;
  if (SLANG[source]) return SLANG[source];

  const multiplied = source.match(/^(\d+(?:\.\d+)?)(кк|kk|млн|million|millions|миллион|миллиона|миллионов|trieu|triệu|к|k|тыс|тысяч|тысячи|thousand|thousands|nghin|nghìn|ngan|ngàn)$/i);
  if (multiplied) {
    const number = Number(multiplied[1]);
    const suffix = multiplied[2].toLowerCase();
    const multiplier = /^(кк|kk|млн|million|millions|миллион|миллиона|миллионов|trieu|triệu)$/.test(suffix)
      ? 1_000_000
      : 1_000;
    return Math.round(number * multiplier);
  }

  if (/^\d+(?:\.\d+)?$/.test(source)) {
    const value = Number(source);
    return Number.isFinite(value) ? Math.round(value) : null;
  }

  return null;
}

const digitAmountPattern = /(\d+(?:[.,]\d+)?\s*(?:кк|kk|к|k|тыс\.?|тысяч|тысячи|млн|миллион(?:а|ов)?|thousand|thousands|million|millions|nghin|nghìn|ngan|ngàn|trieu|triệu)?\s*(?:₽|руб(?:ль|ля|лей)?|р\.?|rub|\$|usd|доллар(?:а|ов)?|бакс(?:а|ов)?|€|eur|евро|vnd|₫|донг(?:ов)?|dong|đồng)?)/gi;
const wordAmountPattern = new RegExp(
  `((?:${Array.from(numberWords).sort((a, b) => b.length - a.length).join('|')})(?:\\s+(?:${Array.from(numberWords).sort((a, b) => b.length - a.length).join('|')}))*)\\s*(?:₽|руб(?:ль|ля|лей)?|р\\.?|rub|\\$|usd|доллар(?:а|ов)?|бакс(?:а|ов)?|€|eur|евро|vnd|₫|донг(?:ов)?|dong|đồng)?`,
  'gi',
);

function hasMultiplier(raw: string) {
  return /(?:кк|kk|к|k|тыс\.?|тысяч|тысячи|млн|миллион|thousand|million|nghin|nghìn|ngan|ngàn|trieu|triệu)/i.test(raw);
}

export function extractAmountCandidates(text: string): AmountCandidate[] {
  const normalized = normalizeText(text);
  const candidates: AmountCandidate[] = [];

  for (const match of normalized.matchAll(digitAmountPattern)) {
    const raw = match[1]?.trim();
    if (!raw) continue;

    const amount = normalizeAmount(raw);
    if (!amount || amount <= 0) continue;

    // Avoid treating plain years or account numbers as money unless money words are present.
    if (amount < 100 && !hasMultiplier(raw) && !detectCurrency(raw, 'RUB')) {
      // keep small values only when the phrase has an explicit currency sign/word
      if (!/[₽$€₫]|руб|usd|доллар|eur|евро|vnd|донг/i.test(raw)) continue;
    }

    candidates.push({
      amount,
      currency: detectCurrency(raw, undefined as unknown as CurrencyCode),
      raw,
      index: match.index ?? 0,
    });
  }

  for (const match of normalized.matchAll(wordAmountPattern)) {
    const raw = match[1]?.trim();
    if (!raw || raw.length < 3) continue;
    if (!hasMultiplier(raw) && !SLANG[raw]) continue;

    const amount = normalizeAmount(raw);
    if (!amount || amount <= 0) continue;

    candidates.push({
      amount,
      currency: detectCurrency(match[0], undefined as unknown as CurrencyCode),
      raw: match[0].trim(),
      index: match.index ?? 0,
    });
  }

  return candidates
    .filter((candidate, index, all) => {
      return all.findIndex((other) => other.index === candidate.index && other.amount === candidate.amount) === index;
    })
    .sort((a, b) => a.index - b.index);
}

export function extractAmountFromText(text: string): number | null {
  return extractAmountCandidates(text)[0]?.amount ?? null;
}

export function extractCurrencyFromText(text: string, fallback: CurrencyCode = 'RUB'): CurrencyCode {
  return detectCurrency(text, fallback);
}

export function stripAmountFromText(text: string) {
  let result = text;
  for (const candidate of [...extractAmountCandidates(text)].sort((a, b) => b.index - a.index)) {
    result = result.slice(0, candidate.index) + ' ' + result.slice(candidate.index + candidate.raw.length);
  }

  return result
    .replace(/\b(?:руб(?:ль|ля|лей)?|доллар(?:а|ов)?|бакс(?:а|ов)?|евро|донг(?:ов)?|usd|eur|rub|vnd)\b/gi, ' ')
    .replace(/[₽$€₫]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
