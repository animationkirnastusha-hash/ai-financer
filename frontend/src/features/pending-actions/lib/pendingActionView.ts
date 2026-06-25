import type { PendingActionItem } from '@/features/pending-actions/model/pendingActions.types';

type UnknownRecord = Record<string, unknown>;

export type PendingActionLanguage = 'ru' | 'en';

type Labels = {
  intent: Record<string, string>;
  risk: { safe: string; medium: string; high: string };
  rows: Record<string, string>;
  fallback: { action: string; details: string; checkCount: string; explanation: string };
};

const LABELS: Record<PendingActionLanguage, Labels> = {
  ru: {
    intent: { expense: 'Расход', income: 'Доход', transaction: 'Операция', transfer: 'Перевод', goal: 'Цель', primary: 'Основной счёт', account: 'Счёт', section: 'Категория', category: 'Категория', delete: 'Удаление', batch: 'Действие', action: 'Действие' },
    risk: { safe: 'Безопасно', medium: 'Нужна проверка', high: 'Высокий риск' },
    rows: { type: 'Тип', amount: 'Сумма', account: 'Счёт', to: 'Куда', category: 'Категория', section: 'Категория', goal: 'Цель', description: 'Описание' },
    fallback: { action: 'Действие', details: 'Проверь детали', checkCount: 'Проверь {count} действия', explanation: 'Проверь сумму, счёт и категорию.' },
  },
  en: {
    intent: { expense: 'Expense', income: 'Income', transaction: 'Transaction', transfer: 'Transfer', goal: 'Goal', primary: 'Primary account', account: 'Account', section: 'Section', category: 'Category', delete: 'Delete', batch: 'Action', action: 'Action' },
    risk: { safe: 'Safe', medium: 'Review needed', high: 'High risk' },
    rows: { type: 'Type', amount: 'Amount', account: 'Account', to: 'To', category: 'Category', section: 'Section', goal: 'Goal', description: 'Description' },
    fallback: { action: 'Action', details: 'Review details', checkCount: 'Review {count} actions', explanation: 'Check the amount, account and category.' },
  },
};

function labels(language: PendingActionLanguage = 'ru') {
  return LABELS[language] ?? LABELS.ru;
}

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

function formatAmount(amount: number | undefined, currency = 'RUB', language: PendingActionLanguage = 'ru') {
  if (typeof amount !== 'number') return undefined;
  const formatted = new Intl.NumberFormat(language === 'en' ? 'en-US' : 'ru-RU', {
    maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
  }).format(amount);
  const symbol = currencySymbol(currency);
  return symbol === '$' || symbol === '€' ? `${symbol}${formatted}` : `${formatted} ${symbol}`;
}

function intentLabel(intent?: string, type?: string, language: PendingActionLanguage = 'ru') {
  const l = labels(language);
  const normalized = (intent || type || '').toLowerCase();
  if (normalized.includes('expense')) return l.intent.expense;
  if (normalized.includes('income')) return l.intent.income;
  if (normalized.includes('update_transaction') || normalized.includes('transaction')) return l.intent.transaction;
  if (normalized.includes('transfer')) return l.intent.transfer;
  if (normalized.includes('goal')) return l.intent.goal;
  if (normalized.includes('primary')) return l.intent.primary;
  if (normalized.includes('account')) return l.intent.account;
  if (normalized.includes('section')) return l.intent.section;
  if (normalized.includes('categor')) return l.intent.category;
  if (normalized.includes('delete')) return l.intent.delete;
  if (normalized.includes('batch')) return l.intent.batch;
  return l.intent.action;
}

function riskTone(risk?: string): PendingActionView['riskTone'] {
  const value = (risk || '').toLowerCase();
  if (value.includes('high') || value.includes('critical')) return 'high';
  if (value.includes('medium')) return 'medium';
  return 'safe';
}

