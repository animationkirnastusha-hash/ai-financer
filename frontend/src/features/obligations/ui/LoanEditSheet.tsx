import { useEffect, useMemo, useState } from 'react';
import { Drawer } from '@/shared/ui/Drawer';
import type { AccountDto } from '@/features/accounts/api/accounts.api';
import type { CreateLoanPayload, LoanDto, LoanType } from '@/features/obligations/api/obligations.api';

const loanTypes: Array<{ value: LoanType; label: string; hint: string }> = [
  { value: 'loan', label: 'Кредит', hint: 'Остаток, платёж, ставка' },
  { value: 'mortgage', label: 'Ипотека', hint: 'Долг, срок, ставка' },
  { value: 'installment', label: 'Рассрочка', hint: 'Сумма и срок' },
  { value: 'subscription', label: 'Подписка', hint: 'Сервис и списание' },
  { value: 'other', label: 'Другое', hint: 'Регулярный платёж' },
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
  const isDebtLike = type === 'loan' || type === 'mortgage' || type === 'installment';
  const isCreditLike = type === 'loan' || type === 'mortgage';
  const isInstallment = type === 'installment';
  const isSubscription = type === 'subscription';
  const isOther = type === 'other';

  async function handleSave() {
    setError(null);
    if (!title.trim()) {
      setError(isSubscription ? 'Укажи название подписки.' : 'Укажи название обязательства.');
      return;
    }

    const payment = toNumber(monthlyPayment);
    if ((isSubscription || isOther) && !payment) {
      setError('Укажи сумму регулярного платежа.');
      return;
    }

    const payload: CreateLoanPayload = {
      title: title.trim(),
      type,
      creditor: creditor.trim() || null,
      currency,
      principalAmount: isDebtLike ? toNumber(principalAmount) : undefined,
      currentDebt: isDebtLike ? toNumber(currentDebt) : undefined,
      monthlyPayment: payment,
      interestRate: isCreditLike ? (toNumber(interestRate) ?? null) : null,
      termMonths: isDebtLike ? (toNumber(termMonths) ?? null) : null,
      paidMonths: isDebtLike ? toNumber(paidMonths) : undefined,
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

  const typeMeta = loanTypes.find((item) => item.value === type) ?? loanTypes[0];

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={loan ? 'Изменить обязательство' : 'Новое обязательство'}
      subtitle="Настройки меняются под выбранный тип. Лишних полей не будет."
      className="app-obligation-sheet"
      bodyClassName="app-obligation-sheet__body"
      footer={(
        <div className="app-obligation-footer">
          {loan && onDelete ? (
            <button type="button" className="app-danger-button" disabled={isSaving} onClick={() => onDelete(loan)}>
              Удалить
            </button>
          ) : null}
          <button type="button" className="app-secondary-button" onClick={onClose} disabled={isSaving}>Отмена</button>
          <button type="button" className="app-primary-button" onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Сохраняю...' : 'Сохранить'}
          </button>
        </div>
      )}
    >
      <div className="app-obligation-form">
        {error ? <div className="app-error-box app-obligation-error">{error}</div> : null}

        <section className="app-obligation-section">
          <div className="app-obligation-type-grid" aria-label="Тип обязательства">
            {loanTypes.map((item) => (
              <button
                key={item.value}
                type="button"
                className={item.value === type ? 'app-obligation-type app-obligation-type--active' : 'app-obligation-type'}
                onClick={() => setType(item.value)}
                disabled={isSaving}
              >
                <strong>{item.label}</strong>
                <small>{item.hint}</small>
              </button>
            ))}
          </div>
        </section>

        <section className="app-obligation-section app-obligation-section--main">
          <div className="app-obligation-section__head">
            <strong>{typeMeta.label}</strong>
            <span>{typeMeta.hint}</span>
          </div>

          <label className="app-field app-obligation-field app-obligation-field--wide">
            <span>{isSubscription ? 'Название подписки' : 'Название'}</span>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder={isSubscription ? 'Netflix, Spotify, связь' : 'Ипотека, автокредит, рассрочка'}
            />
          </label>

          <div className="app-obligation-grid app-obligation-grid--2">
            <label className="app-field app-obligation-field">
              <span>{isSubscription ? 'Сервис' : 'Банк / организация'}</span>
              <input
                value={creditor}
                onChange={(event) => setCreditor(event.target.value)}
                placeholder={isSubscription ? 'Онлайн-кинотеатр' : 'Сбер, Т-Банк, магазин'}
              />
            </label>

            <label className="app-field app-obligation-field app-obligation-field--short">
              <span>Валюта</span>
              <select value={currency} onChange={(event) => setCurrency(event.target.value)}>
                <option value="RUB">RUB</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
              </select>
            </label>
          </div>
        </section>

        <section className="app-obligation-section">
          <div className="app-obligation-section__head">
            <strong>{isSubscription || isOther ? 'Платёж' : 'Суммы и долг'}</strong>
            <span>{isSubscription ? 'Без остатка и ставки' : 'Основные цифры'}</span>
          </div>

          <div className={isDebtLike ? 'app-obligation-grid app-obligation-grid--3' : 'app-obligation-grid app-obligation-grid--2'}>
            {isDebtLike ? (
              <label className="app-field app-obligation-field app-obligation-field--short">
                <span>Остаток</span>
                <input inputMode="numeric" value={currentDebt} onChange={(event) => setCurrentDebt(event.target.value)} placeholder="500000" />
              </label>
            ) : null}

            <label className="app-field app-obligation-field app-obligation-field--short">
              <span>{isSubscription ? 'Списание' : 'Платёж'}</span>
              <input inputMode="numeric" value={monthlyPayment} onChange={(event) => setMonthlyPayment(event.target.value)} placeholder={isSubscription ? '899' : '18000'} />
            </label>

            {isDebtLike ? (
              <label className="app-field app-obligation-field app-obligation-field--short">
                <span>Общая сумма</span>
                <input inputMode="numeric" value={principalAmount} onChange={(event) => setPrincipalAmount(event.target.value)} placeholder="700000" />
              </label>
            ) : null}
          </div>
        </section>

        {isDebtLike ? (
          <section className="app-obligation-section">
            <div className="app-obligation-section__head">
              <strong>{isInstallment ? 'Срок рассрочки' : 'Условия'}</strong>
              <span>{isCreditLike ? 'Для будущих советов Фины' : 'Сколько уже оплачено'}</span>
            </div>

            <div className={isCreditLike ? 'app-obligation-grid app-obligation-grid--3' : 'app-obligation-grid app-obligation-grid--2'}>
              {isCreditLike ? (
                <label className="app-field app-obligation-field app-obligation-field--short">
                  <span>Ставка, %</span>
                  <input inputMode="decimal" value={interestRate} onChange={(event) => setInterestRate(event.target.value)} placeholder="12.9" />
                </label>
              ) : null}

              <label className="app-field app-obligation-field app-obligation-field--short">
                <span>Срок</span>
                <input inputMode="numeric" value={termMonths} onChange={(event) => setTermMonths(event.target.value)} placeholder="36" />
              </label>

              <label className="app-field app-obligation-field app-obligation-field--short">
                <span>Оплачено</span>
                <input inputMode="numeric" value={paidMonths} onChange={(event) => setPaidMonths(event.target.value)} placeholder="4" />
              </label>
            </div>
          </section>
        ) : null}

        <section className="app-obligation-section">
          <div className="app-obligation-section__head">
            <strong>График и напоминание</strong>
            <span>Когда списывать и когда напомнить</span>
          </div>

          <div className="app-obligation-grid app-obligation-grid--3">
            <label className="app-field app-obligation-field app-obligation-field--short">
              <span>День</span>
              <input inputMode="numeric" value={paymentDay} onChange={(event) => setPaymentDay(event.target.value)} placeholder="15" />
            </label>

            <label className="app-field app-obligation-field">
              <span>Ближайший</span>
              <input type="date" value={nextPaymentDate} onChange={(event) => setNextPaymentDate(event.target.value)} />
            </label>

            <label className="app-field app-obligation-field app-obligation-field--short">
              <span>За дней</span>
              <input inputMode="numeric" value={reminderDaysBefore} onChange={(event) => setReminderDaysBefore(event.target.value)} placeholder="1" />
            </label>
          </div>
        </section>

        <section className="app-obligation-section">
          <div className="app-obligation-grid app-obligation-grid--2">
            <label className="app-field app-obligation-field">
              <span>Счёт списания</span>
              <select value={accountId} onChange={(event) => setAccountId(event.target.value)}>
                <option value="">Не выбран</option>
                {accountOptions.map((account) => (
                  <option key={account.id} value={account.id}>{account.name} · {account.currency}</option>
                ))}
              </select>
            </label>

            <label className="app-checkbox-card app-obligation-checkbox">
              <input type="checkbox" checked={autoCreateExpense} onChange={(event) => setAutoCreateExpense(event.target.checked)} />
              <span>
                <strong>Списывать как расход</strong>
                <small>При отметке оплаты</small>
              </span>
            </label>
          </div>
        </section>

        <label className="app-field app-obligation-field app-obligation-note">
          <span>Заметка</span>
          <textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Например: гасить досрочно при возможности" />
        </label>
      </div>
    </Drawer>
  );
}
