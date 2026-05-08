import type { PendingActionItem } from '@/features/pending-actions/model/pendingActions.types';

type UnknownRecord = Record<string, unknown>;

export type PendingActionView = {
  title: string;
  subtitle: string;
  intentLabel: string;
  riskLabel: string;
  riskTone: 'safe' | 'medium' | 'high';
  amountLabel?: string;
  currency?: string;
  rows: Array<{ label: string; value: string }>;
  explanation: string;
  rawPayload?: UnknownRecord;
};

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function pickRecord(...values: unknown[]): UnknownRecord | undefined {
  for (const value of values) {
    if (isRecord(value)) return value;
  }
  return undefined;
}

function readString(record: UnknownRecord | undefined, keys: string[]): string | undefined {
  if (!record) return undefined;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return undefined;
}

function readNumber(record: UnknownRecord | undefined, keys: string[]): number | undefined {
  if (!record) return undefined;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
      const normalized = Number(value.replace(/\s/g, '').replace(',', '.'));
      if (Number.isFinite(normalized)) return normalized;
    }
  }
  return undefined;
}

function currencySymbol(currency = 'RUB') {
  if (currency === 'RUB' || currency === '₽') return '₽';
  if (currency === 'USD' || currency === '$') return '$';
  if (currency === 'EUR' || currency === '€') return '€';
  return currency;
}

function formatAmount(amount: number | undefined, currency = 'RUB') {
  if (typeof amount !== 'number') return undefined;
  const formatted = new Intl.NumberFormat('ru-RU', {
    maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
  }).format(amount);
  const symbol = currencySymbol(currency);
  return symbol === '$' || symbol === '€' ? `${symbol}${formatted}` : `${formatted} ${symbol}`;
}

function intentLabel(intent?: string, type?: string) {
  const normalized = (intent || type || '').toLowerCase();
  if (normalized.includes('expense')) return 'Расход';
  if (normalized.includes('income')) return 'Доход';
  if (normalized.includes('transfer')) return 'Перевод';
  if (normalized.includes('account')) return 'Счёт';
  if (normalized.includes('section')) return 'Раздел';
  if (normalized.includes('categor')) return 'Категория';
  if (normalized.includes('delete')) return 'Удаление';
  if (normalized.includes('batch')) return 'Пакет действий';
  return 'AI-действие';
}

function riskTone(risk?: string): PendingActionView['riskTone'] {
  const value = (risk || '').toLowerCase();
  if (value.includes('high') || value.includes('critical')) return 'high';
  if (value.includes('medium')) return 'medium';
  return 'safe';
}

function riskLabel(risk?: string) {
  const value = (risk || '').toLowerCase();
  if (value.includes('high') || value.includes('critical')) return 'Высокий риск';
  if (value.includes('medium')) return 'Нужна проверка';
  return 'Безопасно';
}

function compactRows(rows: Array<{ label: string; value?: string | number | null }>) {
  return rows
    .filter((row) => row.value !== undefined && row.value !== null && String(row.value).trim().length > 0)
    .map((row) => ({ label: row.label, value: String(row.value) }));
}

function getBatchRows(parsed: UnknownRecord | undefined) {
  const actions = Array.isArray(parsed?.actions) ? parsed.actions : [];
  return actions
    .map((action, index) => {
      if (!isRecord(action)) return null;
      const intent = readString(action, ['intent']) || 'action';
      const name = readString(action, ['name', 'accountName', 'description', 'rawCategory']);
      const amount = readNumber(action, ['amount', 'balance']);
      const currency = readString(action, ['currency']) || 'RUB';
      const label = intentLabel(intent);
      const value = [name, formatAmount(amount, currency)].filter(Boolean).join(' · ');
      return { label: `${index + 1}. ${label}`, value: value || label };
    })
    .filter((item): item is { label: string; value: string } => Boolean(item));
}

export function getPendingActionView(item: PendingActionItem): PendingActionView {
  const payload = pickRecord(item.payload, item.parsed);
  const parsed = pickRecord(payload?.parsed, payload?.data, payload?.transaction, payload) || payload;
  const isBatch = item.intent === 'batch' || Array.isArray(parsed?.actions);
  const currency = readString(parsed, ['currency', 'currencyCode']) || 'RUB';
  const amount = readNumber(parsed, ['amount', 'value', 'sum', 'balance']);
  const amountLabel = formatAmount(amount, currency);
  const description = readString(parsed, ['description', 'merchant', 'title', 'name']);
  const category = readString(parsed, ['categoryName', 'category', 'rawCategory', 'categoryTitle']);
  const section = readString(parsed, ['sectionName', 'section', 'sectionTitle']);
  const account = readString(parsed, ['accountName', 'account', 'fromAccountName', 'name']);
  const toAccount = readString(parsed, ['toAccountName', 'targetAccountName']);

  const rows = isBatch
    ? getBatchRows(parsed)
    : compactRows([
        { label: 'Сумма', value: amountLabel },
        { label: 'Название', value: description },
        { label: 'Раздел', value: section },
        { label: 'Категория', value: category },
        { label: 'Счёт', value: account },
        { label: 'Куда', value: toAccount },
      ]);

  const title = item.summary || description || item.command || `${intentLabel(item.intent, item.type)} ожидает подтверждения`;

  return {
    title,
    subtitle: item.command || 'Проверь действие перед выполнением',
    intentLabel: isBatch ? 'Пакет действий' : intentLabel(item.intent, item.type),
    riskLabel: riskLabel(item.riskLevel),
    riskTone: riskTone(item.riskLevel),
    amountLabel,
    currency,
    rows,
    explanation: 'Проверь детали. После подтверждения AI выполнит действие, а ты сможешь исправить его в истории.',
    rawPayload: payload,
  };
}

export function getPreviewFromMessageData(params: {
  title: string;
  intent?: string;
  data?: Record<string, unknown>;
}) {
  const fakeAction: PendingActionItem = {
    id: 'preview',
    summary: params.title,
    intent: params.intent,
    parsed: params.data,
  };

  return getPendingActionView(fakeAction);
}
