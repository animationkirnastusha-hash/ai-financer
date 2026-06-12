import { AICurrency } from '../types';

export const SUPPORTED_CURRENCIES: AICurrency[] = ['RUB', 'USD', 'EUR', 'VND'];

const CURRENCY_RATES_TO_RUB: Record<AICurrency, number> = {
  RUB: 1,
  USD: 100,
  EUR: 110,
  VND: 0.004,
};

export function normalizeCurrency(value: unknown, fallback: AICurrency = 'RUB'): AICurrency {
  if (typeof value !== 'string') return fallback;
  const raw = value.trim().toLowerCase();
  const upper = raw.toUpperCase();

  if (SUPPORTED_CURRENCIES.includes(upper as AICurrency)) return upper as AICurrency;
  if (raw === '₽' || raw === 'руб' || raw === 'руб.' || raw === 'rur' || raw === 'rub' || raw === 'rouble' || raw === 'ruble') return 'RUB';
  if (raw === '$' || raw === 'usd' || raw === 'доллар' || raw === 'доллары' || raw === 'долларов' || raw === 'бакс' || raw === 'баксы' || raw === 'баксов' || raw === 'dollar') return 'USD';
  if (raw === '€' || raw === 'eur' || raw === 'евро' || raw === 'euro') return 'EUR';
  if (raw === 'vnd' || raw === 'донг' || raw === 'донги' || raw === 'донгов' || raw === 'dong' || raw === 'đ' || raw === '₫') return 'VND';

  return fallback;
}

export function detectCurrencyInText(text: unknown, fallback?: AICurrency): AICurrency | undefined {
  if (typeof text !== 'string' || !text.trim()) return fallback;
  const tokens = text
    .toLowerCase()
    .replace(/[.,;:!?()\[\]{}]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

  for (const token of tokens) {
    const normalized = normalizeCurrency(token, '__fallback__' as AICurrency);
    if (normalized !== ('__fallback__' as AICurrency)) return normalized;
  }

  return fallback;
}

/**
 * Accepts structured numeric contract values produced by the AI tool contract.
 * This function intentionally does not read the user's natural-language command text.
 * It only tolerates compact amount tokens inside already structured amount fields:
 *  - 20000
 *  - "20 000"
 *  - "20к" / "20 k" / "20 тыс"
 *  - "1.5к"
 */
export function normalizeMoneyAmount(value: unknown, _contextText?: string): number | null {
  if (typeof value === 'number') return toSafeInteger(value);
  if (typeof value !== 'string') return null;

  const normalized = normalizeStructuredAmountText(value);
  if (!normalized) return null;

  const suffixMatch = normalized.match(/^(\d{1,12}(?:[.,]\d{1,3})?)\s*(к|k|тыс|тыс\.|тысяч|тысячи|thousand|m|м|млн|млн\.|миллион|миллиона|миллионов|million)$/iu);
  if (suffixMatch) {
    const amount = Number(suffixMatch[1].replace(',', '.'));
    const suffix = suffixMatch[2].toLowerCase();
    const multiplier = suffix === 'm' || suffix === 'м' || suffix.startsWith('млн') || suffix.startsWith('миллион') || suffix === 'million'
      ? 1_000_000
      : 1_000;

    return toSafeInteger(amount * multiplier);
  }

  const plainAmount = normalizePlainAmountText(normalized);
  if (plainAmount === null) return null;

  return toSafeInteger(plainAmount);
}

export function convertMoney(amount: number, from: AICurrency, to: AICurrency) {
  if (from === to) return Math.round(amount);
  const amountInRub = amount * CURRENCY_RATES_TO_RUB[from];
  return Math.round(amountInRub / CURRENCY_RATES_TO_RUB[to]);
}


function normalizeStructuredAmountText(value: string) {
  const trimmed = value.trim().toLowerCase();

  const withoutTrailingCurrency = trimmed
    .replace(/(\d)\s*(₽|\$|€)\s*$/gu, '$1')
    .replace(/(\d)\s*(рублей|рубля|рубль|руб\.?|р\.?|rub|rur|долларов|доллара|доллар|usd|eur|евро|vnd|донгов|донга|донг)\s*$/giu, '$1');

  const raw = withoutTrailingCurrency
    .replace(/[₽$€]/g, ' ')
    .replace(/(^|[^\p{L}\p{N}_])(рублей|рубля|рубль|руб\.?|р\.?|rub|rur|долларов|доллара|доллар|usd|eur|евро|vnd|донгов|донга|донг)(?=$|[^\p{L}\p{N}_])/giu, '$1')
    .replace(/\s+/g, ' ')
    .trim();

  if (!raw) return '';

  return raw;
}

function normalizePlainAmountText(value: string) {
  const compact = value.trim();

  if (/^\d{1,3}(?:\s\d{3})+$/.test(compact)) {
    return Number(compact.replace(/\s/g, ''));
  }

  if (/^\d{1,3}(?:[,.]\d{3})+$/.test(compact)) {
    return Number(compact.replace(/[,.]/g, ''));
  }

  if (/^\d{1,15}$/.test(compact)) {
    return Number(compact);
  }

  if (/^\d{1,12}[,.]\d{1,2}$/.test(compact)) {
    return Number(compact.replace(',', '.'));
  }

  return null;
}

function toSafeInteger(value: number) {
  if (!Number.isFinite(value) || value <= 0) return null;
  const rounded = Math.round(value);
  if (!Number.isSafeInteger(rounded) || rounded <= 0) return null;
  return rounded;
}
