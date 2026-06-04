import { useEffect } from 'react';
import { useAppModalStore } from '@/features/modals/model/appModal.store';
import { useNavigationStore } from '@/features/navigation/model/navigation.store';
import { useObligationsStore } from '@/features/obligations/model/obligations.store';
import { formatMoney, formatTransactionDate } from '@/shared/lib/money';

export function HomeObligationsWidget() {
  const navigateTo = useNavigationStore((state) => state.navigateTo);
  const summary = useObligationsStore((state) => state.summary);
  const loadSummary = useObligationsStore((state) => state.loadSummary);
  const markPaid = useObligationsStore((state) => state.markPaid);
  const openModal = useAppModalStore((state) => state.openModal);
  const isMutating = useObligationsStore((state) => state.isMutating);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  if (!summary || summary.activeLoansCount === 0 || !summary.nearest) return null;

  const nearest = summary.nearest;
  const days = nearest.daysUntilPayment;
  const dateLabel = nearest.nextPaymentDate ? formatTransactionDate(nearest.nextPaymentDate) : 'дата не указана';

  return (
    <section className="app-card app-obligations-widget">
      <div className="app-obligations-widget__top">
        <div>
          <div className="app-eyebrow">Ближайший платёж</div>
          <h2>{nearest.title}</h2>
          <p>
            {dateLabel}
            {typeof days === 'number' ? ` · ${days <= 0 ? 'сегодня' : `через ${days} дн.`}` : ''}
          </p>
        </div>
        <div className="app-obligations-widget__amount">{formatMoney(nearest.monthlyPayment, nearest.currency)}</div>
      </div>
      <div className="app-obligations-widget__meta">
        <span>В месяц: {formatMoney(summary.monthlyPaymentTotal, nearest.currency)}</span>
        <span>Долг: {formatMoney(summary.totalDebt, nearest.currency)}</span>
      </div>
      <div className="app-obligations-widget__actions">
        <button type="button" className="app-secondary-button" onClick={() => openModal({ type: 'obligation-edit', loan: nearest })}>Изменить</button>
        <button type="button" className="app-secondary-button" onClick={() => navigateTo('obligations')}>Открыть</button>
        <button type="button" className="app-primary-button" disabled={isMutating} onClick={() => markPaid(nearest.id)}>
          Оплатил
        </button>
      </div>
    </section>
  );
}
