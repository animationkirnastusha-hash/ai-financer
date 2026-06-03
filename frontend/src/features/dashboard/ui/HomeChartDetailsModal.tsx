import type { TransactionDto } from '@/features/transactions/api/transactions.api';
import type { HomeCashflowMode, HomeCashflowPeriod, HomeFinanceGroup } from '@/features/dashboard/lib/homeFinanceAnalytics';
import { buildHomeFinanceAnalytics, conicGradient, modeLabel, periodLabel } from '@/features/dashboard/lib/homeFinanceAnalytics';
import { formatMoney } from '@/shared/lib/money';

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
  const categoryIcons = buildIconMarkers(analytics.categories, 44);
  const sectionIcons = buildIconMarkers(analytics.sections, 47);

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
              <span className="app-home-donut app-home-donut--outer app-home-donut--with-icons" style={{ background: conicGradient(analytics.sections) }}><i />{sectionIcons.map((marker) => <em key={marker.key} style={{ left: `${marker.x}%`, top: `${marker.y}%`, background: marker.color }}>{marker.icon}</em>)}</span>
            ) : null}
            <span className="app-home-donut app-home-donut--large app-home-donut--with-icons" style={{ background: conicGradient(analytics.categories) }}><i />{categoryIcons.map((marker) => <em key={marker.key} style={{ left: `${marker.x}%`, top: `${marker.y}%`, background: marker.color }}>{marker.icon}</em>)}</span>
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
                <i style={{ background: group.color }}>{group.icon}</i>
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


function buildIconMarkers(groups: Array<{ key: string; amount: number; color: string; icon: string }>, radius = 40) {
  const total = groups.reduce((sum, item) => sum + item.amount, 0);
  if (total <= 0) return [];

  let cursor = 0;
  return groups.slice(0, 10).map((group) => {
    const span = (group.amount / total) * 360;
    const angle = cursor + span / 2 - 90;
    cursor += span;
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
