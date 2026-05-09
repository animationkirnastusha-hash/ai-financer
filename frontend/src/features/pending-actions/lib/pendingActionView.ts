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

function formatAmount(amount: number | undefined, currency = '₽') {
  if (typeof amount !== 'number') return undefined;
  return `${new Intl.NumberFormat('ru-RU', { maximumFractionDigits: amount % 1 === 0 ? 0 : 2 }).format(amount)} ${currency}`;
}

function currencySymbol(currency?: string) {
  const code = String(currency || '').toUpperCase();
  if (code === 'USD') return '$';
  if (code === 'EUR') return '€';
  if (code === 'VND') return '₫';
  return '₽';
}

function intentLabel(intent?: string, type?: string) {
  const normalized = (intent || type || '').toLowerCase();
  if (normalized.includes('batch')) return 'Пакет действий';
  if (normalized.includes('expense')) return 'Расход';
  if (normalized.includes('income')) return 'Доход';
  if (normalized.includes('transfer')) return 'Перевод';
  if (normalized.includes('account')) return 'Счёт';
  if (normalized.includes('section')) return 'Раздел';
  if (normalized.includes('categor')) return 'Категория';
  if (normalized.includes('delete')) return 'Удаление';
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
  if (value.includes('low')) return 'Безопасно';
  return 'Нужна проверка';
}

function compactRows(rows: Array<{ label: string; value?: string | number | null }>) {
  return rows
    .filter((row) => row.value !== undefined && row.value !== null && String(row.value).trim().length > 0)
    .map((row) => ({ label: row.label, value: String(row.value) }));
}

function getParsed(item: PendingActionItem) {
  return isRecord(item.parsed) ? item.parsed : isRecord(item.payload) ? item.payload : {};
}

function buildActionSummary(action: UnknownRecord, index: number) {
  const intent = String(action.intent || action.type || '').toLowerCase();
  const amount = readNumber(action, ['amount', 'balance']);
  const symbol = currencySymbol(readString(action, ['currency']));

  if (intent === 'create_account') {
    return `${index + 1}. Счёт: ${readString(action, ['name', 'accountName']) || 'Новый счёт'} · ${readString(action, ['currency']) || 'RUB'}`;
  }

  if (intent === 'income') {
    return `${index + 1}. Доход: ${formatAmount(amount, symbol) || 'сумма'}${readString(action, ['accountName']) ? ` · ${readString(action, ['accountName'])}` : ''}`;
  }

  if (intent === 'expense') {
    return `${index + 1}. Расход: ${formatAmount(amount, symbol) || 'сумма'} · ${readString(action, ['rawCategory', 'categoryName', 'description']) || 'категория'}`;
  }

  if (intent === 'transfer') {
    return `${index + 1}. Перевод: ${formatAmount(amount, symbol) || 'сумма'} → ${readString(action, ['toAccountName']) || 'счёт'}`;
  }

  return `${index + 1}. ${intent || 'действие'}`;
}

export function getPendingActionView(item: PendingActionItem): PendingActionView {
  const parsed = getParsed(item);
  const intent = String(parsed.intent || parsed.type || item.intent || item.type || '');

  if (intent === 'batch' && Array.isArray(parsed.actions)) {
    const actions = parsed.actions.filter(isRecord);
    return {
      title: `Проверь ${actions.length} действия`,
      subtitle: item.command || 'Проверь действия перед выполнением',
      intentLabel: 'Пакет действий',
      riskLabel: riskLabel(item.riskLevel),
      riskTone: riskTone(item.riskLevel),
      rows: actions.map((action, index) => ({ label: `${index + 1}`, value: buildActionSummary(action, index) })),
      explanation: 'Проверь детали. Можно исправить название, сумму, валюту или счёт перед подтверждением.',
      rawPayload: parsed,
    };
  }

  const currency = readString(parsed, ['currency', 'currencyCode']) || 'RUB';
  const symbol = currencySymbol(currency);
  const amount = readNumber(parsed, ['amount', 'value', 'sum', 'balance']);
  const amountLabel = formatAmount(amount, symbol);
  const description = readString(parsed, ['description', 'merchant', 'title', 'name']);
  const category = readString(parsed, ['categoryName', 'rawCategory', 'category', 'categoryTitle']);
  const section = readString(parsed, ['sectionName', 'section', 'sectionTitle']);
  const account = readString(parsed, ['accountName', 'account', 'fromAccountName']);
  const toAccount = readString(parsed, ['toAccountName', 'targetAccountName']);

  const rows = compactRows([
    { label: 'Сумма', value: amountLabel },
    { label: 'Описание', value: description },
    { label: 'Раздел', value: section },
    { label: 'Категория', value: category },
    { label: 'Счёт', value: account },
    { label: 'Куда', value: toAccount },
    { label: 'Валюта', value: currency },
  ]);

  return {
    title: item.summary || description || item.command || `${intentLabel(item.intent, item.type)} ожидает подтверждения`,
    subtitle: item.command || 'Проверь действие перед выполнением',
    intentLabel: intentLabel(item.intent, item.type),
    riskLabel: riskLabel(item.riskLevel),
    riskTone: riskTone(item.riskLevel),
    amountLabel,
    currency,
    rows,
    explanation: 'Проверь детали. Если AI ошибся — исправь поля перед подтверждением.',
    rawPayload: parsed,
  };
}

export function getPreviewFromMessageData(params: { title: string; intent?: string; data?: Record<string, unknown> }) {
  const fakeAction: PendingActionItem = { id: 'preview', summary: params.title, intent: params.intent, parsed: params.data };
  return getPendingActionView(fakeAction);
}
