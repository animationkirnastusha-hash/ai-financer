import { create } from 'zustand';
import {
  deleteTransaction,
  fetchLatestTransaction,
  fetchMonthlyStats,
  fetchTransactions,
  updateTransaction,
  type MonthlyStatsDto,
  type TransactionDto,
} from '@/features/transactions/api/transactions.api';

type UpdateTransactionPayload = {
  amount?: number;
  description?: string | null;
  date?: string;
  accountId?: string;
  categoryId?: string | null;
  type?: 'income' | 'expense' | 'transfer';
  toAccountId?: string | null;
};

type TransactionsState = {
  items: TransactionDto[];
  latest: TransactionDto | null;
  monthlyStats: MonthlyStatsDto | null;
  stats: MonthlyStatsDto | null;
  editing: TransactionDto | null;
  isLoading: boolean;
  isMutating: boolean;
  error: string | null;

  loadTransactions: (force?: boolean) => Promise<void>;
  loadLatest: () => Promise<void>;
  loadMonthlyStats: () => Promise<void>;
  refreshDashboard: () => Promise<void>;
  refreshAll: () => Promise<void>;

  deleteTx: (transaction: TransactionDto | string) => Promise<void>;
  deleteItem: (transactionOrId: TransactionDto | string) => Promise<void>;

  updateItem: (id: string, payload: UpdateTransactionPayload) => Promise<void>;
  undoLast: () => Promise<void>;
  openEdit: (transaction: TransactionDto) => void;
  closeEdit: () => void;
  saveEdit: (payload: UpdateTransactionPayload) => Promise<void>;
};

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return 'Не удалось выполнить действие';
}

export const useTransactionsStore = create<TransactionsState>((set, get) => ({
  items: [],
  latest: null,
  monthlyStats: null,
  stats: null,
  editing: null,
  isLoading: false,
  isMutating: false,
  error: null,

  loadTransactions: async (force = false) => {
    if (get().isLoading && !force) return;

    set({ isLoading: true, error: null });

    try {
      const items = await fetchTransactions(100);
      set({ items, latest: items[0] ?? get().latest, isLoading: false });
    } catch (error) {
      console.error(error);
      set({ isLoading: false, error: getErrorMessage(error) });
    }
  },

  loadLatest: async () => {
    try {
      const latest = await fetchLatestTransaction();
      set({ latest });
    } catch (error) {
      console.error(error);
      set({ error: getErrorMessage(error) });
    }
  },

  loadMonthlyStats: async () => {
    try {
      const monthlyStats = await fetchMonthlyStats();
      set({ monthlyStats, stats: monthlyStats });
    } catch (error) {
      console.error(error);
      set({ error: getErrorMessage(error) });
    }
  },

  refreshDashboard: async () => {
    await Promise.all([
      get().loadTransactions(true),
      get().loadLatest(),
      get().loadMonthlyStats(),
    ]);
  },

  refreshAll: async () => {
    await get().refreshDashboard();
  },

  deleteTx: async (transactionOrId) => {
    const id = typeof transactionOrId === 'string' ? transactionOrId : transactionOrId.id;

    set({ isMutating: true, error: null });

    try {
      await deleteTransaction(id);
      set({ isMutating: false });
      await get().refreshDashboard();
    } catch (error) {
      console.error(error);
      set({ isMutating: false, error: getErrorMessage(error) });
    }
  },

  deleteItem: async (transactionOrId) => {
    await get().deleteTx(transactionOrId);
  },

  updateItem: async (id, payload) => {
    set({ isMutating: true, error: null });

    try {
      await updateTransaction(id, payload);
      set({ isMutating: false });
      await get().refreshDashboard();
    } catch (error) {
      console.error(error);
      set({ isMutating: false, error: getErrorMessage(error) });
    }
  },

  undoLast: async () => {
    const latest = get().latest ?? get().items[0];
    if (!latest) return;
    await get().deleteTx(latest);
  },

  openEdit: (transaction) => set({ editing: transaction }),
  closeEdit: () => set({ editing: null }),

  saveEdit: async (payload) => {
    const editing = get().editing;
    if (!editing) return;

    set({ isMutating: true, error: null });

    try {
      await updateTransaction(editing.id, payload);
      set({ isMutating: false, editing: null });
      await get().refreshDashboard();
    } catch (error) {
      console.error(error);
      set({ isMutating: false, error: getErrorMessage(error) });
    }
  },
}));
