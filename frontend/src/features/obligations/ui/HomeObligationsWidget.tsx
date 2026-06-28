import { useEffect, useMemo } from 'react';
import { useNavigationStore } from '@/features/navigation/model/navigation.store';
import { useObligationsStore } from '@/features/obligations/model/obligations.store';
import type { LoanDto, RecurringPaymentDto } from '@/features/obligations/api/obligations.api';
import { formatMoney, formatTransactionDate } from '@/shared/lib/money';
import { useI18n } from '@/shared/lib/i18n';

type TFn = (key: string, params?: Record<string, string | number>) => string;

type HomePaymentRecord = {
  id: string;
  source: 'loan' | 'recurring';
  title: string;
  kindLabel: string;
  amount: number;
  currency: string;
  accountName?: string | null;
  nextDate?: string | null;
  daysUntil?: number | null;
  isDebt: boolean;
  progress: number;
  debt: number;
  principal: number;
  periodLabel?: string | null;
};

function hasDebtRemainder(type?: string | null) {
  return type === 'loan' || type === 'mortgage' || type === 'installment';
}

function amount(value: number | null | undefined) {
  return Number(value) || 0;
}

function clampProgress(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function paymentInitial(title?: string | null) {
  const first = title?.trim().charAt(0);
  return first ? first.toUpperCase() : '₽';
}

function periodLabel(period: string | null | undefined, t: TFn) {
  if (period === 'weekly') return t('dashboard.obligations.period.weekly');
  if (period === 'yearly') return t('dashboard.obligations.period.yearly');
  if (period === 'custom') return t('dashboard.obligations.period.custom');
  return t('dashboard.obligations.period.monthly');
}

function loanKindLabel(type: string | null | undefined, t: TFn) {
  if (type === 'mortgage') return t('dashboard.obligations.kind.mortgage');
  if (type === 'installment') return t('dashboard.obligations.kind.installment');
  if (type === 'subscription') return t('dashboard.obligations.kind.subscription');
  if (type === 'other') return t('dashboard.obligations.kind.other');
  return t('dashboard.obligations.kind.loan');
}

function loanToRecord(loan: LoanDto, t: TFn): HomePaymentRecord {
  const principal = amount(loan.principalAmount);
  const debt = amount(loan.currentDebt);
  const paid = Math.max(principal - debt, 0);
  const isDebt = hasDebtRemainder(loan.type);

  return {
    id: loan.id,
    source: 'loan',
    title: loan.title,
    kindLabel: loanKindLabel(String(loan.type), t),
    amount: amount(loan.monthlyPayment),
    currency: loan.currency || 'RUB',
    accountName: loan.account?.name,
    nextDate: loan.nextPaymentDate,
    daysUntil: loan.daysUntilPayment,
    isDebt,
    progress: clampProgress(loan.progress || (principal > 0 ? (paid / principal) * 100 : 0)),
    debt,
    principal,
  };
}

function recurringToRecord(payment: RecurringPaymentDto, t: TFn): HomePaymentRecord {
  return {
    id: payment.id,
    source: 'recurring',
    title: payment.name,
    kindLabel: payment.category || t('dashboard.obligations.kind.subscription'),
    amount: amount(payment.amount),
    currency: payment.account?.currency || 'RUB',
    accountName: payment.account?.name,
    nextDate: payment.nextDate,
    daysUntil: payment.daysUntilPayment,
    isDebt: false,
    progress: 0,
    debt: 0,
    principal: 0,
    periodLabel: periodLabel(payment.period, t),
  };
}

function paymentSortValue(payment: HomePaymentRecord) {
  if (typeof payment.daysUntil === 'number' && Number.isFinite(payment.daysUntil)) return payment.daysUntil;
  if (payment.nextDate) {
    const timestamp = new Date(payment.nextDate).getTime();
    if (Number.isFinite(timestamp)) return timestamp;
  }
  return Number.MAX_SAFE_INTEGER;
}

export function HomeObligationsWidget() {
  const { t } = useI18n();
  const navigateTo = useNavigationStore((state) => state.navigateTo);
  const summary = useObligationsStore((state) => state.summary);
  const loadSummary = useObligationsStore((state) => state.loadSummary);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  const records = useMemo(() => {
    if (!summary) return [];
    const loanRecords = (summary.loans ?? [])
      .filter((loan) => loan.status !== 'closed')
      .map((loan) => loanToRecord(loan, t));
    const recurringRecords = (summary.recurringPayments ?? [])
      .filter((payment) => payment.isActive !== false)
      .map((payment) => recurringToRecord(payment, t));

    return [...loanRecords, ...recurringRecords].sort((a, b) => paymentSortValue(a) - paymentSortValue(b));
  }, [summary, t]);

  const nearest = records[0] ?? null;
  const days = nearest?.daysUntil;

  const dateLabel = useMemo(() => {
    if (!nearest?.nextDate) return t('dashboard.obligations.dateMissing');
    const base = formatTransactionDate(nearest.nextDate);
    if (typeof days !== 'number') return base;
    if (days < 0) return `${base} · ${t('dashboard.obligations.overdue')}`;
    if (days === 0) return `${base} · ${t('dashboard.obligations.today')}`;
    if (days === 1) return `${base} · ${t('dashboard.obligations.tomorrow')}`;
    return `${base} · ${t('dashboard.obligations.inDays', { count: days })}`;
  }, [days, nearest?.nextDate, t]);

  if (!summary || !nearest) return null;

  const accountLabel = nearest.accountName ?? t('dashboard.obligations.noAccount');

  return (
    <section className="app-card app-obligations-widget" aria-label={t('dashboard.obligations.nearest')}>
      <div className="app-obligations-widget__head">
        <h2>{t('dashboard.obligations.homeTitle')}</h2>
        <div className="app-obligations-widget__head-actions">
          <span>{t('dashboard.obligations.count', { count: records.length })}</span>
          <button type="button" onClick={() => navigateTo('payments')}>{t('dashboard.obligations.all')}</button>
        </div>
      </div>

      <button type="button" className="app-obligations-widget__payment" onClick={() => navigateTo('payments')}>
        <span className="app-obligations-widget__icon" aria-hidden="true">{paymentInitial(nearest.title)}</span>
        <span className="app-obligations-widget__body">
          <span className="app-obligations-widget__title">{nearest.title}</span>
          <small>{dateLabel}</small>
        </span>
        <span className="app-obligations-widget__amount">
          <strong>{formatMoney(nearest.amount, nearest.currency)}</strong>
          <small>{accountLabel}</small>
        </span>
      </button>

      <div className="app-obligations-widget__meta-line">
        <span>{nearest.kindLabel}</span>
        {nearest.periodLabel ? <span>{nearest.periodLabel}</span> : null}
      </div>

      {nearest.isDebt ? (
        <div className="app-obligations-widget__progress" aria-label={`${nearest.progress}%`}>
          <span><i style={{ width: `${nearest.progress}%` }} /></span>
          <small>{t('dashboard.obligations.remainderOf', {
            left: formatMoney(nearest.debt, nearest.currency),
            total: formatMoney(nearest.principal, nearest.currency),
          })}</small>
        </div>
      ) : null}
    </section>
  );
}
