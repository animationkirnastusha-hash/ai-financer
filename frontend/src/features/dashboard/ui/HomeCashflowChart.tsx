import type { ReactNode } from 'react';
import type { TransactionDto } from '@/features/transactions/api/transactions.api';
import type { HomeCashflowMode, HomeCashflowPeriod } from '@/features/dashboard/lib/homeFinanceAnalytics';
import { buildHomeFinanceAnalytics, conicGradient } from '@/features/dashboard/lib/homeFinanceAnalytics';
import { formatMoney } from '@/shared/lib/money';
import { useI18n } from '@/shared/lib/i18n';
import { HomeChartLegend } from '@/features/dashboard/ui/HomeChartLegend';

type Rates = { usd: number; eur: number };

type Props = {
  transactions: TransactionDto[];
  mode: HomeCashflowMode;
  period: HomeCashflowPeriod;
  rates: Rates;
  onModeChange: (mode: HomeCashflowMode) => void;
  onPeriodChange: (period: HomeCashflowPeriod) => void;
  onOpenDetails: () => void;
  onCreate: (mode: HomeCashflowMode) => void;
  balanceSlot?: ReactNode;
};

export function HomeCashflowChart({
  transactions,
  mode,
  period,
  rates,
  onModeChange,
  onPeriodChange,
  onOpenDetails,
  onCreate,
  balanceSlot,
}: Props) {
  const { t, rt } = useI18n();
  const analytics = buildHomeFinanceAnalytics(transactions, mode, period, rates, {
    otherExpense: t('dashboard.analytics.otherExpense'),
    incomeSection: t('dashboard.analytics.incomeSection'),
    incomeCategory: t('dashboard.analytics.incomeCategory'),
  });
  const primary = analytics.categories[0];
  const hasData = analytics.total > 0;
  const modeTitle = mode === 'expense' ? t('transaction.type.expense') : t('transaction.type.income');
  const periodTitle = (value: HomeCashflowPeriod) => value === 'day' ? t('analytics.period.day') : value === 'week' ? t('analytics.period.week') : t('analytics.period.month');

  return (
    <section className="app-card app-home-cashflow-card">
      {balanceSlot ? <div className="app-home-cashflow-card__balance">{balanceSlot}</div> : null}

      <div className="app-home-cashflow-card__head">
        <div>
          <div className="app-eyebrow">{t('dashboard.cashflow.eyebrow')}</div>
          <h2>{modeTitle}</h2>
        </div>
        <div className="app-home-period-switch" data-no-swipe="true">
          {(['day', 'week', 'month'] as HomeCashflowPeriod[]).map((item) => (
            <button key={item} type="button" data-active={period === item} onClick={() => onPeriodChange(item)}>{periodTitle(item)}</button>
          ))}
        </div>
      </div>

      <div className="app-home-mode-switch" data-no-swipe="true">
        <button type="button" data-active={mode === 'expense'} onClick={() => onModeChange('expense')}>{t('transaction.type.expense')}</button>
        <button type="button" data-active={mode === 'income'} onClick={() => onModeChange('income')}>{t('transaction.type.income')}</button>
      </div>

      <button type="button" className="app-home-chart-preview" onClick={onOpenDetails} aria-label={t('dashboard.cashflow.openChart')}>
        <span className="app-home-donut" style={{ background: conicGradient(analytics.categories) }}>
          <i />
        </span>
        <span className="app-home-chart-preview__text">
          <b>{hasData ? formatMoney(analytics.total, 'RUB', { sign: mode === 'expense' ? 'minus' : 'plus' }) : t('dashboard.cashflow.empty')}</b>
          <small>{hasData && primary ? `${primary.icon ? `${primary.icon} ` : ``}${rt(primary.name)} — ${primary.percent}%` : t('dashboard.cashflow.emptyCaption')}</small>
        </span>
      </button>

      <HomeChartLegend groups={analytics.categories} title={t('dashboard.chart.categories')} compact />

      <button type="button" className="app-primary-button app-home-cashflow-card__action" onClick={() => onCreate(mode)}>
        {mode === 'expense' ? t('dashboard.cashflow.addExpense') : t('dashboard.cashflow.addIncome')}
      </button>
    </section>
  );
}
