import type { TransactionDto } from '@/features/transactions/api/transactions.api';
import type { HomeCashflowMode, HomeCashflowPeriod, HomeFinanceGroup } from '@/features/dashboard/lib/homeFinanceAnalytics';
import { buildHomeFinanceAnalytics, conicGradient, modeLabel, periodLabel } from '@/features/dashboard/lib/homeFinanceAnalytics';
import { formatMoney } from '@/shared/lib/money';
import { useI18n } from '@/shared/lib/i18n';

const CATEGORY_LIMIT_PER_SECTION = 4;

type Props = {
  open: boolean;
  transactions: TransactionDto[];
  mode: HomeCashflowMode;
  period: HomeCashflowPeriod;
  rates: { usd: number; eur: number };
  onClose: () => void;
  modalLayer?: number;
  onOpenAnalytics: () => void;
  onOpenReport: () => void;
  onOpenGroup: (group: HomeFinanceGroup) => void;
};

export function HomeChartDetailsModal({ open, transactions, mode, period, rates, onClose, modalLayer, onOpenAnalytics, onOpenReport, onOpenGroup }: Props) {
  const { t } = useI18n();
  if (!open) return null;

  const analytics = buildHomeFinanceAnalytics(transactions, mode, period, rates);
  return (
    <div className="app-modal-backdrop app-home-chart-backdrop" style={{ zIndex: modalLayer }} data-no-swipe="true" onClick={onClose}>
      <div className="app-modal-sheet app-home-chart-modal" data-no-swipe="true" onClick={(event) => event.stopPropagation()}>
        <div className="app-modal-handle" />
        <div className="app-modal-body">
          <div className="app-home-chart-modal__head">
            <div>
              <div className="app-eyebrow">{periodLabel(period)}</div>
              <h2>{modeLabel(mode)}</h2>
              <p>{analytics.total > 0 ? formatMoney(analytics.total, 'RUB') : t('dashboard.chart.empty')}</p>
            </div>
            <button type="button" className="app-icon-button" onClick={onClose} aria-label={t('common.close')}>×</button>
          </div>

          <div className="app-home-chart-modal__visual app-home-chart-modal__visual--split">
            <div className="app-home-chart-ring-block">
              <span className="app-home-donut app-home-donut--large" style={{ background: conicGradient(analytics.sections) }}><i /></span>
              <small>{t('dashboard.chart.sections')}</small>
            </div>
            <div className="app-home-chart-ring-block app-home-chart-ring-block--secondary">
              <span className="app-home-donut app-home-donut--medium" style={{ background: conicGradient(analytics.categories) }}><i /></span>
              <small>{t('dashboard.chart.categories')}</small>
            </div>
          </div>

          <div className="app-home-chart-modal__actions">
            <button type="button" onClick={(event) => { event.stopPropagation(); onOpenAnalytics(); }}>{t('dashboard.chart.openAnalytics')}</button>
            <button type="button" onClick={(event) => { event.stopPropagation(); onOpenReport(); }}>{t('dashboard.chart.downloadReport')}</button>
          </div>

          <div className="app-home-chart-groups">
            {analytics.sections.length === 0 ? (
              <div className="app-empty-button">{t('dashboard.chart.emptyHint')}</div>
            ) : analytics.sections.map((section) => (
              <section key={section.key} className="app-home-section-breakdown">
                <div className="app-home-section-breakdown__head">
                  <i style={{ background: section.color }}>{section.icon || ''}</i>
                  <span>
                    <b>{section.name}</b>
                    <small>{section.count} · {section.percent}%</small>
                  </span>
                  <strong>{formatMoney(section.amount, 'RUB')}</strong>
                </div>

                <div className="app-home-section-breakdown__categories">
                  {section.categories.slice(0, CATEGORY_LIMIT_PER_SECTION).map((group) => (
                    <button key={group.key} type="button" className="app-home-chart-group app-home-chart-group--nested" onClick={(event) => { event.stopPropagation(); onOpenGroup(group); }}>
                      <i style={{ background: group.color }}>{group.icon || ''}</i>
                      <span className="min-w-0">
                        <b>{group.name}</b>
                        <small>{group.count} · {group.percent}%</small>
                      </span>
                      <strong>{formatMoney(group.amount, 'RUB')}</strong>
                    </button>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
