import type { TransactionDto } from '@/features/transactions/api/transactions.api';
import type { HomeCashflowMode, HomeCashflowPeriod } from '@/features/dashboard/lib/homeFinanceAnalytics';
import { buildHomeFinanceAnalytics, modeLabel, periodLabel } from '@/features/dashboard/lib/homeFinanceAnalytics';
import { formatMoney } from '@/shared/lib/money';

type Props = {
  transactions: TransactionDto[];
  mode: HomeCashflowMode;
  period: HomeCashflowPeriod;
  rates: { usd: number; eur: number };
};

export function HomeFinanceInsight({ transactions, mode, period, rates }: Props) {
  const analytics = buildHomeFinanceAnalytics(transactions, mode, period, rates);
  const first = analytics.categories[0];

  const text = first
    ? `${modeLabel(mode)} за период “${periodLabel(period).toLowerCase()}”: ${formatMoney(analytics.total, 'RUB')}. Больше всего — ${first.name}.`
    : `За выбранный период пока нет ${mode === 'expense' ? 'расходов' : 'доходов'}.`;

  return (
    <section className="app-card app-home-finance-insight">
      <div className="app-eyebrow">Вывод Фины</div>
      <p>{text}</p>
    </section>
  );
}
