import { useEffect, useMemo, useState } from 'react';
import { useAccountsStore } from '@/features/accounts/model/accounts.store';
import { useObligationsStore } from '@/features/obligations/model/obligations.store';
import { LoanEditSheet } from '@/features/obligations/ui/LoanEditSheet';
import type { CreateLoanPayload, LoanDto } from '@/features/obligations/api/obligations.api';
import { ScreenTopBar } from '@/shared/ui/ScreenTopBar';
import { EmptyState } from '@/shared/ui/EmptyState';
import { formatMoney, formatTransactionDate } from '@/shared/lib/money';

function loanTypeLabel(type: string) {
  if (type === 'mortgage') return 'Ипотека';
  if (type === 'installment') return 'Рассрочка';
  if (type === 'subscription') return 'Подписка';
  if (type === 'other') return 'Другое';
  return 'Кредит';
}

function daysLabel(value?: number | null) {
  if (value == null) return 'дата не указана';
  if (value < 0) return `просрочено на ${Math.abs(value)} дн.`;
  if (value === 0) return 'сегодня';
  if (value === 1) return 'завтра';
  return `через ${value} дн.`;
}

export default function ObligationsPage() {
  const accounts = useAccountsStore((state) => state.items);
  const loadAccounts = useAccountsStore((state) => state.loadAccounts);
  const loans = useObligationsStore((state) => state.loans);
  const reminders = useObligationsStore((state) => state.reminders);
  const summary = useObligationsStore((state) => state.summary);
  const isLoading = useObligationsStore((state) => state.isLoading);
  const isMutating = useObligationsStore((state) => state.isMutating);
  const error = useObligationsStore((state) => state.error);
  const loadAll = useObligationsStore((state) => state.loadAll);
  const createLoan = useObligationsStore((state) => state.createLoan);
  const updateLoan = useObligationsStore((state) => state.updateLoan);
  const deleteLoan = useObligationsStore((state) => state.deleteLoan);
  const markPaid = useObligationsStore((state) => state.markPaid);
  const updateReminderStatus = useObligationsStore((state) => state.updateReminderStatus);

  const [editingLoan, setEditingLoan] = useState<LoanDto | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);

  useEffect(() => {
    void Promise.allSettled([loadAll(true), loadAccounts()]);
  }, [loadAccounts, loadAll]);

  const activeLoans = useMemo(() => loans.filter((loan) => loan.status !== 'closed'), [loans]);
  const closedLoans = useMemo(() => loans.filter((loan) => loan.status === 'closed'), [loans]);
  const scheduledReminders = reminders.filter((reminder) => reminder.status === 'scheduled');

  const handleCreate = () => {
    setEditingLoan(null);
    setIsEditorOpen(true);
  };

  const handleSave = async (payload: CreateLoanPayload) => {
    if (editingLoan) {
      await updateLoan(editingLoan.id, payload);
      return;
    }
    await createLoan(payload);
  };

  const handleDelete = async (loan: LoanDto) => {
    const confirmed = window.confirm(`Удалить «${loan.title}»? Платежи и напоминания по нему тоже будут удалены.`);
    if (!confirmed) return;
    await deleteLoan(loan.id);
    setIsEditorOpen(false);
    setEditingLoan(null);
  };

  return (
    <div className="app-page app-obligations-page text-white">
      <div className="app-page__inner space-y-4">
        <ScreenTopBar title="Обязательства" left="back" right={['home']} />

        <header className="app-card app-card--hero app-obligations-hero">
          <div className="app-eyebrow">Кредиты, рассрочки и подписки</div>
          <div className="app-obligations-hero__top">
            <div className="min-w-0">
              <h1 className="app-hero-title">Обязательства</h1>
              <p className="app-hero-caption">Следи за обязательными платежами и не держи даты в голове.</p>
            </div>
            <button type="button" className="app-primary-button shrink-0" onClick={handleCreate}>+ Добавить</button>
          </div>
          <div className="app-obligations-summary-grid">
            <div><strong>{summary?.activeLoansCount ?? activeLoans.length}</strong><small>активных</small></div>
            <div><strong>{formatMoney(summary?.monthlyPaymentTotal ?? 0, 'RUB')}</strong><small>в месяц</small></div>
            <div><strong>{formatMoney(summary?.totalDebt ?? 0, 'RUB')}</strong><small>остаток</small></div>
          </div>
        </header>

        {error ? <div className="app-error-box">{error}</div> : null}

        {summary?.nearest ? (
          <section className="app-card app-next-payment-card">
            <div className="app-next-payment-card__body">
              <div>
                <div className="app-eyebrow">Следующий платёж</div>
                <h2>{summary.nearest.title}</h2>
                <p>{formatTransactionDate(summary.nearest.nextPaymentDate)} · {daysLabel(summary.nearest.daysUntilPayment)}</p>
              </div>
              <strong>{formatMoney(summary.nearest.monthlyPayment, summary.nearest.currency)}</strong>
            </div>
            <div className="app-next-payment-card__actions">
              <button type="button" className="app-secondary-button" onClick={() => { setEditingLoan(summary.nearest); setIsEditorOpen(true); }}>Изменить</button>
              <button type="button" className="app-primary-button" disabled={isMutating} onClick={() => markPaid(summary.nearest!.id)}>Оплатил</button>
            </div>
          </section>
        ) : null}

        {isLoading ? (
          <div className="app-card p-5 text-sm text-white/55">Загружаю обязательства...</div>
        ) : activeLoans.length === 0 ? (
          <EmptyState
            eyebrow="Обязательства"
            title="Платежей пока нет"
            description="Добавь кредит, ипотеку, рассрочку или подписку. Фина будет держать срок платежа рядом."
            actionLabel="Добавить"
            onAction={handleCreate}
          />
        ) : (
          <div className="space-y-3">
            {activeLoans.map((loan) => (
              <article key={loan.id} className="app-loan-card">
                <button type="button" className="app-loan-card__main" onClick={() => { setEditingLoan(loan); setIsEditorOpen(true); }}>
                  <div className="app-loan-card__head">
                    <div className="min-w-0">
                      <div className="app-loan-card__type">{loanTypeLabel(loan.type)}{loan.creditor ? ` · ${loan.creditor}` : ''}</div>
                      <h3>{loan.title}</h3>
                      <p>{loan.nextPaymentDate ? formatTransactionDate(loan.nextPaymentDate) : 'Дата платежа не указана'} · {daysLabel(loan.daysUntilPayment)}</p>
                    </div>
                    <strong>{formatMoney(loan.monthlyPayment, loan.currency)}</strong>
                  </div>
                  <div className="app-loan-progress"><span style={{ width: `${Math.max(0, Math.min(100, loan.progress || 0))}%` }} /></div>
                  <div className="app-loan-card__meta">
                    <span>Остаток: {formatMoney(loan.currentDebt, loan.currency)}</span>
                    <span>{loan.progress || 0}% закрыто</span>
                  </div>
                </button>
                <div className="app-loan-card__actions">
                  <button type="button" className="app-secondary-button" onClick={() => { setEditingLoan(loan); setIsEditorOpen(true); }}>Подробнее</button>
                  <button type="button" className="app-primary-button" disabled={isMutating} onClick={() => markPaid(loan.id)}>Оплатил</button>
                </div>
              </article>
            ))}
          </div>
        )}

        <section className="app-card app-reminders-card">
          <div className="app-reminders-card__head">
            <div>
              <div className="app-eyebrow">Напоминания</div>
              <h2>Ближайшие</h2>
            </div>
            <span>{scheduledReminders.length}</span>
          </div>
          {scheduledReminders.length === 0 ? (
            <p className="app-muted-text">Напоминаний пока нет. Они появятся после добавления обязательства с датой платежа.</p>
          ) : (
            <div className="app-reminders-list">
              {scheduledReminders.slice(0, 6).map((reminder) => (
                <div key={reminder.id} className="app-reminder-row">
                  <div>
                    <strong>{reminder.title}</strong>
                    <small>{formatTransactionDate(reminder.remindAt)} · платёж {formatTransactionDate(reminder.dueDate)}</small>
                  </div>
                  <button type="button" className="app-secondary-button" disabled={isMutating} onClick={() => updateReminderStatus(reminder.id, 'done')}>Готово</button>
                </div>
              ))}
            </div>
          )}
        </section>

        {closedLoans.length > 0 ? (
          <section className="app-card app-closed-loans-card">
            <div className="app-eyebrow">Закрытые</div>
            <p>{closedLoans.length} обязательств закрыто. Они не участвуют в ближайших платежах.</p>
          </section>
        ) : null}
      </div>

      <LoanEditSheet
        open={isEditorOpen}
        loan={editingLoan}
        accounts={accounts}
        isSaving={isMutating}
        onClose={() => { setIsEditorOpen(false); setEditingLoan(null); }}
        onSave={handleSave}
        onDelete={handleDelete}
      />
    </div>
  );
}
