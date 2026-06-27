import { useEffect, useMemo, useState } from 'react';
import { useAccountsStore } from '@/features/accounts/model/accounts.store';
import { useObligationsStore } from '@/features/obligations/model/obligations.store';
import { useNavigationStore } from '@/features/navigation/model/navigation.store';
import { ScreenTopBar } from '@/shared/ui/ScreenTopBar';
import { EmptyState } from '@/shared/ui/EmptyState';
import { formatMoney, formatTransactionDate } from '@/shared/lib/money';
import { useI18n } from '@/shared/lib/i18n';
import type { LoanDto } from '@/features/obligations/api/obligations.api';

type PaymentTab = 'credit' | 'installment' | 'subscription' | 'other';

function daysLabel(value: number | null | undefined, t: (key: string, params?: Record<string, string | number>) => string) {
  if (value == null) return t('payments.date.empty');
  if (value < 0) return t('payments.date.overdue', { days: Math.abs(value) });
  if (value === 0) return t('payments.date.today');
  if (value === 1) return t('payments.date.tomorrow');
  return t('payments.date.afterDays', { days: value });
}

function paymentKind(type: string): PaymentTab {
  if (type === 'installment') return 'installment';
  if (type === 'subscription') return 'subscription';
  if (type === 'other') return 'other';
  return 'credit';
}

function paymentTabCommand(tab: PaymentTab) {
  if (tab === 'credit') return 'Добавь кредит. Спроси у меня сумму, платёж, дату и счёт списания';
  if (tab === 'installment') return 'Добавь рассрочку. Спроси сумму платежа, дату и счёт списания';
  if (tab === 'subscription') return 'Добавь подписку. Спроси название, сумму, дату списания и счёт';
  return 'Добавь регулярный платёж. Спроси что это, сумму, дату и счёт списания';
}

