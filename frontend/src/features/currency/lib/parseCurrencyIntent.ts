import type { AppCurrencyCode } from './currency';

type CurrencyIntent =
  | { type: 'set_main_currency'; currency: AppCurrencyCode }
  | { type: 'set_secondary_currency'; currency: AppCurrencyCode }
  | { type: 'none' };

function normalize(text: string) {
  return text.toLowerCase().replace(/[ё]/g, 'е').replace(/[^a-zа-я0-9\s$€₽]/gi, ' ').replace(/\s+/g, ' ').trim();
}

function detectCurrency(text: string): AppCurrencyCode | null {
  if (/ usd|доллар|бакс|\$/.test(text)) return 'USD';
  if (/ eur|евро|€/.test(text)) return 'EUR';
  if (/ rub|рубл|₽/.test(text)) return 'RUB';
  if (/ kzt|тенге/.test(text)) return 'KZT';
  if (/ uzs|сум/.test(text)) return 'UZS';
  if (/ kgs|сом/.test(text)) return 'KGS';
  if (/ amd|драм/.test(text)) return 'AMD';
  if (/ gel|лари/.test(text)) return 'GEL';
  if (/ azn|манат/.test(text)) return 'AZN';
  return null;
}

export function parseCurrencyIntent(rawText: string): CurrencyIntent {
  const text = normalize(rawText);
  const currency = detectCurrency(text);
  if (!currency) return { type: 'none' };
  const mentionsCurrency = /валют|доллар|евро|рубл|тенге|сум|сом|драм|лари|манат|usd|eur|rub|kzt|uzs|kgs|amd|gel|azn/.test(text);
  if (!mentionsCurrency) return { type: 'none' };
  if (/основн|главн|по умолчанию|сделай .* валют/.test(text)) return { type: 'set_main_currency', currency };
  if (/дополнительн|конвертац|показывай|пересчет|пересч[её]т/.test(text)) return { type: 'set_secondary_currency', currency };
  return { type: 'none' };
}
