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
  к: 1_000,
  k: 1_000,
  миллион: 1_000_000,
  миллиона: 1_000_000,
  миллионов: 1_000_000,
  млн: 1_000_000,
};

const CURRENCY_WORDS = /₽|руб(?:лей|ля|ль)?|р\.?(?=\s|$)|доллар(?:ов|а)?|бакс(?:ов|а)?|usd|\$|евро|eur|€/gi;

function parseRussianNumberWords(raw: string): number | null {
  const normalized = raw
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(CURRENCY_WORDS, ' ')
    .replace(/\s+/g, ' ')
    .trim();

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
  const wordValue = parseRussianNumberWords(rawText);
  if (wordValue !== null) return Math.round(wordValue);

  const source = rawText
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/,/g, '.')
    .replace(CURRENCY_WORDS, '')
    .replace(/\s+/g, '');

  if (!source) return null;

  const slang: Record<string, number> = {
    чирик: 10_000,
    десятка: 10_000,
    двадцатка: 20_000,
    полтос: 50_000,
    сотка: 100_000,
    пятихатка: 500,
    косарь: 1000,
    штука: 1000,
    пятак: 5000,
    пятерка: 5000,
    пятерочка: 5000,
  };

  if (slang[source]) return slang[source];

  const millionMatch = source.match(/^(\d+(?:\.\d+)?)(кк|млн|миллион|миллиона|миллионов)$/i);
  if (millionMatch) return Math.round(Number(millionMatch[1]) * 1_000_000);

  const thousandMatch = source.match(/^(\d+(?:\.\d+)?)(к|k|тыс|тысяч|тысячи|тыща|тыщи|тыщ)$/i);
  if (thousandMatch) return Math.round(Number(thousandMatch[1]) * 1_000);

  const numberMatch = source.match(/^\d+(?:\.\d+)?$/);
  if (!numberMatch) return null;

  const value = Number(source);
  return Number.isFinite(value) ? Math.round(value) : null;
}

const digitAmountPattern = /(\d+(?:[.,]\d+)?\s*(?:кк|к|k|тыс|тысяч|тысячи|тыща|тыщи|тыщ|млн|миллион(?:а|ов)?)?|чирик|десятка|двадцатка|полтос|сотка|пятихатка|косарь|штука|пятак|пятерка|пятерочка)(?:\s*(?:₽|руб(?:лей|ля|ль)?|р\.?|доллар(?:ов|а)?|бакс(?:ов|а)?|usd|\$|евро|eur|€))?/gi;
const wordAmountPattern = /((?:один|одна|одно|два|две|три|четыре|пять|шесть|семь|восемь|девять|десять|одиннадцать|двенадцать|тринадцать|четырнадцать|пятнадцать|шестнадцать|семнадцать|восемнадцать|девятнадцать|двадцать|тридцать|сорок|пятьдесят|шестьдесят|семьдесят|восемьдесят|девяносто|сто|двести|триста|четыреста|пятьсот|шестьсот|семьсот|восемьсот|девятьсот)(?:\s+(?:один|одна|одно|два|две|три|четыре|пять|шесть|семь|восемь|девять|десять|одиннадцать|двенадцать|тринадцать|четырнадцать|пятнадцать|шестнадцать|семнадцать|восемнадцать|девятнадцать|двадцать|тридцать|сорок|пятьдесят|шестьдесят|семьдесят|восемьдесят|девяносто|сто|двести|триста|четыреста|пятьсот|шестьсот|семьсот|восемьсот|девятьсот))*\s+(?:тысяча|тысячи|тысяч|тыща|тыщи|тыщ|миллион|миллиона|миллионов|млн))(?:\s*(?:₽|руб(?:лей|ля|ль)?|р\.?|доллар(?:ов|а)?|бакс(?:ов|а)?|usd|\$|евро|eur|€))?/gi;

export function extractAmountFromText(text: string): number | null {
  const normalizedText = text.toLowerCase().replace(/ё/g, 'е');
  const wordMatches = Array.from(normalizedText.matchAll(wordAmountPattern));

  for (const match of wordMatches) {
    const amount = normalizeAmount(match[1]);
    if (amount !== null && amount > 0) return amount;
  }

  const digitMatches = Array.from(normalizedText.matchAll(digitAmountPattern));

  for (const match of digitMatches) {
    const amount = normalizeAmount(match[1]);
    if (amount !== null && amount > 0) return amount;
  }

  return null;
}

export function stripAmountFromText(text: string) {
  return text
    .replace(wordAmountPattern, ' ')
    .replace(digitAmountPattern, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
