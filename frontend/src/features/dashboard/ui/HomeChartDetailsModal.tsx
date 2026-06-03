import type { CSSProperties } from 'react';
import type { TransactionDto } from '@/features/transactions/api/transactions.api';
import type { HomeCashflowMode, HomeCashflowPeriod, HomeFinanceGroup } from '@/features/dashboard/lib/homeFinanceAnalytics';
import { buildHomeFinanceAnalytics, conicGradient, modeLabel, periodLabel } from '@/features/dashboard/lib/homeFinanceAnalytics';
import { formatMoney } from '@/shared/lib/money';


function ChartIconLayer({ groups, size = 'large' }: { groups: Array<{ key: string; icon: string; color: string; percent: number }>; size?: 'small' | 'large' }) {
  const visible = groups.filter((group) => group.percent > 0).slice(0, size === 'large' ? 12 : 6);
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

type Props = {
  open: boolean;
  transactions: TransactionDto[];
  mode: HomeCashflowMode;
  period: HomeCashflowPeriod;
  rates: { usd: number; eur: number };
  onClose: () => void;
  onOpenAnalytics: () => void;
  onOpenGroup: (group: HomeFinanceGroup) => void;
};

export function HomeChartDetailsModal({ open, transactions, mode, period, rates, onClose, onOpenAnalytics, onOpenGroup }: Props) {
  if (!open) return null;

  const analytics = buildHomeFinanceAnalytics(transactions, mode, period, rates);
  const hasSections = analytics.sections.length > 0 && analytics.sections.some((item) => item.name !== 'Без раздела');

  return (
    <div className="app-modal-backdrop app-home-chart-backdrop" data-no-swipe="true" onClick={onClose}>
      <div className="app-modal-sheet app-home-chart-modal" data-no-swipe="true" onClick={(event) => event.stopPropagation()}>
        <div className="app-modal-handle" />
        <div className="app-modal-body">
          <div className="app-home-chart-modal__head">
            <div>
              <div className="app-eyebrow">{periodLabel(period)}</div>
              <h2>{modeLabel(mode)}</h2>
              <p>{analytics.total > 0 ? formatMoney(analytics.total, 'RUB') : 'Операций пока нет'}</p>
            </div>
            <button type="button" className="app-icon-button" onClick={onClose} aria-label="Закрыть">×</button>
          </div>

          <div className="app-home-chart-modal__visual">
            {hasSections ? (
              <span className="app-home-donut app-home-donut--outer" style={{ background: conicGradient(analytics.sections) }}><i /></span>
            ) : null}
            <span className="app-home-donut app-home-donut--large" style={{ background: conicGradient(analytics.categories) }}><i /></span>
            <ChartIconLayer groups={analytics.categories} />
            {hasSections ? <ChartIconLayer groups={analytics.sections} size="small" /> : null}
          </div>

          <div className="app-home-chart-modal__actions">
            <button type="button" onClick={(event) => { event.stopPropagation(); onOpenAnalytics(); }}>Открыть полную аналитику</button>
            <button type="button" onClick={(event) => { event.stopPropagation(); window.dispatchEvent(new CustomEvent('ai-financer:report-request')); }}>Скачать отчёт</button>
          </div>

          <div className="app-home-chart-groups">
            {analytics.categories.length === 0 ? (
              <div className="app-empty-button">Добавь первую операцию — здесь появится разбор по категориям.</div>
            ) : analytics.categories.map((group) => (
              <button key={group.key} type="button" className="app-home-chart-group" onClick={(event) => { event.stopPropagation(); onOpenGroup(group); }}>
                <i className="app-home-chart-group__icon" style={{ background: group.color }}>{group.icon}</i>
                <span className="min-w-0">
                  <b>{group.name}</b>
                  <small>{group.sectionName} · {group.count} опер.</small>
                </span>
                <strong>{formatMoney(group.amount, 'RUB')}</strong>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
