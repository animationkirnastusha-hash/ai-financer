import { create } from 'zustand';
import {
  createAccount as createAccountRequest,
  deleteAccountRequest,
  fetchAccounts,
  type AccountDto,
} from '@/features/accounts/api/accounts.api';

type AccountsState = {
  items: AccountDto[];
  isLoading: boolean;
  isCreating: boolean;
  isDeleting: boolean;
  error: string | null;

  loadAccounts: (force?: boolean) => Promise<void>;
  createAccount: (payload: {
    name: string;
    type: 'card' | 'cash' | 'savings' | 'investment';
    currency: 'RUB' | 'USD' | 'EUR';
    initialBalance: number;
  }) => Promise<void>;
  deleteAccount: (accountId: string) => Promise<void>;
};

export const useAccountsStore = create<AccountsState>((set, get) => ({
  items: [],
  isLoading: false,
  isCreating: false,
  isDeleting: false,
  error: null,

  loadAccounts: async (force = false) => {
    if (get().isLoading && !force) return;

    set({ isLoading: true, error: null });

    try {
      const items = await fetchAccounts();
      set({ items, isLoading: false });
    } catch (error) {
      console.error(error);
      set({
        isLoading: false,
        error:
          error instanceof Error ? error.message : 'Failed to load accounts',
      });
    }
  },

  createAccount: async (payload) => {
    if (get().isCreating) return;

    set({ isCreating: true, error: null });

    try {
      await createAccountRequest(payload);
      const items = await fetchAccounts();

      set({
        items,
        isCreating: false,
      });
    } catch (error) {
      console.error(error);
      set({
        isCreating: false,
        error:
          error instanceof Error ? error.message : 'Failed to create account',
      });
      throw error;
    }
  },

  deleteAccount: async (accountId) => {
    if (get().isDeleting) return;

    set({ isDeleting: true, error: null });

    try {
      await deleteAccountRequest(accountId);

      set({
        items: get().items.filter((item) => item.id !== accountId),
        isDeleting: false,
      });
    } catch (error) {
      console.error(error);

      set({
        isDeleting: false,
        error:
          error instanceof Error ? error.message : 'Failed to delete account',
      });

      throw error;
    }
  },
}));