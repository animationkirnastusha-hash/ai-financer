import { create } from 'zustand';
import {
  obligationsApi,
  type CreateLoanPayload,
  type LoanDto,
  type MarkLoanPaymentPayload,
  type ObligationReminderDto,
  type ObligationSummaryDto,
  type UpdateLoanPayload,
} from '@/features/obligations/api/obligations.api';

type ObligationsState = {
  loans: LoanDto[];
  reminders: ObligationReminderDto[];
  summary: ObligationSummaryDto | null;
  isLoading: boolean;
  isMutating: boolean;
  error: string | null;
  loadAll: (force?: boolean) => Promise<void>;
  loadSummary: (force?: boolean) => Promise<void>;
  createLoan: (payload: CreateLoanPayload) => Promise<LoanDto>;
  updateLoan: (id: string, payload: UpdateLoanPayload) => Promise<LoanDto>;
  deleteLoan: (id: string) => Promise<void>;
  markPaid: (id: string, payload?: MarkLoanPaymentPayload) => Promise<void>;
  updateReminderStatus: (id: string, status: 'scheduled' | 'sent' | 'done' | 'cancelled') => Promise<void>;
};

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Не удалось выполнить действие';
}

export const useObligationsStore = create<ObligationsState>((set, get) => ({
  loans: [],
  reminders: [],
  summary: null,
  isLoading: false,
  isMutating: false,
  error: null,

  loadSummary: async (force = false) => {
    if (get().isLoading && !force) return;
    try {
      const summary = await obligationsApi.summary();
      set({ summary, loans: summary.loans });
    } catch (error) {
      console.error(error);
      set({ error: getErrorMessage(error) });
    }
  },

  loadAll: async (force = false) => {
    if (get().isLoading && !force) return;
    set({ isLoading: true, error: null });
    try {
      const [summary, loans, reminders] = await Promise.all([
        obligationsApi.summary(),
        obligationsApi.listLoans(),
        obligationsApi.listReminders(),
      ]);
      set({ summary, loans, reminders, isLoading: false });
    } catch (error) {
      console.error(error);
      set({ isLoading: false, error: getErrorMessage(error) });
    }
  },

  createLoan: async (payload) => {
    set({ isMutating: true, error: null });
    try {
      const loan = await obligationsApi.createLoan(payload);
      set({ isMutating: false });
      await get().loadAll(true);
      return loan;
    } catch (error) {
      console.error(error);
      set({ isMutating: false, error: getErrorMessage(error) });
      throw error;
    }
  },

  updateLoan: async (id, payload) => {
    set({ isMutating: true, error: null });
    try {
      const loan = await obligationsApi.updateLoan(id, payload);
      set({ isMutating: false });
      await get().loadAll(true);
      return loan;
    } catch (error) {
      console.error(error);
      set({ isMutating: false, error: getErrorMessage(error) });
      throw error;
    }
  },

  deleteLoan: async (id) => {
    set({ isMutating: true, error: null });
    try {
      await obligationsApi.deleteLoan(id);
      set({ isMutating: false, loans: get().loans.filter((loan) => loan.id !== id) });
      await get().loadAll(true);
    } catch (error) {
      console.error(error);
      set({ isMutating: false, error: getErrorMessage(error) });
      throw error;
    }
  },

  markPaid: async (id, payload = {}) => {
    set({ isMutating: true, error: null });
    try {
      await obligationsApi.markLoanPaid(id, payload);
      set({ isMutating: false });
      await get().loadAll(true);
    } catch (error) {
      console.error(error);
      set({ isMutating: false, error: getErrorMessage(error) });
      throw error;
    }
  },

  updateReminderStatus: async (id, status) => {
    set({ isMutating: true, error: null });
    try {
      await obligationsApi.updateReminderStatus(id, status);
      set({ isMutating: false });
      await get().loadAll(true);
    } catch (error) {
      console.error(error);
      set({ isMutating: false, error: getErrorMessage(error) });
      throw error;
    }
  },
}));
