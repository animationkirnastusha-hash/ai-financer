import type { TransactionDto } from '@/features/transactions/api/transactions.api';
import type { HomeCashflowMode, HomeCashflowPeriod } from '@/features/dashboard/lib/homeFinanceAnalytics';
import { buildHomeFinanceAnalytics, conicGradient, modeLabel, periodLabel } from '@/features/dashboard/lib/homeFinanceAnalytics';
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
  const primary = analytics.categories[0];
  const hasData = analytics.total > 0;
  const iconMarkers = buildIconMarkers(analytics.categories);

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
        <span className="app-home-donut app-home-donut--with-icons" style={{ background: conicGradient(analytics.categories) }}>
          <i />
          {iconMarkers.map((marker) => (
            <em key={marker.key} style={{ left: `${marker.x}%`, top: `${marker.y}%`, background: marker.color }}>
              {marker.icon}
            </em>
          ))}
        </span>
        <span className="app-home-chart-preview__text">
          <b>{hasData ? formatMoney(analytics.total, 'RUB', { sign: mode === 'expense' ? 'minus' : 'plus' }) : 'Пока пусто'}</b>
          <small>{hasData && primary ? `${primary.name} — ${primary.percent}%` : 'Добавь первую операцию за выбранный период'}</small>
        </span>
      </button>

      <button type="button" className="app-primary-button app-home-cashflow-card__action" onClick={() => onCreate(mode)}>
        {mode === 'expense' ? 'Добавить расход' : 'Добавить доход'}
      </button>
    </section>
  );
}


function buildIconMarkers(groups: Array<{ key: string; amount: number; color: string; icon: string }>) {
  const total = groups.reduce((sum, item) => sum + item.amount, 0);
  if (total <= 0) return [];

  let cursor = 0;
  return groups.slice(0, 8).map((group) => {
    const span = (group.amount / total) * 360;
    const angle = cursor + span / 2 - 90;
    cursor += span;
    const radius = 40;
    const radians = (angle * Math.PI) / 180;
    return {
      key: group.key,
      icon: group.icon || '✨',
      color: group.color,
      x: 50 + Math.cos(radians) * radius,
      y: 50 + Math.sin(radians) * radius,
    };
  });
}
