export function normalizeAmount(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null;

  const source = String(raw)
    .trim()
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/,/g, '.')
    .replace(/₽|руб(?:лей|ля|ль)?|р\.?(?=\s|$)/g, '')
    .replace(/\s+/g, '');

  if (!source) return null;

  const slang: Record<string, number> = {
    чирик: 10,
    десятка: 10,
    двадцатка: 20,
    полтос: 50,
    сотка: 100,
    пятихатка: 500,
    косарь: 1000,
    штука: 1000,
    пятак: 500,
    пятерка: 5000,
    пятерочка: 5000,
  };

  if (slang[source]) return slang[source];

  const millionMatch = source.match(/^(\d+(?:\.\d+)?)(кк|млн|миллион|миллиона|миллионов)$/i);
  if (millionMatch) return Math.round(Number(millionMatch[1]) * 1_000_000);

  const thousandMatch = source.match(/^(\d+(?:\.\d+)?)(к|k|тыс|тысяч|тысячи)$/i);
  if (thousandMatch) return Math.round(Number(thousandMatch[1]) * 1_000);

  const numberMatch = source.match(/^\d+(?:\.\d+)?$/);
  if (!numberMatch) return null;

  const value = Number(source);
  return Number.isFinite(value) ? Math.round(value) : null;
}

export function extractAmountFromText(text: string): number | null {
  const amountPattern = /(\d+(?:[.,]\d+)?\s*(?:кк|к|k|тыс|тысяч|тысячи|млн|миллион(?:а|ов)?)?|чирик|десятка|двадцатка|полтос|сотка|пятихатка|косарь|штука|пятак|пятерка|пятерочка)(?:\s*(?:₽|руб(?:лей|ля|ль)?|р\.?)?)?/gi;
  const matches = Array.from(text.toLowerCase().replace(/ё/g, 'е').matchAll(amountPattern));

  for (const match of matches) {
    const amount = normalizeAmount(match[1]);
    if (amount !== null && amount > 0) return amount;
  }

  return null;
}

export function stripAmountFromText(text: string) {
  return text
    .replace(/(\d+(?:[.,]\d+)?\s*(?:кк|к|k|тыс|тысяч|тысячи|млн|миллион(?:а|ов)?)?|чирик|десятка|двадцатка|полтос|сотка|пятихатка|косарь|штука|пятак|пятерка|пятерочка)(?:\s*(?:₽|руб(?:лей|ля|ль)?|р\.?)?)?/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
