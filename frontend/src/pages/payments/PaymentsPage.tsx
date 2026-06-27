import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useAccountsStore } from '@/features/accounts/model/accounts.store';
import { useObligationsStore } from '@/features/obligations/model/obligations.store';
import { useNavigationStore } from '@/features/navigation/model/navigation.store';
import { ScreenTopBar } from '@/shared/ui/ScreenTopBar';
import { EmptyState } from '@/shared/ui/EmptyState';
import { formatMoney, formatTransactionDate } from '@/shared/lib/money';
import { useI18n } from '@/shared/lib/i18n';
import type { LoanDto, RecurringPaymentDto } from '@/features/obligations/api/obligations.api';

type PaymentTab = 'credit' | 'installment' | 'subscription' | 'other';
type PaymentRecord = {
  id: string;
  source: 'loan' | 'recurring';
  tab: PaymentTab;
  title: string;
  eyebrow: string;
  amount: number;
  currency: string;
  paid: number;
  debt: number;
  progress: number;
  nextDate?: string | null;
  daysUntil?: number | null;
  accountName?: string | null;
  note?: string | null;
  rawLoan?: LoanDto;
  rawRecurring?: RecurringPaymentDto;
};

type TFn = (key: string, params?: Record<string, string | number>) => string;

const tabs: PaymentTab[] = ['credit', 'installment', 'subscription', 'other'];