function riskLabel(risk?: string, language: PendingActionLanguage = 'ru') {
  const l = labels(language);
  const value = (risk || '').toLowerCase();
  if (value.includes('high') || value.includes('critical')) return l.risk.high;
  if (value.includes('medium')) return l.risk.medium;
  return l.risk.safe;
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

function getBatchRows(parsed: UnknownRecord | undefined, language: PendingActionLanguage = 'ru') {
  const actions = Array.isArray(parsed?.actions) ? parsed.actions : [];
  return actions
    .map((action, index) => {
      if (!isRecord(action)) return null;
      const input = pickRecord(action.input) ?? action;
      const intent = readString(action, ['tool', 'intent']) || readString(input, ['intent', 'kind']) || 'action';
      const name = readString(input, ['name', 'accountName', 'description', 'category', 'rawCategory']);
      const amount = readNumber(input, ['amount', 'balance', 'initialBalance']);
      const currency = readString(input, ['currency']) || 'RUB';
      const label = intentLabel(intent, readString(input, ['kind']), language);
      const value = [name, formatAmount(amount, currency, language)].filter(Boolean).join(' · ');
      return { label: `${index + 1}. ${label}`, value: value || label };
    })
    .filter((item): item is { label: string; value: string } => Boolean(item));
}

function resolveParsed(item: PendingActionItem) {
  const root = pickRecord(item.parsed, item.payload) ?? {};
  const payload = pickRecord(root.parsed, root.data, root.transaction, root) ?? root;
  return payload;
}

export function getPendingActionView(item: PendingActionItem, language: PendingActionLanguage = 'ru'): PendingActionView {
  const l = labels(language);
  const parsed = resolveParsed(item);
  const action = firstAction(parsed) ?? parsed;
  const actionCount = getActionCount(parsed);
  const isBatch = item.intent === 'batch' || Array.isArray(parsed?.actions);
  const actionTool = readString(action, ['tool', 'intent']) || readString(action, ['kind']) || item.intent || item.type;
  const currency = readString(action, ['currency', 'currencyCode']) || 'RUB';
  const amount = readNumber(action, ['amount', 'value', 'sum', 'balance', 'initialBalance', 'targetAmount', 'currentAmount']);
  const amountLabel = formatAmount(amount, currency, language);
  const description = readString(action, ['description', 'merchant', 'title', 'name', 'goal']);
  const category = readString(action, ['categoryName', 'category', 'rawCategory', 'categoryTitle']);
  const section = readString(action, ['sectionName', 'section', 'sectionTitle']);
  const kind = readString(action, ['kind', 'type']);
  const account = readString(action, ['accountName', 'account', 'fromAccountName']);
  const toAccount = readString(action, ['toAccountName', 'targetAccountName', 'toAccount']);

  const rows = isBatch && actionCount > 1
    ? getBatchRows(parsed, language)
    : compactRows([
        { label: l.rows.type, value: intentLabel(actionTool, kind, language) },
        { label: l.rows.amount, value: amountLabel },
        { label: l.rows.account, value: account },
        { label: l.rows.to, value: toAccount },
        { label: l.rows.category, value: category },
        { label: l.rows.section, value: section },
        { label: l.rows.goal, value: actionTool?.includes('goal') ? description : undefined },
        { label: l.rows.description, value: description && description !== category && !actionTool?.includes('goal') ? description : undefined },
      ]);

  const label = intentLabel(actionTool, kind, language);
  const title = amountLabel
    ? label
    : isBatch && actionCount > 1
      ? l.fallback.checkCount.replace('{count}', String(actionCount))
      : item.summary || description || label;

  return {
    title,
    subtitle: item.command || l.fallback.details,
    intentLabel: label,
    riskLabel: riskLabel(item.riskLevel, language),
    riskTone: riskTone(item.riskLevel),
    amountLabel,
    currency,
    rows,
    explanation: l.fallback.explanation,
    actionCount,
  };
}

export function getPreviewFromMessageData(params: {
  title: string;
  intent?: string;
  data?: Record<string, unknown>;
  language?: PendingActionLanguage;
}) {
  const fakeAction: PendingActionItem = {
    id: 'preview',
    summary: params.title,
    intent: params.intent,
    parsed: params.data,
  };

  return getPendingActionView(fakeAction, params.language ?? 'ru');
}
