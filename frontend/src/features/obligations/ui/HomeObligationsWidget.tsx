import { useEffect, useMemo, useState } from 'react';
import { useAppModalStore } from '@/features/modals/model/appModal.store';
import { useNavigationStore } from '@/features/navigation/model/navigation.store';
import { useObligationsStore } from '@/features/obligations/model/obligations.store';
import { formatMoney, formatTransactionDate } from '@/shared/lib/money';

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

export function HomeObligationsWidget() {
  const navigateTo = useNavigationStore((state) => state.navigateTo);
  const openModal = useAppModalStore((state) => state.openModal);
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

  useEffect(() => {
    if (!nearest && widgetState === 'hidden') {
      setWidgetState('compact');
      writeWidgetState('compact');
    }
  }, [nearest, widgetState]);

  const dateLabel = useMemo(() => {
    if (!nearest?.nextPaymentDate) return 'дата не указана';
    const base = formatTransactionDate(nearest.nextPaymentDate);
    if (typeof days !== 'number') return base;
    if (days < 0) return `${base} · просрочено`;
    if (days === 0) return `${base} · сегодня`;
    if (days === 1) return `${base} · завтра`;
    return `${base} · через ${days} дн.`;
  }, [days, nearest?.nextPaymentDate]);

  function setState(next: WidgetState) {
    setWidgetState(next);
    writeWidgetState(next);
  }

  if (!summary || summary.activeLoansCount === 0 || !nearest) return null;

  if (widgetState === 'hidden') {
    return (
      <section className="app-card app-obligations-widget app-obligations-widget--hidden">
        <button type="button" className="app-obligations-widget__hidden-main" onClick={() => setState('compact')}>
          <span>Ближайший платёж скрыт</span>
          <strong>{formatMoney(nearest.monthlyPayment, nearest.currency)}</strong>
        </button>
        <button type="button" className="app-obligations-widget__ghost" onClick={() => navigateTo('obligations')}>Открыть</button>
      </section>
    );
  }

  return (
    <section className={widgetState === 'expanded' ? 'app-card app-obligations-widget app-obligations-widget--expanded' : 'app-card app-obligations-widget app-obligations-widget--compact'}>
      <div className="app-obligations-widget__line">
        <button type="button" className="app-obligations-widget__main" onClick={() => navigateTo('obligations')}>
          <span className="app-obligations-widget__label">Ближайший платёж</span>
          <span className="app-obligations-widget__title">{nearest.title}</span>
          <small>{dateLabel}</small>
        </button>
        <div className="app-obligations-widget__side">
          <strong>{formatMoney(nearest.monthlyPayment, nearest.currency)}</strong>
          <button type="button" className="app-obligations-widget__icon" aria-label={widgetState === 'expanded' ? 'Свернуть' : 'Раскрыть'} onClick={() => setState(widgetState === 'expanded' ? 'compact' : 'expanded')}>
            {widgetState === 'expanded' ? '⌃' : '⌄'}
          </button>
        </div>
      </div>

      {widgetState === 'expanded' ? (
        <>
          <div className="app-obligations-widget__meta">
            <span>В месяц: {formatMoney(summary.monthlyPaymentTotal, nearest.currency)}</span>
            <span>Остаток: {formatMoney(summary.totalDebt, nearest.currency)}</span>
          </div>
          <div className="app-obligations-widget__actions">
            <button type="button" className="app-secondary-button" onClick={() => openModal({ type: 'obligation-edit', loan: nearest })}>Изменить</button>
            <button type="button" className="app-secondary-button" onClick={() => setState('hidden')}>Скрыть</button>
            <button type="button" className="app-primary-button" disabled={isMutating} onClick={() => markPaid(nearest.id)}>Оплатил</button>
          </div>
        </>
      ) : (
        <div className="app-obligations-widget__compact-actions">
          <button type="button" className="app-secondary-button" onClick={() => setState('hidden')}>Скрыть</button>
          <button type="button" className="app-primary-button" disabled={isMutating} onClick={() => markPaid(nearest.id)}>Оплатил</button>
        </div>
      )}
    </section>
  );
}