function tabTitle(tab: PaymentTab, t: (key: string) => string) {
  if (tab === 'credit') return t('payments.tab.credit');
  if (tab === 'installment') return t('payments.tab.installment');
  if (tab === 'subscription') return t('payments.tab.subscription');
  return t('payments.tab.other');
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

  const activePayments = useMemo(() => loans.filter((loan) => loan.status !== 'closed'), [loans]);
  const currentPayments = useMemo(() => activePayments.filter((loan) => paymentKind(String(loan.type)) === tab), [activePayments, tab]);
  const scheduledReminders = reminders.filter((reminder) => reminder.status === 'scheduled');
  const tabPaymentTotal = currentPayments.reduce((sum, item) => sum + (Number(item.monthlyPayment) || 0), 0);
  const paidTotal = currentPayments.reduce((sum, item) => sum + Math.max((Number(item.principalAmount) || 0) - (Number(item.currentDebt) || 0), 0), 0);
  const debtTotal = currentPayments.reduce((sum, item) => sum + (Number(item.currentDebt) || 0), 0);

  const renderPayment = (payment: LoanDto) => {
    const isCredit = paymentKind(String(payment.type)) === 'credit' || paymentKind(String(payment.type)) === 'installment';
    return (
      <article key={payment.id} className="app-card app-payment-row">
        <div className="app-payment-row__head">
          <div>
            <span>{payment.creditor || tabTitle(paymentKind(String(payment.type)), t)}</span>
            <h3>{payment.title}</h3>
            <p>{payment.nextPaymentDate ? formatTransactionDate(payment.nextPaymentDate) : t('payments.card.noDate')} · {daysLabel(payment.daysUntilPayment, t)}</p>
          </div>
          <strong>{formatMoney(payment.monthlyPayment, payment.currency)}</strong>
        </div>
        {isCredit ? (
          <>
            <div className="app-payment-progress"><span style={{ width: `${Math.max(0, Math.min(100, payment.progress || 0))}%` }} /></div>
            <div className="app-payment-meta">
              <span>{t('payments.card.debt', { amount: formatMoney(payment.currentDebt, payment.currency) })}</span>
              <span>{t('payments.card.paidPercent', { percent: payment.progress || 0 })}</span>
            </div>
          </>
        ) : (
          <div className="app-payment-meta app-payment-meta--plain">
            <span>{t('payments.card.regular')}</span>
            <span>{payment.account ? payment.account.name : t('payments.card.noAccount')}</span>
          </div>
        )}
        <div className="app-payment-actions">
          <button type="button" className="app-secondary-button" onClick={() => openAIWithCommand(`Измени платёж ${payment.title}`)}>{t('payments.action.editWithFina')}</button>
          <button type="button" className="app-primary-button" disabled={isMutating} onClick={() => markPaid(payment.id)}>{t('payments.action.paid')}</button>
        </div>
      </article>
    );
  };

  return (
    <div className="app-page app-payments-page text-white">
      <div className="app-page__inner app-payments-shell">
        <ScreenTopBar title={t('screen.payments')} left="back" right={['notifications', 'home']} />

        <header className="app-card app-payments-hero">
          <div className="app-eyebrow">{t('payments.hero.eyebrow')}</div>
          <div className="app-payments-hero__main">
            <div>
              <h1 className="app-hero-title">{t('payments.hero.title')}</h1>
              <p className="app-hero-caption">{t('payments.hero.caption')}</p>
            </div>
            <button type="button" className="app-payments-add" onClick={() => openAIWithCommand(paymentTabCommand(tab))} aria-label={t('payments.action.add')}>+</button>
          </div>
          <div className="app-payments-tabs" role="tablist" aria-label={t('screen.payments')}>
            <button type="button" data-active={tab === 'credit'} onClick={() => setTab('credit')}>{t('payments.tab.credit')}</button>
            <button type="button" data-active={tab === 'installment'} onClick={() => setTab('installment')}>{t('payments.tab.installment')}</button>
            <button type="button" data-active={tab === 'subscription'} onClick={() => setTab('subscription')}>{t('payments.tab.subscription')}</button>
            <button type="button" data-active={tab === 'other'} onClick={() => setTab('other')}>{t('payments.tab.other')}</button>
          </div>
        </header>

        <section className="app-payments-kpi" aria-label={t('payments.summary.title')}>
          <article className="app-card"><span>{t('payments.kpi.month')}</span><strong>{formatMoney(tabPaymentTotal, 'RUB')}</strong><small>{currentPayments.length}</small></article>
          <article className="app-card"><span>{t('payments.kpi.paid')}</span><strong>{formatMoney(paidTotal, 'RUB')}</strong><small>{t('payments.kpi.fact')}</small></article>
          <article className="app-card"><span>{t('payments.kpi.left')}</span><strong>{formatMoney(debtTotal, 'RUB')}</strong><small>{t('payments.kpi.balance')}</small></article>
        </section>

        {summary?.nearest ? (
          <section className="app-card app-payments-nearest">
            <div>
              <span>{t('payments.nearest.eyebrow')}</span>
              <h2>{summary.nearest.title}</h2>
              <p>{summary.nearest.nextPaymentDate ? formatTransactionDate(summary.nearest.nextPaymentDate) : t('payments.card.noDate')} · {daysLabel(summary.nearest.daysUntilPayment, t)}</p>
            </div>
            <strong>{formatMoney(summary.nearest.monthlyPayment, summary.nearest.currency)}</strong>
          </section>
        ) : null}

        {error ? <div className="app-error-box">{error}</div> : null}

        {isLoading ? (
          <div className="app-card app-payments-loading">{t('common.loading')}</div>
        ) : currentPayments.length === 0 ? (
          <EmptyState
            eyebrow={tabTitle(tab, t)}
            title={t('payments.empty.title')}
            description={t('payments.empty.caption')}
            actionLabel={t('payments.action.addWithFina')}
            onAction={() => openAIWithCommand(paymentTabCommand(tab))}
          />
        ) : (
          <div className="app-payments-list">
            {currentPayments.map(renderPayment)}
          </div>
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
