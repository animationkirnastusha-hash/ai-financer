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
  actionCount: number;
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
  if (normalized.includes('update_transaction') || normalized.includes('transaction')) return 'Операция';
  if (normalized.includes('transfer')) return 'Перевод';
  if (normalized.includes('goal')) return 'Цель';
  if (normalized.includes('primary')) return 'Основной счёт';
  if (normalized.includes('account')) return 'Счёт';
  if (normalized.includes('section')) return 'Раздел';
  if (normalized.includes('categor')) return 'Категория';
  if (normalized.includes('delete')) return 'Удаление';
  if (normalized.includes('batch')) return 'Действие';
  return 'Действие';
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

function firstAction(parsed: UnknownRecord | undefined) {
  const actions = Array.isArray(parsed?.actions) ? parsed.actions : [];
  const first = actions.find(isRecord);
  if (!first) return parsed;
  const input = pickRecord(first.input);
  return { ...first, ...(input ?? {}) };
}

function getActionCount(parsed: UnknownRecord | undefined) {
  if (!Array.isArray(parsed?.actions)) return 1;
  return parsed.actions.filter(isRecord).length || 1;
}

function getBatchRows(parsed: UnknownRecord | undefined) {
  const actions = Array.isArray(parsed?.actions) ? parsed.actions : [];
  return actions
    .map((action, index) => {
      if (!isRecord(action)) return null;
      const input = pickRecord(action.input) ?? action;
      const intent = readString(action, ['tool', 'intent']) || readString(input, ['intent', 'kind']) || 'action';
      const name = readString(input, ['name', 'accountName', 'description', 'category', 'rawCategory']);
      const amount = readNumber(input, ['amount', 'balance', 'initialBalance']);
      const currency = readString(input, ['currency']) || 'RUB';
      const label = intentLabel(intent, readString(input, ['kind']));
      const value = [name, formatAmount(amount, currency)].filter(Boolean).join(' · ');
      return { label: `${index + 1}. ${label}`, value: value || label };
    })
    .filter((item): item is { label: string; value: string } => Boolean(item));
}

function resolveParsed(item: PendingActionItem) {
  const root = pickRecord(item.parsed, item.payload) ?? {};
  const payload = pickRecord(root.parsed, root.data, root.transaction, root) ?? root;
  return payload;
}

export function getPendingActionView(item: PendingActionItem): PendingActionView {
  const parsed = resolveParsed(item);
  const action = firstAction(parsed) ?? parsed;
  const actionCount = getActionCount(parsed);
  const isBatch = item.intent === 'batch' || Array.isArray(parsed?.actions);
  const actionTool = readString(action, ['tool', 'intent']) || readString(action, ['kind']) || item.intent || item.type;
  const currency = readString(action, ['currency', 'currencyCode']) || 'RUB';
  const amount = readNumber(action, ['amount', 'value', 'sum', 'balance', 'initialBalance', 'targetAmount', 'currentAmount']);
  const amountLabel = formatAmount(amount, currency);
  const description = readString(action, ['description', 'merchant', 'title', 'name', 'goal']);
  const category = readString(action, ['categoryName', 'category', 'rawCategory', 'categoryTitle']);
  const section = readString(action, ['sectionName', 'section', 'sectionTitle']);
  const kind = readString(action, ['kind', 'type']);
  const account = readString(action, ['accountName', 'account', 'fromAccountName']);
  const toAccount = readString(action, ['toAccountName', 'targetAccountName', 'toAccount']);

  const rows = isBatch && actionCount > 1
    ? getBatchRows(parsed)
    : compactRows([
        { label: 'Тип', value: intentLabel(actionTool, kind) },
        { label: 'Сумма', value: amountLabel },
        { label: 'Счёт', value: account },
        { label: 'Куда', value: toAccount },
        { label: 'Категория', value: category },
        { label: 'Раздел', value: section },
        { label: 'Цель', value: actionTool?.includes('goal') ? description : undefined },
        { label: 'Описание', value: description && description !== category && !actionTool?.includes('goal') ? description : undefined },
      ]);

  const label = intentLabel(actionTool, kind);
  const title = amountLabel
    ? label
    : isBatch && actionCount > 1
      ? `Проверь ${actionCount} действия`
      : item.summary || description || label;

  return {
    title,
    subtitle: item.command || 'Проверь перед сохранением',
    intentLabel: label,
    riskLabel: riskLabel(item.riskLevel),
    riskTone: riskTone(item.riskLevel),
    amountLabel,
    currency,
    rows,
    explanation: 'AI подготовил действие. Проверь сумму, счёт и категорию.',
    actionCount,
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
