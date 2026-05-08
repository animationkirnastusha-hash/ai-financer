const ONES: Record<string, number> = {
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
};

const TEENS: Record<string, number> = {
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
};

const TENS: Record<string, number> = {
  двадцать: 20,
  тридцать: 30,
  сорок: 40,
  пятьдесят: 50,
  шестьдесят: 60,
  семьдесят: 70,
  восемьдесят: 80,
  девяносто: 90,
};

const HUNDREDS: Record<string, number> = {
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

const SLANG: Record<string, number> = {
  чирик: 10_000,
  десятка: 10_000,
  десятку: 10_000,
  двадцатка: 20_000,
  двадцатку: 20_000,
  полтос: 50_000,
  сотка: 100_000,
  сотку: 100_000,
  пятихатка: 500,
  косарь: 1000,
  штука: 1000,
  штуку: 1000,
  пятак: 5000,
  пятерка: 5000,
  пятерку: 5000,
  пятерочка: 5000,
};

const MAGNITUDE_WORDS = new Set([
  'тыс',
  'тыща',
  'тыщи',
  'тыщ',
  'тысяча',
  'тысячи',
  'тысяч',
  'к',
  'k',
  'млн',
  'миллион',
  'миллиона',
  'миллионов',
]);

const CURRENCY_WORDS = new Set([
  '₽',
  'руб',
  'рубль',
  'рубля',
  'рублей',
  'р',
  'доллар',
  'доллара',
  'долларов',
  'бакс',
  'бакса',
  'баксов',
  'usd',
  '$',
  'евро',
  'eur',
  '€',
]);

function normalizeToken(token: string) {
  return token
    .toLowerCase()
    .replaceAll('ё', 'е')
    .replace(/[.,!?;:()«»"']/g, '')
    .trim();
}

function tokenValue(token: string) {
  return ONES[token] ?? TEENS[token] ?? TENS[token] ?? HUNDREDS[token] ?? null;
}

function parseNumberWords(tokens: string[], start: number) {
  let value = 0;
  let index = start;
  let matched = false;

  while (index < tokens.length) {
    const part = tokenValue(tokens[index]);
    if (part === null) break;
    value += part;
    matched = true;
    index += 1;
  }

  if (!matched) return null;

  const magnitude = tokens[index];
  if (magnitude && MAGNITUDE_WORDS.has(magnitude)) {
    const multiplier = magnitude === 'млн' || magnitude.startsWith('миллион') ? 1_000_000 : 1000;
    index += 1;
    return { value: value * multiplier, end: index };
  }

  return { value, end: index };
}

function parseDigitToken(tokens: string[], index: number) {
  const current = tokens[index];
  const glued = current.match(/^(\d+(?:[.,]\d+)?)(кк|к|k|тыс|млн)$/i);

  if (glued) {
    const num = Number(glued[1].replace(',', '.'));
    const suffix = glued[2].toLowerCase();
    const multiplier = suffix === 'кк' || suffix === 'млн' ? 1_000_000 : 1000;
    return { value: Math.round(num * multiplier), end: index + 1 };
  }

  if (!/^\d+(?:[.,]\d+)?$/.test(current)) return null;

  let value = Number(current.replace(',', '.'));
  let end = index + 1;
  const next = tokens[end];

  if (next && MAGNITUDE_WORDS.has(next)) {
    value *= next === 'млн' || next.startsWith('миллион') ? 1_000_000 : 1000;
    end += 1;
  }

  return { value: Math.round(value), end };
}

export function normalizeAmount(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) && value > 0 ? Math.round(value) : null;
  }

  if (typeof value !== 'string') return null;

  const source = value.trim().toLowerCase().replaceAll('ё', 'е');
  if (!source) return null;

  const clean = source.replace(/\s+/g, '');
  const compact = clean.replace(',', '.');

  if (SLANG[source]) return SLANG[source];

  const gluedMatch = compact.match(/^(\d+(?:\.\d+)?)(кк|к|k|тыс|тысяч|тысячи|млн|миллион|миллиона|миллионов)$/i);
  if (gluedMatch) {
    const multiplier = gluedMatch[2].startsWith('м') || gluedMatch[2].startsWith('мил') || gluedMatch[2] === 'кк' ? 1_000_000 : 1000;
    return Math.round(Number(gluedMatch[1]) * multiplier);
  }

  if (/^\d+(?:\.\d+)?$/.test(compact)) return Math.round(Number(compact));

  const tokens = source.split(/\s+/).map(normalizeToken).filter(Boolean);

  if (tokens.length === 1 && SLANG[tokens[0]]) return SLANG[tokens[0]];

  for (let index = 0; index < tokens.length; index += 1) {
    const digit = parseDigitToken(tokens, index);
    if (digit && digit.value > 0) return digit.value;

    const words = parseNumberWords(tokens, index);
    if (words && words.value > 0) return words.value;
  }

  return null;
}

export function extractAmountFromText(text: string): number | null {
  const tokens = text
    .toLowerCase()
    .replaceAll('ё', 'е')
    .split(/\s+/)
    .map(normalizeToken)
    .filter(Boolean);

  for (let index = 0; index < tokens.length; index += 1) {
    const slang = SLANG[tokens[index]];
    if (slang) return slang;

    const digit = parseDigitToken(tokens, index);
    if (digit && digit.value > 0) return digit.value;

    const words = parseNumberWords(tokens, index);
    if (words && words.value > 0) return words.value;
  }

  return null;
}

export function stripAmountFromText(text: string) {
  const tokens = text.split(/\s+/);
  const normalized = tokens.map(normalizeToken);
  const remove = new Set<number>();

  for (let index = 0; index < normalized.length; index += 1) {
    if (!normalized[index]) continue;

    if (SLANG[normalized[index]]) {
      remove.add(index);
      continue;
    }

    const digit = parseDigitToken(normalized, index);
    if (digit) {
      for (let i = index; i < digit.end; i += 1) remove.add(i);
      if (CURRENCY_WORDS.has(normalized[digit.end])) remove.add(digit.end);
      continue;
    }

    const words = parseNumberWords(normalized, index);
    if (words) {
      for (let i = index; i < words.end; i += 1) remove.add(i);
      if (CURRENCY_WORDS.has(normalized[words.end])) remove.add(words.end);
    }
  }

  return tokens
    .filter((_, index) => !remove.has(index))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}
