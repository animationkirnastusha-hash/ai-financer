export type CurrencyCode = 'RUB' | 'USD' | 'EUR' | 'VND';

const WORD_NUMBERS: Record<string, number> = {
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
  миллион: 1_000_000,
  миллиона: 1_000_000,
  миллионов: 1_000_000,
  млн: 1_000_000,
};

const CURRENCY_WORDS =
  '(?:₽|руб(?:ль|ля|лей)?|р\\.?|rub|rouble|ruble|\\$|usd|доллар(?:а|ов)?|бакс(?:а|ов)?|bucks?|€|eur|евро|₫|vnd|донг(?:а|ов)?|dong)';

const digitAmountPattern = new RegExp(
  `(\\d+(?:[\\s.,]\\d{3})*(?:[.,]\\d+)?|\\d+(?:[.,]\\d+)?)(?:\\s*(кк|к|k|тыс|тысяч|тысячи|млн|миллион(?:а|ов)?))?(?:\\s*${CURRENCY_WORDS})?`,
  'gi',
);

const slangAmountPattern =
  /(чирик|десятка|двадцатка|полтос|сотка|пятихатка|косарь|штука|пятак|пятерка|пятерочка)(?:\s*(?:₽|руб(?:лей|ля|ль)?|р\.?))?/gi;

const wordAmountPattern = /((?:один|одна|одно|два|две|три|четыре|пять|шесть|семь|восемь|девять|десять|одиннадцать|двенадцать|тринадцать|четырнадцать|пятнадцать|шестнадцать|семнадцать|восемнадцать|девятнадцать|двадцать|тридцать|сорок|пятьдесят|шестьдесят|семьдесят|восемьдесят|девяносто|сто|двести|триста|четыреста|пятьсот|шестьсот|семьсот|восемьсот|девятьсот)(?:\s+(?:один|одна|одно|два|две|три|четыре|пять|шесть|семь|восемь|девять|десять|одиннадцать|двенадцать|тринадцать|четырнадцать|пятнадцать|шестнадцать|семнадцать|восемнадцать|девятнадцать|двадцать|тридцать|сорок|пятьдесят|шестьдесят|семьдесят|восемьдесят|девяносто|сто|двести|триста|четыреста|пятьсот|шестьсот|семьсот|восемьсот|девятьсот))*\s+(?:тысяча|тысячи|тысяч|тыща|тыщи|тыщ|тыс|миллион|миллиона|миллионов|млн))(?:\s*(?:₽|руб(?:лей|ля|ль)?|р\.?|rub|usd|\$|доллар(?:а|ов)?|бакс(?:а|ов)?|eur|€|евро|vnd|₫|донг(?:а|ов)?))?/gi;

function normalizeText(value: string) {
  return value.toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ').trim();
}

function stripCurrencyWords(value: string) {
  return value
    .replace(new RegExp(CURRENCY_WORDS, 'gi'), ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseRussianNumberWords(raw: string): number | null {
  const normalized = stripCurrencyWords(normalizeText(raw));

  if (!normalized) return null;

  const tokens = normalized.split(' ');
  let total = 0;
  let current = 0;
  let matched = false;

  for (const token of tokens) {
    if (WORD_NUMBERS[token] !== undefined) {
      current += WORD_NUMBERS[token];
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
  return matched && value > 0 ? value : null;
}

export function normalizeAmount(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null;

  const rawText = String(raw).trim();
  if (!rawText) return null;

  const wordValue = parseRussianNumberWords(rawText);
  if (wordValue !== null) return Math.round(wordValue);

  const slang: Record<string, number> = {
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

  const lower = normalizeText(rawText);
  if (slang[lower]) return slang[lower];

  const cleaned = stripCurrencyWords(lower).replace(/\s/g, '').replace(',', '.');

  const millionMatch = cleaned.match(/^(\d+(?:\.\d+)?)(кк|млн|миллион|миллиона|миллионов)$/i);
  if (millionMatch) return Math.round(Number(millionMatch[1]) * 1_000_000);

  const thousandMatch = cleaned.match(/^(\d+(?:\.\d+)?)(к|k|тыс|тысяч|тысячи)$/i);
  if (thousandMatch) return Math.round(Number(thousandMatch[1]) * 1_000);

  const numericMatch = cleaned.match(/^(\d+(?:\.\d+)?)(?:к|k)$/i);
  if (numericMatch) return Math.round(Number(numericMatch[1]) * 1_000);

  if (!/^\d+(?:\.\d+)?$/.test(cleaned)) return null;

  const value = Number(cleaned);
  return Number.isFinite(value) ? Math.round(value) : null;
}

export type AmountCandidate = {
  raw: string;
  value: number;
  index: number;
  endIndex: number;
};

export function extractAmountCandidates(text: string): AmountCandidate[] {
  const source = normalizeText(text);
  const candidates: AmountCandidate[] = [];

  const collect = (pattern: RegExp) => {
    pattern.lastIndex = 0;

    for (const match of source.matchAll(pattern)) {
      const raw = match[0]?.trim();
      if (!raw) continue;

      const value = normalizeAmount(raw);
      if (!value || value <= 0) continue;

      const index = match.index ?? source.indexOf(raw);
      candidates.push({
        raw,
        value,
        index,
        endIndex: index + raw.length,
      });
    }
  };

  collect(wordAmountPattern);
  collect(slangAmountPattern);
  collect(digitAmountPattern);

  return candidates
    .filter((candidate, index, list) => {
      return !list.some((other, otherIndex) => {
        if (index === otherIndex) return false;
        const insideOther = candidate.index >= other.index && candidate.endIndex <= other.endIndex;
        const otherLonger = other.raw.length > candidate.raw.length;
        return insideOther && otherLonger;
      });
    })
    .sort((a, b) => a.index - b.index);
}

export function extractAmountFromText(text: string): number | null {
  const candidates = extractAmountCandidates(text);
  return candidates[0]?.value ?? null;
}

export function extractCurrencyFromText(
  text: string,
  fallback?: CurrencyCode,
): CurrencyCode | undefined {
  const source = normalizeText(text);

  if (/(?:\$|usd|доллар(?:а|ов)?|бакс(?:а|ов)?|bucks?)/i.test(source)) return 'USD';
  if (/(?:€|eur|евро)/i.test(source)) return 'EUR';
  if (/(?:₫|vnd|донг(?:а|ов)?|dong)/i.test(source)) return 'VND';
  if (/(?:₽|rub|руб(?:ль|ля|лей)?|р\.?)(?:\s|$)/i.test(source)) return 'RUB';

  return fallback;
}

export function stripAmountFromText(text: string) {
  let result = text;

  const candidates = extractAmountCandidates(text).sort((a, b) => b.index - a.index);

  for (const candidate of candidates) {
    result = `${result.slice(0, candidate.index)} ${result.slice(candidate.endIndex)}`;
  }

  return result
    .replace(new RegExp(CURRENCY_WORDS, 'gi'), ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
