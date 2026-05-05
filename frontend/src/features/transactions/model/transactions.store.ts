import { create } from 'zustand';
import {
  deleteTransaction,
  fetchLatestTransaction,
  fetchMonthlyTransactionStats,
  fetchTransactions,
  updateTransaction,
  type MonthlyStatsDto,
  type TransactionDto,
  type UpdateTransactionPayload,
} from '@/features/transactions/api/transactions.api';

type TransactionsState = {
  items: TransactionDto[];
  latest: TransactionDto | null;
  stats: MonthlyStatsDto | null;
  isLoading: boolean;
  isMutating: boolean;
  error: string | null;

  loadTransactions: (force?: boolean) => Promise<void>;
  loadLatest: () => Promise<void>;
  loadStats: (category?: string) => Promise<void>;
  updateItem: (transactionId: string, payload: UpdateTransactionPayload) => Promise<TransactionDto>;
  deleteItem: (transactionId: string) => Promise<TransactionDto>;
  refreshAll: () => Promise<void>;
};

export const useTransactionsStore = create<TransactionsState>((set, get) => ({
  items: [],
  latest: null,
  stats: null,
  isLoading: false,
  isMutating: false,
  error: null,

  loadTransactions: async (force = false) => {
    if (get().isLoading && !force) return;

    set({ isLoading: true, error: null });

    try {
      const items = await fetchTransactions();
      set({ items, latest: items[0] ?? get().latest, isLoading: false });
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

  loadLatest: async () => {
    try {
      const latest = await fetchLatestTransaction();
      set({ latest });
    } catch (error) {
      console.error('Failed to load latest transaction', error);
    }
  },

  loadStats: async (category?: string) => {
    try {
      const stats = await fetchMonthlyTransactionStats(category);
      set({ stats });
    } catch (error) {
      console.error('Failed to load monthly stats', error);
    }
  },

  updateItem: async (transactionId, payload) => {
    set({ isMutating: true, error: null });

    try {
      const updated = await updateTransaction(transactionId, payload);

      set((state) => ({
        isMutating: false,
        items: state.items.map((item) => (item.id === updated.id ? updated : item)),
        latest: state.latest?.id === updated.id ? updated : state.latest,
      }));

      await get().refreshAll();

      return updated;
    } catch (error) {
      set({
        isMutating: false,
        error: error instanceof Error ? error.message : 'Failed to update transaction',
      });
      throw error;
    }
  },

  deleteItem: async (transactionId) => {
    set({ isMutating: true, error: null });

    try {
      const deleted = await deleteTransaction(transactionId);

      set((state) => ({
        isMutating: false,
        items: state.items.filter((item) => item.id !== transactionId),
        latest: state.latest?.id === transactionId ? null : state.latest,
      }));

      await get().refreshAll();

      return deleted;
    } catch (error) {
      set({
        isMutating: false,
        error: error instanceof Error ? error.message : 'Failed to delete transaction',
      });
      throw error;
    }
  },

  refreshAll: async () => {
    await Promise.allSettled([
      get().loadTransactions(true),
      get().loadLatest(),
      get().loadStats(),
    ]);
  },
}));
