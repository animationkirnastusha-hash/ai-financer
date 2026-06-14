import type { CreateTransactionPayload, TransactionDto } from '@/features/transactions/api/transactions.api';
import type { JournalPeriod, JournalTagOption } from '@/pages/journal/lib/journalTypes';

function startOfDay(date: Date) {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
}

export function normalizeJournalText(value: string) {
  return value
    .toLowerCase()
    .replaceAll('ё', 'е')
    .replace(/[^a-zа-я0-9\s-]+/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function toDateInput(value: Date) {
  return value.toISOString().slice(0, 10);
}

export function isInsideJournalPeriod(dateValue: string, period: JournalPeriod, dateFrom: string, dateTo: string) {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return true;

  if (period === 'all') return true;

  if (period === 'custom') {
    const from = dateFrom ? new Date(`${dateFrom}T00:00:00`) : null;
    const to = dateTo ? new Date(`${dateTo}T23:59:59`) : null;
    if (from && date < from) return false;
    if (to && date > to) return false;
    return true;
  }

  const now = new Date();
  const today = startOfDay(now);

  if (period === 'today') return date >= today;

  if (period === 'week') {
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - 6);
    return date >= weekStart;
  }

  if (period === 'year') return date.getFullYear() === now.getFullYear();

  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
}

export function journalTransactionTitle(item: TransactionDto, fallback: string) {
  return item.title?.trim() || item.description?.trim() || item.category?.name || fallback;
}

export function journalTransactionIcon(item: TransactionDto) {
  if (item.type === 'income') return '↑';
  if (item.type === 'transfer') return '⇄';
  return item.category?.icon || item.section?.icon || '•';
}

export function journalTransactionAmountPrefix(item: TransactionDto) {
  if (item.type === 'income') return '+';
  if (item.type === 'expense') return '-';
  return '';
}

export function journalTransactionSearchText(item: TransactionDto) {
  return normalizeJournalText([
    item.title,
    item.description,
    item.amount,
    item.account?.name,
    item.toAccount?.name,
    item.category?.name,
    item.category?.section?.name,
    item.section?.name,
    item.date,
  ].filter(Boolean).join(' '));
}

function tokenizeJournalNote(value: string | null | undefined) {
  const normalized = normalizeJournalText(value ?? '');
  if (!normalized) return [];

  return normalized
    .split(' ')
    .map((word) => word.trim())
    .filter((word) => word.length >= 4 && !/^[0-9]+$/.test(word))
    .slice(0, 6);
}

export function journalTransactionTags(item: TransactionDto) {
  const namedSource = [
    item.account?.name,
    item.toAccount?.name,
    item.category?.name,
    item.category?.section?.name,
    item.section?.name,
  ].filter(Boolean) as string[];

  const noteWords = [...tokenizeJournalNote(item.title), ...tokenizeJournalNote(item.description)];
  const rawTags = [
    ...namedSource.map((label) => ({ value: normalizeJournalText(label), label })),
    ...noteWords.map((word) => ({ value: word, label: word })),
  ];

  return Array.from(new Map(rawTags.map((tag) => [tag.value, tag])).values())
    .filter((tag) => tag.value.length > 1)
    .map((tag) => ({ value: tag.value, label: tag.label }));
}

export function buildJournalTagOptions(items: TransactionDto[]): JournalTagOption[] {
  const map = new Map<string, JournalTagOption>();

  for (const item of items) {
    for (const tag of journalTransactionTags(item)) {
      const existing = map.get(tag.value);
      if (existing) existing.count += 1;
      else map.set(tag.value, { value: tag.value, label: tag.label, count: 1 });
    }
  }

  return [...map.values()]
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, 14);
}

export function formatJournalShortDate(value: string, language: 'ru' | 'en') {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(language === 'en' ? 'en-US' : 'ru-RU', { day: '2-digit', month: 'short' }).format(date);
}

export function buildDuplicateTransactionPayload(item: TransactionDto): CreateTransactionPayload {
  return {
    accountId: item.accountId,
    toAccountId: item.type === 'transfer' ? item.toAccountId ?? null : null,
    categoryId: item.type === 'transfer' ? null : item.categoryId ?? null,
    amount: Number(item.amount) || 0,
    type: item.type,
    title: item.title ? `${item.title}` : null,
    description: item.description ?? null,
    date: new Date().toISOString(),
    isAIGenerated: false,
  };
}