function clampProgress(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function amount(value: number | null | undefined) {
  return Number(value) || 0;
}

function daysLabel(value: number | null | undefined, t: TFn) {
  if (value == null) return t('payments.date.empty');
  if (value < 0) return t('payments.date.overdue', { days: Math.abs(value) });
  if (value === 0) return t('payments.date.today');
  if (value === 1) return t('payments.date.tomorrow');
  return t('payments.date.afterDays', { days: value });
}

function paymentKind(type: string | null | undefined): PaymentTab {
  if (type === 'installment') return 'installment';
  if (type === 'subscription') return 'subscription';
  if (type === 'other') return 'other';
  return 'credit';
}

function tabTitle(tab: PaymentTab, t: TFn) {
  if (tab === 'credit') return t('payments.tab.credit');
  if (tab === 'installment') return t('payments.tab.installment');
  if (tab === 'subscription') return t('payments.tab.subscription');
  return t('payments.tab.other');
}

function createCommand(tab: PaymentTab, t: TFn) {
  if (tab === 'credit') return t('payments.command.creditCreate');
  if (tab === 'installment') return t('payments.command.installmentCreate');
  if (tab === 'subscription') return t('payments.command.subscriptionCreate');
  return t('payments.command.otherCreate');
}

function editCommand(record: PaymentRecord, t: TFn) {
  return t(record.source === 'recurring' ? 'payments.command.recurringEdit' : 'payments.command.paymentEdit', { title: record.title });
}

function paidCommand(record: PaymentRecord, t: TFn) {
  return t(record.source === 'recurring' ? 'payments.command.recurringPaid' : 'payments.command.paymentPaid', { title: record.title });
}

function tabFocusTitle(tab: PaymentTab, t: TFn) {
  if (tab === 'credit') return t('payments.focus.credit.title');
  if (tab === 'installment') return t('payments.focus.installment.title');
  if (tab === 'subscription') return t('payments.focus.subscription.title');
  return t('payments.focus.other.title');
}

function tabFocusCaption(tab: PaymentTab, t: TFn) {
  if (tab === 'credit') return t('payments.focus.credit.caption');
  if (tab === 'installment') return t('payments.focus.installment.caption');
  if (tab === 'subscription') return t('payments.focus.subscription.caption');
  return t('payments.focus.other.caption');
}

function tabEmptyCaption(tab: PaymentTab, t: TFn) {
  if (tab === 'credit') return t('payments.empty.credit.caption');
  if (tab === 'installment') return t('payments.empty.installment.caption');
  if (tab === 'subscription') return t('payments.empty.subscription.caption');
  return t('payments.empty.other.caption');
}

function loanToRecord(loan: LoanDto, t: TFn): PaymentRecord {
  const tab = paymentKind(String(loan.type));
  const principal = amount(loan.principalAmount);
  const debt = amount(loan.currentDebt);
  const paid = Math.max(principal - debt, 0);

  return {
    id: loan.id,
    source: 'loan',
    tab,
    title: loan.title,
    eyebrow: loan.creditor || tabTitle(tab, t),
    amount: amount(loan.monthlyPayment),
    currency: loan.currency || 'RUB',
    paid,
    debt,
    progress: clampProgress(loan.progress || (principal > 0 ? (paid / principal) * 100 : 0)),
    nextDate: loan.nextPaymentDate,
    daysUntil: loan.daysUntilPayment,
    accountName: loan.account?.name,
    note: loan.note,
    rawLoan: loan,
  };
}

function recurringToRecord(payment: RecurringPaymentDto, t: TFn): PaymentRecord {
  return {
    id: payment.id,
    source: 'recurring',
    tab: 'subscription',
    title: payment.name,
    eyebrow: payment.category || t('payments.tab.subscription'),
    amount: amount(payment.amount),
    currency: payment.account?.currency || 'RUB',
    paid: 0,
    debt: 0,
    progress: 0,
    nextDate: payment.nextDate,
    daysUntil: payment.daysUntilPayment,
    accountName: payment.account?.name,
    note: payment.period,
    rawRecurring: payment,
  };
}

function periodLabel(period: string | null | undefined, t: TFn) {
  if (period === 'weekly') return t('payments.period.weekly');
  if (period === 'yearly') return t('payments.period.yearly');
  if (period === 'custom') return t('payments.period.custom');
  return t('payments.period.monthly');
}

export default function PaymentsPage() {
  const { t } = useI18n();
  const [tab, setTab] = useState<PaymentTab>('credit');
  const loadAccounts = useAccountsStore((state) => state.loadAccounts);
  const loans = useObligationsStore((state) => state.loans);
  const reminders = useObligationsStore((state) => state.reminders);
  const summary = useObligationsStore((state) => state.summary);
  const isLoading = useObligationsStore((state) => state.isLoading);
  const isMutating = useObligationsStore((state) => state.isMutating);
  const error = useObligationsStore((state) => state.error);
  const loadAll = useObligationsStore((state) => state.loadAll);
  const markPaid = useObligationsStore((state) => state.markPaid);
  const updateReminderStatus = useObligationsStore((state) => state.updateReminderStatus);
  const openAIWithCommand = useNavigationStore((state) => state.openAIWithCommand);

  useEffect(() => {
    void Promise.allSettled([loadAll(true), loadAccounts()]);
  }, [loadAccounts, loadAll]);

  const activeLoans = useMemo(() => loans.filter((loan) => loan.status !== 'closed'), [loans]);
  const loanRecords = useMemo(() => activeLoans.map((loan) => loanToRecord(loan, t)), [activeLoans, t]);
  const recurringRecords = useMemo(() => (summary?.recurringPayments ?? [])
    .filter((payment) => payment.isActive !== false)
    .map((payment) => recurringToRecord(payment, t)), [summary?.recurringPayments, t]);

  const allRecords = useMemo(() => [...loanRecords, ...recurringRecords], [loanRecords, recurringRecords]);
  const currentPayments = useMemo(() => allRecords.filter((payment) => payment.tab === tab), [allRecords, tab]);
  const scheduledReminders = reminders.filter((reminder) => reminder.status === 'scheduled');

  const tabMonthlyTotal = currentPayments.reduce((sum, item) => sum + item.amount, 0);
  const tabPaidTotal = currentPayments.reduce((sum, item) => sum + item.paid, 0);
  const tabDebtTotal = currentPayments.reduce((sum, item) => sum + item.debt, 0);
  const tabProgress = clampProgress(tabPaidTotal / Math.max(tabPaidTotal + tabDebtTotal, 1) * 100);
  const nearestPayment = useMemo(() => {
    return currentPayments
      .filter((payment) => payment.nextDate)
      .sort((a, b) => amount(a.daysUntil) - amount(b.daysUntil))[0] ?? null;
  }, [currentPayments]);

  const openCreate = () => openAIWithCommand(createCommand(tab, t));
  const openEdit = (record: PaymentRecord) => openAIWithCommand(editCommand(record, t));
  const openPaidWithFina = (record: PaymentRecord) => openAIWithCommand(paidCommand(record, t));

  const renderPayment = (payment: PaymentRecord) => {
    const isDebt = payment.tab === 'credit' || payment.tab === 'installment';
    const dateText = payment.nextDate ? formatTransactionDate(payment.nextDate) : t('payments.card.noDate');
    const sideMeta = payment.source === 'recurring'
      ? periodLabel(payment.rawRecurring?.period, t)
      : payment.accountName || t('payments.card.noAccount');

    return (
      <article key={`${payment.source}-${payment.id}`} className="app-card app-payment-row">
        <div className="app-payment-row__head">
          <div>
            <span>{payment.eyebrow}</span>
            <h3>{payment.title}</h3>
            <p>{dateText} · {daysLabel(payment.daysUntil, t)}</p>
          </div>
          <strong>{formatMoney(payment.amount, payment.currency)}</strong>
        </div>

        {isDebt ? (
          <>
            <div className="app-payment-progress"><span style={{ width: `${payment.progress}%` }} /></div>
            <div className="app-payment-meta">
              <span>{t('payments.card.paidAmount', { amount: formatMoney(payment.paid, payment.currency) })}</span>
              <span>{t('payments.card.debt', { amount: formatMoney(payment.debt, payment.currency) })}</span>
              <span>{t('payments.card.paidPercent', { percent: payment.progress })}</span>
            </div>
          </>
        ) : (
          <div className="app-payment-meta app-payment-meta--plain">
            <span>{t('payments.card.regular')}</span>
            <span>{payment.accountName || t('payments.card.noAccount')}</span>
            <span>{sideMeta}</span>
          </div>
        )}

        <div className="app-payment-actions">
          <button type="button" className="app-secondary-button" onClick={() => openEdit(payment)}>{t('payments.action.editWithFina')}</button>
          {payment.source === 'loan' ? (
            <button type="button" className="app-primary-button" disabled={isMutating} onClick={() => payment.rawLoan ? markPaid(payment.rawLoan.id) : openPaidWithFina(payment)}>{t('payments.action.paid')}</button>
          ) : (
            <button type="button" className="app-primary-button" onClick={() => openPaidWithFina(payment)}>{t('payments.action.paidWithFina')}</button>
          )}
        </div>
      </article>
    );
  };

  return (
    <div className="app-page app-payments-page text-white">
      <div className="app-page__inner app-payments-shell">
        <ScreenTopBar title={t('screen.payments')} left="back" right={['notifications', 'home']} />

        <header className="app-card app-payments-hero">
          <div className="app-payments-hero__topline">
            <span className="app-eyebrow">{t('payments.hero.eyebrow')}</span>
            <span className="app-payments-ai-pill">{t('payments.hero.aiOnly')}</span>
          </div>
          <div className="app-payments-hero__main">
            <div>
              <h1 className="app-hero-title">{t('payments.hero.title')}</h1>
              <p className="app-hero-caption">{t('payments.hero.caption')}</p>
            </div>
            <button type="button" className="app-payments-add" onClick={openCreate} aria-label={t('payments.action.add')}>+</button>
          </div>
          <div className="app-payments-tabs" role="tablist" aria-label={t('screen.payments')}>
            {tabs.map((item) => (
              <button key={item} type="button" data-active={tab === item} onClick={() => setTab(item)}>{tabTitle(item, t)}</button>
            ))}
          </div>
        </header>

        <section className="app-payments-kpi" aria-label={t('payments.summary.title')}>
          <article className="app-card">
            <span>{t('payments.kpi.month')}</span>
            <strong>{formatMoney(tabMonthlyTotal, 'RUB')}</strong>
            <small>{t('payments.kpi.items', { count: currentPayments.length })}</small>
          </article>
          <article className="app-card">
            <span>{t('payments.kpi.paid')}</span>
            <strong>{formatMoney(tabPaidTotal, 'RUB')}</strong>
            <small>{tab === 'subscription' || tab === 'other' ? t('payments.kpi.regular') : t('payments.kpi.fact')}</small>
          </article>
          <article className="app-card">
            <span>{tab === 'subscription' || tab === 'other' ? t('payments.kpi.nearest') : t('payments.kpi.left')}</span>
            <strong>{tab === 'subscription' || tab === 'other' ? String(currentPayments.filter((item) => item.nextDate).length) : formatMoney(tabDebtTotal, 'RUB')}</strong>
            <small>{tab === 'subscription' || tab === 'other' ? t('payments.kpi.withDate') : t('payments.kpi.balance')}</small>
          </article>
        </section>

        <section className="app-card app-payments-focus">
          <div className="app-payments-focus__copy">
            <span className="app-eyebrow">{t('payments.focus.eyebrow')}</span>
            <h2>{tabFocusTitle(tab, t)}</h2>
            <p>{tabFocusCaption(tab, t)}</p>
          </div>
          <div className="app-payments-ring" style={{ '--value': `${tab === 'subscription' || tab === 'other' ? Math.min(100, currentPayments.length * 16) : tabProgress}%` } as CSSProperties}>
            <strong>{tab === 'subscription' || tab === 'other' ? currentPayments.length : `${tabProgress}%`}</strong>
            <span>{tab === 'subscription' || tab === 'other' ? t('payments.focus.items') : t('payments.focus.closed')}</span>
          </div>
        </section>

        {nearestPayment ? (
          <section className="app-card app-payments-nearest">
            <div>
              <span>{t('payments.nearest.eyebrow')}</span>
              <h2>{nearestPayment.title}</h2>
              <p>{nearestPayment.nextDate ? formatTransactionDate(nearestPayment.nextDate) : t('payments.card.noDate')} · {daysLabel(nearestPayment.daysUntil, t)}</p>
            </div>
            <strong>{formatMoney(nearestPayment.amount, nearestPayment.currency)}</strong>
          </section>
        ) : null}

        <section className="app-card app-payments-fina">
          <div>
            <span className="app-eyebrow">{t('payments.fina.eyebrow')}</span>
            <p>{t('payments.fina.caption')}</p>
          </div>
          <button type="button" onClick={openCreate}>{t('payments.action.addWithFina')}</button>
        </section>

        {error ? <div className="app-error-box">{error}</div> : null}

        {isLoading ? (
          <div className="app-card app-payments-loading">{t('common.loading')}</div>
        ) : currentPayments.length === 0 ? (
          <EmptyState
            eyebrow={tabTitle(tab, t)}
            title={t('payments.empty.title')}
            description={tabEmptyCaption(tab, t)}
            actionLabel={t('payments.action.addWithFina')}
            onAction={openCreate}
          />
        ) : (
          <section className="app-payments-list" aria-label={tabTitle(tab, t)}>
            <div className="app-payments-section-head">
              <div>
                <span className="app-eyebrow">{t('payments.list.eyebrow')}</span>
                <h2>{tabTitle(tab, t)}</h2>
              </div>
              <small>{t('payments.list.caption')}</small>
            </div>
            {currentPayments.map(renderPayment)}
          </section>
        )}

        <section className="app-card app-payments-reminders">
          <div className="app-payments-reminders__head">
            <div>
              <span>{t('payments.reminders.eyebrow')}</span>
              <h2>{t('payments.reminders.title')}</h2>
            </div>
            <strong>{scheduledReminders.length}</strong>
          </div>
          {scheduledReminders.length === 0 ? (
            <p>{t('payments.reminders.empty')}</p>
          ) : (
            <div className="app-payments-reminder-list">
              {scheduledReminders.slice(0, 4).map((reminder) => (
                <div key={reminder.id} className="app-payments-reminder-row">
                  <div>
                    <strong>{reminder.title}</strong>
                    <small>{formatTransactionDate(reminder.remindAt)} · {formatTransactionDate(reminder.dueDate)}</small>
                  </div>
                  <button type="button" className="app-secondary-button" disabled={isMutating} onClick={() => updateReminderStatus(reminder.id, 'done')}>{t('payments.action.done')}</button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
