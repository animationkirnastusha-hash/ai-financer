import type { TransactionDto } from '@/features/transactions/api/transactions.api';
import type { AppCurrency } from '@/features/settings/model/settings.types';
import { convertCurrency } from '@/features/currency/lib/currency';

export type HomeCashflowMode = 'expense' | 'income';
export type HomeCashflowPeriod = 'day' | 'week' | 'month';

export type HomeFinanceGroup = {
  key: string;
  name: string;
  sectionName: string;
  amount: number;
  color: string;
  icon?: string | null;
  percent: number;
  count: number;
  transactions: TransactionDto[];
};

export type HomeSectionGroup = {
  key: string;
  name: string;
  amount: number;
  color: string;
  icon?: string | null;
  percent: number;
};

const colors = [
  'rgba(52, 211, 153, .94)',
  'rgba(96, 165, 250, .92)',
  'rgba(251, 191, 36, .92)',
  'rgba(248, 113, 113, .92)',
  'rgba(196, 181, 253, .92)',
  'rgba(45, 212, 191, .92)',
  'rgba(244, 114, 182, .92)',
  'rgba(163, 230, 53, .90)',
];

type Rates = { usd: number; eur: number };

type CategoryWithSection = {
  name?: string | null;
  section?: { name?: string | null; icon?: string | null; color?: string | null } | null;
};

type ExtendedTransaction = TransactionDto & {
  section?: { name?: string | null; icon?: string | null; color?: string | null } | null;
  category?: (CategoryWithSection & { icon?: string | null; color?: string | null }) | null;
};

export function periodLabel(period: HomeCashflowPeriod) {
  if (period === 'day') return 'День';
  if (period === 'week') return 'Неделя';
  return 'Месяц';
}

export function modeLabel(mode: HomeCashflowMode) {
  return mode === 'expense' ? 'Расходы' : 'Доходы';
}

export function isInPeriod(dateValue: string, period: HomeCashflowPeriod) {
  const date = new Date(dateValue);
  const now = new Date();

  if (Number.isNaN(date.getTime())) return false;

  if (period === 'day') {
    return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate();
  }

  if (period === 'week') {
    const start = new Date(now);
    const day = start.getDay() || 7;
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - day + 1);

    const end = new Date(start);
    end.setDate(start.getDate() + 7);
    return date >= start && date < end;
  }

  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
}

export function toRub(amount: number, currency: string | undefined, rates: Rates) {
  return convertCurrency(amount, (currency || 'RUB') as AppCurrency, 'RUB', { USD: rates.usd, EUR: rates.eur });
}

export function buildHomeFinanceAnalytics(
  transactions: TransactionDto[],
  mode: HomeCashflowMode,
  period: HomeCashflowPeriod,
  rates: Rates,
) {
  const filtered = transactions.filter((transaction) => transaction.type === mode && isInPeriod(transaction.date, period));
  const total = filtered.reduce((sum, transaction) => sum + toRub(Number(transaction.amount) || 0, transaction.account?.currency, rates), 0);
  const categoryMap = new Map<string, HomeFinanceGroup>();
  const sectionMap = new Map<string, HomeSectionGroup>();

  filtered.forEach((transaction) => {
    const item = transaction as ExtendedTransaction;
    const categoryName = item.category?.name?.trim() || (mode === 'expense' ? 'Без категории' : 'Доходы');
    const sectionName = item.category?.section?.name?.trim() || item.section?.name?.trim() || 'Без раздела';
    const categoryIcon = item.category?.icon || (mode === 'expense' ? '🧾' : '💵');
    const sectionIcon = item.category?.section?.icon || item.section?.icon || '📌';
    const key = `${sectionName}::${categoryName}`;
    const amount = toRub(Number(transaction.amount) || 0, transaction.account?.currency, rates);

    const existingCategory = categoryMap.get(key);
    if (existingCategory) {
      existingCategory.amount += amount;
      existingCategory.count += 1;
      existingCategory.transactions.push(transaction);
    } else {
      const color = item.category?.color || colors[categoryMap.size % colors.length];
      categoryMap.set(key, {
        key,
        name: categoryName,
        sectionName,
        amount,
        color,
        icon: categoryIcon,
        percent: 0,
        count: 1,
        transactions: [transaction],
      });
    }

    const sectionKey = sectionName;
    const existingSection = sectionMap.get(sectionKey);
    if (existingSection) {
      existingSection.amount += amount;
    } else {
      const color = item.category?.section?.color || item.section?.color || colors[sectionMap.size % colors.length];
      sectionMap.set(sectionKey, { key: sectionKey, name: sectionName, amount, color, icon: sectionIcon, percent: 0 });
    }
  });

  const categories = [...categoryMap.values()]
    .sort((a, b) => b.amount - a.amount)
    .map((item) => ({ ...item, percent: total > 0 ? Math.round((item.amount / total) * 100) : 0 }));

  const sections = [...sectionMap.values()]
    .sort((a, b) => b.amount - a.amount)
    .map((item) => ({ ...item, percent: total > 0 ? Math.round((item.amount / total) * 100) : 0 }));

  return { total, categories, sections, transactions: filtered };
}

export function conicGradient(groups: Array<{ amount: number; color: string }>) {
  const total = groups.reduce((sum, group) => sum + group.amount, 0);
  if (total <= 0) return 'conic-gradient(rgba(255,255,255,.10) 0 100%)';

  let cursor = 0;
  const parts = groups.map((group) => {
    const start = cursor;
    const span = (group.amount / total) * 100;
    cursor += span;
    return `${group.color} ${start.toFixed(2)}% ${cursor.toFixed(2)}%`;
  });

  return `conic-gradient(${parts.join(', ')})`;
}
