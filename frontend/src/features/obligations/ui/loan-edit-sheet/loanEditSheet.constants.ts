import type { LoanTypeOption } from './loanEditSheet.types';

export const loanTypes: LoanTypeOption[] = [
  { value: 'loan', label: 'Кредит' },
  { value: 'mortgage', label: 'Ипотека' },
  { value: 'installment', label: 'Рассрочка' },
  { value: 'subscription', label: 'Подписка' },
  { value: 'other', label: 'Другое' },
];
