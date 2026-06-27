import { useEffect, useMemo, useState } from 'react';
import { useNavigationStore } from '@/features/navigation/model/navigation.store';
import { useObligationsStore } from '@/features/obligations/model/obligations.store';
import { formatMoney, formatTransactionDate } from '@/shared/lib/money';
import { useI18n } from '@/shared/lib/i18n';

const HOME_OBLIGATION_WIDGET_STATE_KEY = 'fina.home.obligationsWidget.state.v1';

type WidgetState = 'compact' | 'expanded' | 'hidden';

function readWidgetState(): WidgetState {
  if (typeof window === 'undefined') return 'compact';
  const value = window.localStorage.getItem(HOME_OBLIGATION_WIDGET_STATE_KEY);
  if (value === 'expanded' || value === 'hidden') return value;
  return 'compact';
}

function writeWidgetState(value: WidgetState) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(HOME_OBLIGATION_WIDGET_STATE_KEY, value);
}

function hasDebtRemainder(type?: string | null) {
  return type === 'loan' || type === 'mortgage' || type === 'installment';
}

export function HomeObligationsWidget() {
  const { t } = useI18n();
  const navigateTo = useNavigationStore((state) => state.navigateTo);
  const openAIWithCommand = useNavigationStore((state) => state.openAIWithCommand);
  const summary = useObligationsStore((state) => state.summary);
  const loadSummary = useObligationsStore((state) => state.loadSummary);
  const markPaid = useObligationsStore((state) => state.markPaid);
  const isMutating = useObligationsStore((state) => state.isMutating);
  const [widgetState, setWidgetState] = useState<WidgetState>(() => readWidgetState());

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  const nearest = summary?.nearest ?? null;
  const days = nearest?.daysUntilPayment;
  const showDebtRemainder = hasDebtRemainder(nearest?.type);

  useEffect(() => {
    if (!nearest && widgetState === 'hidden') {
      setWidgetState('compact');
      writeWidgetState('compact');
    }
  }, [nearest, widgetState]);

  const dateLabel = useMemo(() => {
    if (!nearest?.nextPaymentDate) return t('dashboard.obligations.dateMissing');
    const base = formatTransactionDate(nearest.nextPaymentDate);
    if (typeof days !== 'number') return base;
    if (days < 0) return `${base} · ${t('dashboard.obligations.overdue')}`;
    if (days === 0) return `${base} · ${t('dashboard.obligations.today')}`;
    if (days === 1) return `${base} · ${t('dashboard.obligations.tomorrow')}`;
    return `${base} · ${t('dashboard.obligations.inDays', { count: days })}`;
  }, [days, nearest?.nextPaymentDate, t]);

  function setState(next: WidgetState) {
    setWidgetState(next);
    writeWidgetState(next);
  }

  if (!summary || summary.activeLoansCount === 0 || !nearest) return null;

  if (widgetState === 'hidden') {
    return (
      <section className="app-card app-obligations-widget app-obligations-widget--hidden">
        <button type="button" className="app-obligations-widget__hidden-main" onClick={() => setState('compact')}>
          <span>{t('dashboard.obligations.hidden')}</span>
          <strong>{formatMoney(nearest.monthlyPayment, nearest.currency)}</strong>
        </button>
        <button type="button" className="app-obligations-widget__ghost" onClick={() => navigateTo('payments')}>{t('dashboard.obligations.open')}</button>
      </section>
    );
  }

  return (
    <section className={widgetState === 'expanded' ? 'app-card app-obligations-widget app-obligations-widget--expanded' : 'app-card app-obligations-widget app-obligations-widget--compact'}>
      <div className="app-obligations-widget__line">
        <button type="button" className="app-obligations-widget__main" onClick={() => navigateTo('payments')}>
          <span className="app-obligations-widget__label">{t('dashboard.obligations.nearest')}</span>
          <span className="app-obligations-widget__title">{nearest.title}</span>
          <small>{dateLabel}</small>
        </button>
        <div className="app-obligations-widget__side">
          <strong>{formatMoney(nearest.monthlyPayment, nearest.currency)}</strong>
          <button type="button" className="app-obligations-widget__icon" aria-label={widgetState === 'expanded' ? t('dashboard.obligations.collapse') : t('dashboard.obligations.expand')} onClick={() => setState(widgetState === 'expanded' ? 'compact' : 'expanded')}>
            {widgetState === 'expanded' ? '⌃' : '⌄'}
          </button>
        </div>
      </div>

      {widgetState === 'expanded' ? (
        <>
          <div className="app-obligations-widget__meta" data-has-debt={showDebtRemainder ? 'true' : 'false'}>
            <span>{t('dashboard.obligations.monthly', { amount: formatMoney(summary.monthlyPaymentTotal, nearest.currency) })}</span>
            {showDebtRemainder ? <span>{t('dashboard.obligations.remainder', { amount: formatMoney(summary.totalDebt, nearest.currency) })}</span> : null}
          </div>
          <div className="app-obligations-widget__actions">
            <button type="button" className="app-secondary-button" onClick={() => openAIWithCommand(t('payments.command.paymentEdit', { title: nearest.title }))}>{t('common.edit')}</button>
            <button type="button" className="app-secondary-button" onClick={() => setState('hidden')}>{t('dashboard.obligations.hide')}</button>
            <button type="button" className="app-primary-button" disabled={isMutating} onClick={() => markPaid(nearest.id)}>{t('dashboard.obligations.paid')}</button>
          </div>
        </>
      ) : (
        <div className="app-obligations-widget__compact-actions">
          <button type="button" className="app-secondary-button" onClick={() => setState('hidden')}>{t('dashboard.obligations.hide')}</button>
          <button type="button" className="app-primary-button" disabled={isMutating} onClick={() => markPaid(nearest.id)}>{t('dashboard.obligations.paid')}</button>
        </div>
      )}
    </section>
  );
}
