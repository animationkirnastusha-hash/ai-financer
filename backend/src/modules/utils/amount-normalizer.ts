export function normalizeAmount(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null;

  const source = String(raw)
    .trim()
    .toLowerCase()
    .replace(/,/g, '.')
    .replace(/₽|руб(?:лей|ля|ль)?|р\.?/g, '')
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
    пятерка: 5000,
    пятёрка: 5000,
  };

  if (slang[source]) return slang[source];

  const kkMatch = source.match(/^(\d+(?:\.\d+)?)кк$/i);
  if (kkMatch) return Math.round(Number(kkMatch[1]) * 1_000_000);

  const kMatch = source.match(/^(\d+(?:\.\d+)?)к$/i);
  if (kMatch) return Math.round(Number(kMatch[1]) * 1_000);

  const numberMatch = source.match(/\d+(?:\.\d+)?/);
  if (!numberMatch) return null;

  const value = Number(numberMatch[0]);
  return Number.isFinite(value) ? Math.round(value) : null;
}

export function extractAmountFromText(text: string): number | null {
  const tokens = text.split(/[\s,.;:!?]+/).filter(Boolean);

  for (const token of tokens) {
    const amount = normalizeAmount(token);
    if (amount !== null && amount > 0) return amount;
  }

  return null;
}
