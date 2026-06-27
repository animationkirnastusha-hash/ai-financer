import type { TransactionDto } from '@/features/transactions/api/transactions.api';
import type { HomeCashflowMode, HomeCashflowPeriod, HomeFinanceGroup } from '@/features/dashboard/lib/homeFinanceAnalytics';
import { buildHomeFinanceAnalytics, conicGradient } from '@/features/dashboard/lib/homeFinanceAnalytics';
import { formatMoney } from '@/shared/lib/money';
import { useI18n } from '@/shared/lib/i18n';

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

export function HomeChartDetailsModal({ open, transactions, mode, period, rates, onClose, modalLayer, onOpenAnalytics, onOpenReport }: Props) {
  const { t } = useI18n();
  if (!open) return null;

  const analytics = buildHomeFinanceAnalytics(transactions, mode, period, rates, {
    otherExpense: t('dashboard.analytics.otherExpense'),
    incomeSection: t('dashboard.analytics.incomeSection'),
    incomeCategory: t('dashboard.analytics.incomeCategory'),
  });
  const periodTitle = period === 'day' ? t('analytics.period.day') : period === 'week' ? t('analytics.period.week') : t('analytics.period.month');
  const modeTitle = mode === 'expense' ? t('transaction.type.expense') : t('transaction.type.income');

  return (
    <div className="app-modal-backdrop app-home-chart-backdrop" style={{ zIndex: modalLayer }} data-no-swipe="true" onClick={onClose}>
      <div className="app-modal-sheet app-home-chart-modal" data-no-swipe="true" onClick={(event) => event.stopPropagation()}>
        <div className="app-modal-handle" />
        <div className="app-modal-body">
          <div className="app-home-chart-modal__head">
            <div>
              <div className="app-eyebrow">{periodTitle}</div>
              <h2>{modeTitle}</h2>
              <p>{analytics.total > 0 ? formatMoney(analytics.total, 'RUB') : t('dashboard.chart.empty')}</p>
            </div>
            <button type="button" className="app-icon-button" onClick={onClose} aria-label={t('common.close')}>×</button>
          </div>

          <div className="app-home-chart-modal__visual app-home-chart-modal__visual--single">
            <div className="app-home-chart-ring-block">
              <span className="app-home-donut app-home-donut--large" style={{ background: conicGradient(analytics.categories) }}><i /></span>

            </div>
          </div>

          <div className="app-home-chart-modal__actions">
            <button type="button" onClick={(event) => { event.stopPropagation(); onOpenAnalytics(); }}>{t('dashboard.chart.openAnalytics')}</button>
            <button type="button" onClick={(event) => { event.stopPropagation(); onOpenReport(); }}>{t('dashboard.chart.downloadReport')}</button>
          </div>

        </div>
      </div>
    </div>
  );
}
