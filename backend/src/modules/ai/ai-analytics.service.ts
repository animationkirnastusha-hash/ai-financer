import { prisma } from '../../lib/prisma';

type AnalyticsPeriod = 'today' | 'week' | 'month' | 'year' | 'all';
type AnalyticsMetric = 'summary' | 'spending' | 'income' | 'top_categories' | 'accounts' | 'cashflow';

function periodStart(period: AnalyticsPeriod) {
  const now = new Date();
  if (period === 'all') return null;
  if (period === 'today') return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (period === 'week') {
    const day = now.getDay() || 7;
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    start.setDate(start.getDate() - day + 1);
    return start;
  }
  if (period === 'year') return new Date(now.getFullYear(), 0, 1);
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

function normalizeText(value: unknown) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^a-zа-я0-9]+/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function searchTokens(value: unknown) {
  return normalizeText(value)
    .split(' ')
    .map((item) => item.trim())
    .filter((item) => item.length >= 2)
    .slice(0, 6);
}

function transactionSearchText(item: {
  title?: string | null;
  description?: string | null;
  type?: string | null;
  account?: { name?: string | null } | null;
  category?: { name?: string | null } | null;
}) {
  return normalizeText([
    item.title,
    item.description,
    item.type,
    item.account?.name,
    item.category?.name,
  ].filter(Boolean).join(' '));
}

export class AIAnalyticsService {
  async query(userId: string, input: Record<string, unknown>) {
    const period = this.period(input.period);
    const metric = this.metric(input.metric);
    const limit = this.limit(input.limit);
    const start = periodStart(period);
    const filter = this.filter(input);
    const filterTokens = searchTokens(filter);

    const where = {
      userId,
      ...(start ? { date: { gte: start } } : {}),
    };

    const [rawTransactions, accounts] = await Promise.all([
      prisma.transaction.findMany({
        where,
        include: { account: true, category: true, toAccount: true },
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        take: 500,
      }),
      prisma.account.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } }),
    ]);

    const transactions = filterTokens.length
      ? rawTransactions.filter((item) => {
        const searchable = transactionSearchText(item);
        return filterTokens.every((token) => searchable.includes(token));
      })
      : rawTransactions;

    const income = transactions.filter((item) => item.type === 'income').reduce((sum, item) => sum + item.amount, 0);
    const expenses = transactions.filter((item) => item.type === 'expense').reduce((sum, item) => sum + item.amount, 0);
    const transfers = transactions.filter((item) => item.type === 'transfer').reduce((sum, item) => sum + item.amount, 0);

    const categoryMap = new Map<string, { name: string; amount: number; count: number }>();
    for (const item of transactions) {
      if (item.type !== 'expense') continue;
      const name = item.category?.name ?? item.description ?? 'Без категории';
      const current = categoryMap.get(name) ?? { name, amount: 0, count: 0 };
      current.amount += item.amount;
      current.count += 1;
      categoryMap.set(name, current);
    }

    const topCategories = Array.from(categoryMap.values()).sort((a, b) => b.amount - a.amount).slice(0, limit);

    const base = {
      period,
      metric,
      filter: filter || null,
      totals: {
        income,
        expenses,
        net: income - expenses,
        transfers,
        transactionsCount: transactions.length,
        matchedTransactionsCount: transactions.length,
        totalTransactionsCount: rawTransactions.length,
        accountsBalance: accounts.reduce((sum, account) => sum + account.balance, 0),
      },
    };

    if (metric === 'accounts') {
      return {
        ...base,
        accounts: accounts.map((account) => ({
          id: account.id,
          name: account.name,
          type: account.type,
          currency: account.currency,
          balance: account.balance,
        })),
      };
    }

    if (metric === 'top_categories') return { ...base, topCategories };
    if (metric === 'spending') return { ...base, expenses, topCategories };
    if (metric === 'income') return { ...base, income };
    if (metric === 'cashflow') return { ...base, income, expenses, net: income - expenses };

    return { ...base, topCategories };
  }

  private period(value: unknown): AnalyticsPeriod {
    return value === 'today' || value === 'week' || value === 'month' || value === 'year' || value === 'all'
      ? value
      : 'month';
  }

  private metric(value: unknown): AnalyticsMetric {
    return value === 'spending' || value === 'income' || value === 'top_categories' || value === 'accounts' || value === 'cashflow'
      ? value
      : 'summary';
  }

  private limit(value: unknown) {
    const parsed = Number(value ?? 5);
    return Number.isFinite(parsed) ? Math.min(Math.max(Math.floor(parsed), 1), 20) : 5;
  }

  private filter(input: Record<string, unknown>) {
    const raw = input.filter || input.search || input.category || input.merchant || input.place || input.item;
    const text = String(raw ?? '').replace(/\s+/g, ' ').trim();
    return text.length > 64 ? text.slice(0, 64).trim() : text;
  }
}

export const aiAnalyticsService = new AIAnalyticsService();
