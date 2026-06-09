import { apiClient } from '@/shared/api/client';

export type ObligationAccountDto = {
  id: string;
  name: string;
  currency: string;
  icon?: string | null;
  color?: string | null;
};

export type LoanType = 'loan' | 'mortgage' | 'installment' | 'subscription' | 'other';
export type LoanStatus = 'active' | 'paused' | 'closed';

export type LoanPaymentDto = {
  id: string;
  userId: string;
  loanId: string;
  accountId?: string | null;
  amount: number;
  paidAt: string;
  transactionId?: string | null;
  note?: string | null;
  createdAt: string;
};

export type ObligationReminderDto = {
  id: string;
  userId: string;
  loanId?: string | null;
  title: string;
  message: string;
  dueDate: string;
  remindAt: string;
  channel: string;
  status: 'scheduled' | 'sent' | 'done' | 'cancelled' | string;
  createdAt: string;
  updatedAt?: string;
  loan?: Pick<LoanDto, 'id' | 'title' | 'type' | 'monthlyPayment' | 'currency'> | null;
};

export type RecurringPaymentDto = {
  id: string;
  userId: string;
  accountId: string;
  account?: (ObligationAccountDto & { balance?: number }) | null;
  name: string;
  amount: number;
  category: string;
  period: 'weekly' | 'monthly' | 'yearly' | 'custom' | string;
  nextDate: string;
  isActive: boolean;
  createdAt: string;
  daysUntilPayment?: number | null;
};

export type LoanDto = {
  id: string;
  userId: string;
  accountId?: string | null;
  account?: ObligationAccountDto | null;
  title: string;
  type: LoanType | string;
  creditor?: string | null;
  currency: string;
  principalAmount: number;
  currentDebt: number;
  monthlyPayment: number;
  interestRate?: number | null;
  termMonths?: number | null;
  paidMonths: number;
  paymentDay?: number | null;
  nextPaymentDate?: string | null;
  reminderDaysBefore: number;
  autoCreateExpense: boolean;
  status: LoanStatus | string;
  note?: string | null;
  progress: number;
  daysUntilPayment?: number | null;
  payments?: LoanPaymentDto[];
  reminders?: ObligationReminderDto[];
  createdAt: string;
  updatedAt: string;
};

export type ObligationSummaryDto = {
  loans: LoanDto[];
  activeLoansCount: number;
  monthlyPaymentTotal: number;
  totalDebt: number;
  dueThisMonthCount: number;
  nearest: LoanDto | null;
  recurringPayments?: RecurringPaymentDto[];
  recurringPaymentTotal?: number;
  upcomingReminders: ObligationReminderDto[];
};

export type CreateLoanPayload = {
  title: string;
  type?: LoanType;
  creditor?: string | null;
  currency?: string;
  principalAmount?: number;
  currentDebt?: number;
  monthlyPayment?: number;
  interestRate?: number | null;
  termMonths?: number | null;
  paidMonths?: number;
  paymentDay?: number | null;
  nextPaymentDate?: string | null;
  reminderDaysBefore?: number;
  accountId?: string | null;
  autoCreateExpense?: boolean;
  note?: string | null;
};

export type UpdateLoanPayload = Partial<CreateLoanPayload> & {
  status?: LoanStatus;
};

export type MarkLoanPaymentPayload = {
  amount?: number;
  accountId?: string | null;
  paidAt?: string;
  createExpense?: boolean;
  note?: string | null;
};

function unwrapLoan(payload: { loan?: LoanDto } | LoanDto) {
  return 'loan' in payload && payload.loan ? payload.loan : payload as LoanDto;
}

export const obligationsApi = {
  async summary() {
    const payload = await apiClient.get<{ summary: ObligationSummaryDto }>('/obligations/summary');
    return payload.summary;
  },

  async listLoans() {
    const payload = await apiClient.get<{ loans?: LoanDto[] } | LoanDto[]>('/obligations/loans');
    return Array.isArray(payload) ? payload : payload.loans ?? [];
  },

  async createLoan(input: CreateLoanPayload) {
    const payload = await apiClient.post<{ loan?: LoanDto } | LoanDto>('/obligations/loans', input);
    return unwrapLoan(payload);
  },

  async updateLoan(id: string, input: UpdateLoanPayload) {
    const payload = await apiClient.patch<{ loan?: LoanDto } | LoanDto>(`/obligations/loans/${id}`, input);
    return unwrapLoan(payload);
  },

  async deleteLoan(id: string) {
    const payload = await apiClient.delete<{ loan?: LoanDto } | LoanDto>(`/obligations/loans/${id}`);
    return unwrapLoan(payload);
  },

  async markLoanPaid(id: string, input: MarkLoanPaymentPayload = {}) {
    return apiClient.post<{ loan: LoanDto; transactionId?: string | null }>(`/obligations/loans/${id}/payments`, input);
  },

  async listReminders() {
    const payload = await apiClient.get<{ reminders?: ObligationReminderDto[] } | ObligationReminderDto[]>('/obligations/reminders');
    return Array.isArray(payload) ? payload : payload.reminders ?? [];
  },

  async updateReminderStatus(id: string, status: 'scheduled' | 'sent' | 'done' | 'cancelled') {
    const payload = await apiClient.patch<{ reminder: ObligationReminderDto }>(`/obligations/reminders/${id}`, { status });
    return payload.reminder;
  },
};
