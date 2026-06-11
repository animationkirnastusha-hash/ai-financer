import type { Dispatch, SetStateAction } from 'react';
import type { AccountDto } from '@/features/accounts/api/accounts.api';
import type { LoanType } from '@/features/obligations/api/obligations.api';

export type LoanTypeOption = {
  value: LoanType;
  label: string;
};

export type LoanEditFormState = {
  title: string;
  type: LoanType;
  creditor: string;
  currency: string;
  principalAmount: string;
  currentDebt: string;
  monthlyPayment: string;
  interestRate: string;
  termMonths: string;
  paidMonths: string;
  paymentDay: string;
  nextPaymentDate: string;
  reminderDaysBefore: string;
  accountId: string;
  autoCreateExpense: boolean;
  note: string;
  error: string | null;
};

export type LoanEditFormActions = {
  setTitle: Dispatch<SetStateAction<string>>;
  setType: Dispatch<SetStateAction<LoanType>>;
  setCreditor: Dispatch<SetStateAction<string>>;
  setCurrency: Dispatch<SetStateAction<string>>;
  setPrincipalAmount: Dispatch<SetStateAction<string>>;
  setCurrentDebt: Dispatch<SetStateAction<string>>;
  setMonthlyPayment: Dispatch<SetStateAction<string>>;
  setInterestRate: Dispatch<SetStateAction<string>>;
  setTermMonths: Dispatch<SetStateAction<string>>;
  setPaidMonths: Dispatch<SetStateAction<string>>;
  setPaymentDay: Dispatch<SetStateAction<string>>;
  setNextPaymentDate: Dispatch<SetStateAction<string>>;
  setReminderDaysBefore: Dispatch<SetStateAction<string>>;
  setAccountId: Dispatch<SetStateAction<string>>;
  setAutoCreateExpense: Dispatch<SetStateAction<boolean>>;
  setNote: Dispatch<SetStateAction<string>>;
};

export type LoanEditDerivedState = {
  accountOptions: AccountDto[];
  isDebtLike: boolean;
  isCreditLike: boolean;
  isInstallment: boolean;
  isSubscription: boolean;
  isOther: boolean;
};
