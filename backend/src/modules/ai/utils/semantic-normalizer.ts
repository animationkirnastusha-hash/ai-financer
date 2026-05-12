import { AIAccountType, AICurrency } from '../types';
import { detectCurrencyInText, normalizeCurrency, normalizeMoneyAmount } from './amount-normalizer';

const ACCOUNT_TYPES: AIAccountType[] = ['cash', 'card', 'savings', 'investment'];
const CURRENCIES: AICurrency[] = ['RUB', 'USD', 'EUR', 'VND'];

export function asCleanString(value: unknown) {
  return typeof value === 'string'
    ? value.trim().replace(/[«»"]/g, '').replace(/\s+/g, ' ')
    : '';
}

export function normalizeAccountType(value: unknown, contextText = ''): AIAccountType {
  const raw = `${typeof value === 'string' ? value : ''} ${contextText}`.toLowerCase();

  if (/инвест|investment|broker|акци|облигац/.test(raw)) return 'investment';
  if (/накоп|сберег|копил|savings|save/.test(raw)) return 'savings';
  if (/карт|card|bank|банк|безнал|безналич|debit|credit/.test(raw)) return 'card';
  if (/налич|cash|кэш|кошел/.test(raw)) return 'cash';

  return 'cash';
}

export function normalizeAccountCurrency(value: unknown, contextText = '', fallback: AICurrency = 'RUB'): AICurrency {
  const explicit = normalizeKnownCurrency(value);
  if (explicit) return explicit;

  return detectCurrencyInText(contextText, fallback) ?? fallback;
}

export function normalizeActionCurrency(value: unknown, contextText = '', fallback: AICurrency = 'RUB'): AICurrency {
  const raw = typeof value === 'string' ? value : '';
  return detectCurrencyInText(`${raw} ${contextText}`, fallback) ?? fallback;
}

export function normalizeAmount(value: unknown, contextText = '') {
  return normalizeMoneyAmount(value, contextText);
}

export function cleanAccountName(value: unknown, commandText = '', fallback = '') {
  const original = asCleanString(value) || fallback;
  const command = asCleanString(commandText);

  const markerName = extractNameByMarkers(command);
  const preferred = markerName || original;

  return cleanupName(preferred) || cleanupName(original) || fallback;
}

export function cleanEntityName(value: unknown, commandText = '', fallback = '') {
  return cleanupName(asCleanString(value) || extractNameByMarkers(commandText) || fallback);
}

export function buildActionText(input: Record<string, unknown>, commandText: string) {
  return [
    commandText,
    input.rawText,
    input.raw,
    input.text,
    input.description,
    input.name,
    input.account,
    input.currency,
    input.amount,
    input.rawAmountText,
  ].filter((item) => item !== null && item !== undefined).join(' ');
}

export function normalizeKnownCurrency(value: unknown): AICurrency | null {
  const raw = typeof value === 'string' ? value.trim().toUpperCase() : '';
  return CURRENCIES.includes(raw as AICurrency) ? raw as AICurrency : null;
}

export function normalizeKnownAccountType(value: unknown): AIAccountType | null {
  const raw = typeof value === 'string' ? value.trim() : '';
  return ACCOUNT_TYPES.includes(raw as AIAccountType) ? raw as AIAccountType : null;
}

function extractNameByMarkers(commandText: string) {
  const text = asCleanString(commandText);
  if (!text) return '';

  const patterns = [
    /(?:с\s+названием|назови\s+(?:его|её|сч[её]т)?|название|called|named|with\s+name)\s+([^,.;]+)/i,
    /(?:name\s+it)\s+([^,.;]+)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return match[1];
  }

  return '';
}

function cleanupName(value: string) {
  let name = asCleanString(value);

  name = name
    .replace(/\b(create|account|wallet|card|called|named|with name)\b/gi, ' ')
    .replace(/\b(создай|создать|сделай|открой|сч[её]т|кошел[её]к|карту|карта|наличку|наличка|назови|название|с названием)\b/gi, ' ')
    .replace(/\b(и|and|then|следом|потом)\b.*$/i, ' ')
    .replace(/\b(положи|добавь|закинь|пополни|присвой|депозит|доход|расход|deposit|top ?up|add|put)\b.*$/i, ' ')
    .replace(/\b(руб(?:лей|ля|ль)?|доллар(?:ов|а|ы)?|евро|донг(?:ов)?|rub|usd|eur|vnd|ruble|dollar|dong)\b/gi, ' ')
    .replace(/\b\d+(?:[.,]\d+)?\s*(?:к|k|тыс\.?|тысяч|млн|million)?\b/gi, ' ')
    .replace(/[,:;.]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return name;
}
