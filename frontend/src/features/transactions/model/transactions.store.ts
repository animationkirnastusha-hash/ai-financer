import { create } from 'zustand';
import {
  fetchTransactions,
  type TransactionDto,
} from '@/features/transactions/api/transactions.api';

type TransactionsState = {
  items: TransactionDto[];
  isLoading: boolean;
  error: string | null;

  loadTransactions: (force?: boolean) => Promise<void>;
};

export const useTransactionsStore = create<TransactionsState>((set, get) => ({
  items: [],
  isLoading: false,
  error: null,

  loadTransactions: async (force = false) => {
    if (get().isLoading && !force) return;

    set({ isLoading: true, error: null });

    try {
      const items = await fetchTransactions();
      set({ items, isLoading: false });
    } catch (error) {
      console.error(error);
      set({
        isLoading: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to load transactions',
      });
    }
  },
}));