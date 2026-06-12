import type { TransactionDto } from '@/features/transactions/api/transactions.api';
import type { HomeCashflowMode, HomeCashflowPeriod } from '@/features/dashboard/lib/homeFinanceAnalytics';
import { buildHomeFinanceAnalytics } from '@/features/dashboard/lib/homeFinanceAnalytics';
import { formatMoney } from '@/shared/lib/money';
import { useI18n } from '@/shared/lib/i18n';

type Props = {
  transactions: TransactionDto[];
  mode: HomeCashflowMode;
  period: HomeCashflowPeriod;
  rates: { usd: number; eur: number };
};

export function HomeFinanceInsight({ transactions, mode, period, rates }: Props) {
  const { t } = useI18n();
  const analytics = buildHomeFinanceAnalytics(transactions, mode, period, rates, {
    otherExpense: t('dashboard.analytics.otherExpense'),
    incomeSection: t('dashboard.analytics.incomeSection'),
    incomeCategory: t('dashboard.analytics.incomeCategory'),
  });
  const first = analytics.categories[0];
  const modeTitle = mode === 'expense' ? t('transaction.type.expense') : t('transaction.type.income');
  const periodTitle = period === 'day' ? t('analytics.period.day') : period === 'week' ? t('analytics.period.week') : t('analytics.period.month');

  const text = first
    ? t('dashboard.insight.top', { mode: modeTitle, period: periodTitle.toLowerCase(), amount: formatMoney(analytics.total, 'RUB'), category: first.name })
    : t(mode === 'expense' ? 'dashboard.insight.empty.expense' : 'dashboard.insight.empty.income');

  return (
    <section className="app-card app-home-finance-insight">
      <div className="app-eyebrow">{t('dashboard.insight.eyebrow')}</div>
      <p>{text}</p>
    </section>
  );
}
