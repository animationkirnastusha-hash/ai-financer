import type { TransactionDto } from '@/features/transactions/api/transactions.api';
import type { HomeCashflowMode, HomeCashflowPeriod } from '@/features/dashboard/lib/homeFinanceAnalytics';
import { buildHomeFinanceAnalytics, conicGradient, modeLabel, periodLabel } from '@/features/dashboard/lib/homeFinanceAnalytics';
import type { CSSProperties } from 'react';
import { formatMoney } from '@/shared/lib/money';

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
};


function ChartIconLayer({ groups, size = 'small' }: { groups: Array<{ key: string; icon: string; color: string; percent: number }>; size?: 'small' | 'large' }) {
  const visible = groups.filter((group) => group.percent > 0).slice(0, size === 'large' ? 10 : 6);
  if (visible.length === 0) return null;

  return (
    <span className={size === 'large' ? 'app-chart-icon-layer app-chart-icon-layer--large' : 'app-chart-icon-layer'} aria-hidden="true">
      {visible.map((group, index) => {
        const angle = (360 / visible.length) * index - 90;
        return <i key={group.key} style={{ '--icon-angle': `${angle}deg`, '--icon-color': group.color } as CSSProperties}>{group.icon}</i>;
      })}
    </span>
  );
}

export function HomeCashflowChart({
  transactions,
  mode,
  period,
  rates,
  onModeChange,
  onPeriodChange,
  onOpenDetails,
  onCreate,
}: Props) {
  const analytics = buildHomeFinanceAnalytics(transactions, mode, period, rates);
  const hasData = analytics.total > 0;

  return (
    <section className="app-card app-home-cashflow-card">
      <div className="app-home-cashflow-card__head">
        <div>
          <div className="app-eyebrow">Траты и доходы</div>
          <h2>{modeLabel(mode)}</h2>
        </div>
        <div className="app-home-period-switch" data-no-swipe="true">
          {(['day', 'week', 'month'] as HomeCashflowPeriod[]).map((item) => (
            <button key={item} type="button" data-active={period === item} onClick={() => onPeriodChange(item)}>{periodLabel(item)}</button>
          ))}
        </div>
      </div>

      <div className="app-home-mode-switch" data-no-swipe="true">
        <button type="button" data-active={mode === 'expense'} onClick={() => onModeChange('expense')}>Расходы</button>
        <button type="button" data-active={mode === 'income'} onClick={() => onModeChange('income')}>Доходы</button>
      </div>

      <button type="button" className="app-home-chart-preview" onClick={onOpenDetails} aria-label="Открыть диаграмму">
        <span className="app-home-chart-preview__visual">
          <span className="app-home-donut" style={{ background: conicGradient(analytics.categories) }}>
            <i />
          </span>
          <ChartIconLayer groups={analytics.categories} />
        </span>
        <span className="app-home-chart-preview__text">
          <b>{hasData ? formatMoney(analytics.total, 'RUB', { sign: mode === 'expense' ? 'minus' : 'plus' }) : 'Пока пусто'}</b>
          <small>{hasData ? `${analytics.categories.length} категорий · ${analytics.transactions.length} операций` : 'Добавь первую операцию за выбранный период'}</small>
        </span>
      </button>

      <button type="button" className="app-primary-button app-home-cashflow-card__action" onClick={() => onCreate(mode)}>
        {mode === 'expense' ? 'Добавить расход' : 'Добавить доход'}
      </button>
    </section>
  );
}
