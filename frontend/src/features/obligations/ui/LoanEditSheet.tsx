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
  initialType?: LoanType | null;
  accounts: AccountDto[];
  isSaving: boolean;
  layer?: number;
  onClose: () => void;
  onSave: (payload: CreateLoanPayload) => Promise<void>;
  onDelete?: (loan: LoanDto) => Promise<void>;
};

export function LoanEditSheet({ open, loan, initialType, accounts, isSaving, layer, onClose, onSave, onDelete }: Props) {
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
    setType((loan?.type as LoanType) ?? initialType ?? 'loan');
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
  }, [initialType, loan, open]);

  const accountOptions = useMemo(() => accounts.filter((account) => !account.lockSpending), [accounts]);

  const typeMeta = useMemo(() => {
    if (type === 'subscription') {
      return {
        titlePlaceholder: 'Netflix, связь, сервис',
        creditorLabel: 'Сервис',
        creditorPlaceholder: 'Netflix, Telegram, оператор связи',
        paymentLabel: 'Сумма подписки',
        paymentPlaceholder: '899',
        notePlaceholder: 'Например: списывается каждый месяц автоматически',
        description: 'Для подписки достаточно суммы платежа, даты списания и счёта. Остаток долга и ставка здесь не нужны.',
        showDebt: false,
        showPrincipal: false,
        showCreditTerms: false,
        showPaidMonths: false,
      };
    }

    if (type === 'installment') {
      return {
        titlePlaceholder: 'Телефон, техника, обучение',
        creditorLabel: 'Магазин или сервис',
        creditorPlaceholder: 'Магазин, банк, сервис рассрочки',
        paymentLabel: 'Ежемесячный платёж',
        paymentPlaceholder: '4500',
        notePlaceholder: 'Например: беспроцентная рассрочка на 12 месяцев',
        description: 'Для рассрочки важны платёж, остаток, срок и сколько месяцев уже оплачено.',
        showDebt: true,
        showPrincipal: true,
        showCreditTerms: true,
        showPaidMonths: true,
      };
    }

    if (type === 'other') {
      return {
        titlePlaceholder: 'Аренда, алименты, регулярный платёж',
        creditorLabel: 'Получатель',
        creditorPlaceholder: 'Кому или куда платишь',
        paymentLabel: 'Сумма платежа',
        paymentPlaceholder: '12000',
        notePlaceholder: 'Например: обязательный платёж каждый месяц',
        description: 'Для регулярного платежа можно указать только сумму, дату, счёт и напоминание.',
        showDebt: false,
        showPrincipal: false,
        showCreditTerms: false,
        showPaidMonths: false,
      };
    }

    return {
      titlePlaceholder: type === 'mortgage' ? 'Ипотека Дом' : 'Автокредит, кредит наличными',
      creditorLabel: 'Банк',
      creditorPlaceholder: 'Сбер, Т-Банк, ВТБ',
      paymentLabel: 'Ежемесячный платёж',
      paymentPlaceholder: '18000',
      notePlaceholder: 'Например: досрочно гасить тело кредита при возможности',
      description: type === 'mortgage'
        ? 'Для ипотеки полезны остаток, ставка, срок и дата платежа. Это поможет позже считать переплату и сценарии досрочного погашения.'
        : 'Для кредита полезны остаток, общая сумма, ставка, срок и дата платежа.',
      showDebt: true,
      showPrincipal: true,
      showCreditTerms: true,
      showPaidMonths: true,
    };
  }, [type]);

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
      principalAmount: typeMeta.showPrincipal ? toNumber(principalAmount) : undefined,
      currentDebt: typeMeta.showDebt ? toNumber(currentDebt) : undefined,
      monthlyPayment: toNumber(monthlyPayment),
      interestRate: typeMeta.showCreditTerms ? toNumber(interestRate) ?? null : null,
      termMonths: typeMeta.showCreditTerms ? toNumber(termMonths) ?? null : null,
      paidMonths: typeMeta.showPaidMonths ? toNumber(paidMonths) : undefined,
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
      layer={layer}
      subtitle={typeMeta.description}
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
          <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder={typeMeta.titlePlaceholder} />
        </label>

        <label className="app-field">
          <span>Тип</span>
          <select value={type} onChange={(event) => setType(event.target.value as LoanType)}>
            {loanTypes.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </label>

        <label className="app-field">
          <span>{typeMeta.creditorLabel}</span>
          <input value={creditor} onChange={(event) => setCreditor(event.target.value)} placeholder={typeMeta.creditorPlaceholder} />
        </label>

        <div className="app-obligation-type-note">{typeMeta.description}</div>

        <div className="app-form-row">
          {typeMeta.showDebt ? (
            <label className="app-field">
              <span>Остаток</span>
              <input inputMode="numeric" value={currentDebt} onChange={(event) => setCurrentDebt(event.target.value)} placeholder="500000" />
            </label>
          ) : null}
          <label className="app-field">
            <span>{typeMeta.paymentLabel}</span>
            <input inputMode="numeric" value={monthlyPayment} onChange={(event) => setMonthlyPayment(event.target.value)} placeholder={typeMeta.paymentPlaceholder} />
          </label>
        </div>

        <div className="app-form-row">
          {typeMeta.showPrincipal ? (
            <label className="app-field">
              <span>Общая сумма</span>
              <input inputMode="numeric" value={principalAmount} onChange={(event) => setPrincipalAmount(event.target.value)} placeholder="700000" />
            </label>
          ) : null}
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
          {typeMeta.showCreditTerms ? (
            <label className="app-field">
              <span>Ставка, %</span>
              <input inputMode="decimal" value={interestRate} onChange={(event) => setInterestRate(event.target.value)} placeholder="12.9" />
            </label>
          ) : null}
        </div>

        {typeMeta.showCreditTerms || typeMeta.showPaidMonths ? (
          <div className="app-form-row">
            {typeMeta.showCreditTerms ? (
              <label className="app-field">
                <span>Срок, месяцев</span>
                <input inputMode="numeric" value={termMonths} onChange={(event) => setTermMonths(event.target.value)} placeholder="36" />
              </label>
            ) : null}
            {typeMeta.showPaidMonths ? (
              <label className="app-field">
                <span>Уже оплачено</span>
                <input inputMode="numeric" value={paidMonths} onChange={(event) => setPaidMonths(event.target.value)} placeholder="4" />
              </label>
            ) : null}
          </div>
        ) : null}

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
          <textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder={typeMeta.notePlaceholder} />
        </label>
      </div>
    </Drawer>
  );
}
