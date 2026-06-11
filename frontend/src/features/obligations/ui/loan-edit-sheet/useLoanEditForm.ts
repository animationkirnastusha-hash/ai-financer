import { useEffect, useMemo, useState } from 'react';
import type { AccountDto } from '@/features/accounts/api/accounts.api';
import type { CreateLoanPayload, LoanDto, LoanType } from '@/features/obligations/api/obligations.api';
import { toDateInput, toNumber } from './loanEditSheet.helpers';

export type UseLoanEditFormParams = {
  open: boolean;
  loan?: LoanDto | null;
  initialType?: LoanType | null;
  accounts: AccountDto[];
  onSave: (payload: CreateLoanPayload) => Promise<void>;
  onClose: () => void;
};

export function useLoanEditForm({ open, loan, initialType, accounts, onSave, onClose }: UseLoanEditFormParams) {
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

  return {
    state: {
      title,
      type,
      creditor,
      currency,
      principalAmount,
      currentDebt,
      monthlyPayment,
      interestRate,
      termMonths,
      paidMonths,
      paymentDay,
      nextPaymentDate,
      reminderDaysBefore,
      accountId,
      autoCreateExpense,
      note,
      error,
    },
    actions: {
      setTitle,
      setType,
      setCreditor,
      setCurrency,
      setPrincipalAmount,
      setCurrentDebt,
      setMonthlyPayment,
      setInterestRate,
      setTermMonths,
      setPaidMonths,
      setPaymentDay,
      setNextPaymentDate,
      setReminderDaysBefore,
      setAccountId,
      setAutoCreateExpense,
      setNote,
    },
    derived: {
      accountOptions,
      isDebtLike,
      isCreditLike,
      isInstallment,
      isSubscription,
      isOther,
    },
    handleSave,
  };
}
