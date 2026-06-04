import { useEffect, useMemo, useState } from 'react';
import { Drawer } from '@/shared/ui/Drawer';
import type { AccountDto } from '@/features/accounts/api/accounts.api';
import type { CreateLoanPayload, LoanDto, LoanType } from '@/features/obligations/api/obligations.api';

const loanTypes: Array<{ value: LoanType; label: string }> = [
  { value: 'loan', label: 'Кредит' },
  { value: 'mortgage', label: 'Ипотека' },
  { value: 'installment', label: 'Рассрочка' },
  { value: 'subscription', label: 'Подписка' },
  { value: 'other', label: 'Другое' },
];

function toDateInput(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

function toNumber(value: string) {
  if (!value.trim()) return undefined;
  const normalized = value.replace(',', '.').replace(/\s+/g, '');
  const result = Number(normalized);
  return Number.isFinite(result) ? result : undefined;
}

type Props = {
  open: boolean;
  loan?: LoanDto | null;
  accounts: AccountDto[];
  isSaving: boolean;
  onClose: () => void;
  onSave: (payload: CreateLoanPayload) => Promise<void>;
  onDelete?: (loan: LoanDto) => Promise<void>;
};

export function LoanEditSheet({ open, loan, accounts, isSaving, onClose, onSave, onDelete }: Props) {
  const [title, setTitle] = useState('');
  const [type, setType] = useState<LoanType>('loan');
  const [creditor, setCreditor] = useState('');
  const [currency, setCurrency] = useState('RUB');
  const [principalAmount, setPrincipalAmount] = useState('');
  const [currentDebt, setCurrentDebt] = useState('');
  const [monthlyPayment, setMonthlyPayment] = useState('');
  const [interestRate, setInterestRate] = useState('');
  const [termMonths, setTermMonths] = useState('');
  const [paidMonths, setPaidMonths] = useState('');
  const [paymentDay, setPaymentDay] = useState('');
  const [nextPaymentDate, setNextPaymentDate] = useState('');
  const [reminderDaysBefore, setReminderDaysBefore] = useState('1');
  const [accountId, setAccountId] = useState('');
  const [autoCreateExpense, setAutoCreateExpense] = useState(false);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setTitle(loan?.title ?? '');
    setType((loan?.type as LoanType) ?? 'loan');
    setCreditor(loan?.creditor ?? '');
    setCurrency(loan?.currency ?? 'RUB');
    setPrincipalAmount(loan?.principalAmount ? String(loan.principalAmount) : '');
    setCurrentDebt(loan?.currentDebt ? String(loan.currentDebt) : '');
    setMonthlyPayment(loan?.monthlyPayment ? String(loan.monthlyPayment) : '');
    setInterestRate(loan?.interestRate != null ? String(loan.interestRate) : '');
    setTermMonths(loan?.termMonths ? String(loan.termMonths) : '');
    setPaidMonths(loan?.paidMonths ? String(loan.paidMonths) : '');
    setPaymentDay(loan?.paymentDay ? String(loan.paymentDay) : '');
    setNextPaymentDate(toDateInput(loan?.nextPaymentDate));
    setReminderDaysBefore(String(loan?.reminderDaysBefore ?? 1));
    setAccountId(loan?.accountId ?? '');
    setAutoCreateExpense(Boolean(loan?.autoCreateExpense));
    setNote(loan?.note ?? '');
    setError(null);
  }, [loan, open]);

  const accountOptions = useMemo(() => accounts.filter((account) => !account.lockSpending), [accounts]);

  async function handleSave() {
    setError(null);
    if (!title.trim()) {
      setError('Укажи название. Например: ипотека, автокредит или рассрочка.');
      return;
    }

    const payload: CreateLoanPayload = {
      title: title.trim(),
      type,
      creditor: creditor.trim() || null,
      currency,
      principalAmount: toNumber(principalAmount),
      currentDebt: toNumber(currentDebt),
      monthlyPayment: toNumber(monthlyPayment),
      interestRate: toNumber(interestRate) ?? null,
      termMonths: toNumber(termMonths) ?? null,
      paidMonths: toNumber(paidMonths),
      paymentDay: toNumber(paymentDay) ?? null,
      nextPaymentDate: nextPaymentDate ? new Date(`${nextPaymentDate}T09:00:00`).toISOString() : null,
      reminderDaysBefore: toNumber(reminderDaysBefore),
      accountId: accountId || null,
      autoCreateExpense,
      note: note.trim() || null,
    };

    try {
      await onSave(payload);
      onClose();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Не удалось сохранить обязательство');
    }
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={loan ? 'Изменить обязательство' : 'Новое обязательство'}
      subtitle="Кредит, ипотека, рассрочка, подписка или другой регулярный платёж."
      footer={(
        <>
          {loan && onDelete ? (
            <button type="button" className="app-danger-button" disabled={isSaving} onClick={() => onDelete(loan)}>
              Удалить
            </button>
          ) : null}
          <button type="button" className="app-secondary-button" onClick={onClose} disabled={isSaving}>Отмена</button>
          <button type="button" className="app-primary-button" onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Сохраняю...' : 'Сохранить'}
          </button>
        </>
      )}
    >
      <div className="app-form-grid">
        {error ? <div className="app-error-box">{error}</div> : null}

        <label className="app-field">
          <span>Название</span>
          <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Ипотека, автокредит, рассрочка" />
        </label>

        <label className="app-field">
          <span>Тип</span>
          <select value={type} onChange={(event) => setType(event.target.value as LoanType)}>
            {loanTypes.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </label>

        <label className="app-field">
          <span>Банк или сервис</span>
          <input value={creditor} onChange={(event) => setCreditor(event.target.value)} placeholder="Сбер, Т-Банк, магазин" />
        </label>

        <div className="app-form-row">
          <label className="app-field">
            <span>Остаток</span>
            <input inputMode="numeric" value={currentDebt} onChange={(event) => setCurrentDebt(event.target.value)} placeholder="500000" />
          </label>
          <label className="app-field">
            <span>Платёж</span>
            <input inputMode="numeric" value={monthlyPayment} onChange={(event) => setMonthlyPayment(event.target.value)} placeholder="18000" />
          </label>
        </div>

        <div className="app-form-row">
          <label className="app-field">
            <span>Общая сумма</span>
            <input inputMode="numeric" value={principalAmount} onChange={(event) => setPrincipalAmount(event.target.value)} placeholder="700000" />
          </label>
          <label className="app-field">
            <span>Валюта</span>
            <select value={currency} onChange={(event) => setCurrency(event.target.value)}>
              <option value="RUB">RUB</option>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
            </select>
          </label>
        </div>

        <div className="app-form-row">
          <label className="app-field">
            <span>День платежа</span>
            <input inputMode="numeric" value={paymentDay} onChange={(event) => setPaymentDay(event.target.value)} placeholder="15" />
          </label>
          <label className="app-field">
            <span>Следующий платёж</span>
            <input type="date" value={nextPaymentDate} onChange={(event) => setNextPaymentDate(event.target.value)} />
          </label>
        </div>

        <div className="app-form-row">
          <label className="app-field">
            <span>Напомнить за</span>
            <input inputMode="numeric" value={reminderDaysBefore} onChange={(event) => setReminderDaysBefore(event.target.value)} placeholder="1" />
          </label>
          <label className="app-field">
            <span>Ставка, %</span>
            <input inputMode="decimal" value={interestRate} onChange={(event) => setInterestRate(event.target.value)} placeholder="12.9" />
          </label>
        </div>

        <div className="app-form-row">
          <label className="app-field">
            <span>Срок, месяцев</span>
            <input inputMode="numeric" value={termMonths} onChange={(event) => setTermMonths(event.target.value)} placeholder="36" />
          </label>
          <label className="app-field">
            <span>Уже оплачено</span>
            <input inputMode="numeric" value={paidMonths} onChange={(event) => setPaidMonths(event.target.value)} placeholder="4" />
          </label>
        </div>

        <label className="app-field">
          <span>Счёт списания</span>
          <select value={accountId} onChange={(event) => setAccountId(event.target.value)}>
            <option value="">Не выбран</option>
            {accountOptions.map((account) => (
              <option key={account.id} value={account.id}>{account.name} · {account.currency}</option>
            ))}
          </select>
        </label>

        <label className="app-checkbox-card">
          <input type="checkbox" checked={autoCreateExpense} onChange={(event) => setAutoCreateExpense(event.target.checked)} />
          <span>
            <strong>Создавать расход при отметке оплаты</strong>
            <small>Если выбран счёт, Фина сможет сразу списывать платёж как расход.</small>
          </span>
        </label>

        <label className="app-field">
          <span>Заметка</span>
          <textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Например: досрочно гасить тело кредита при возможности" />
        </label>
      </div>
    </Drawer>
  );
}
