import { create } from 'zustand';
import {
  createAccount as createAccountRequest,
  deleteAccountRequest,
  fetchAccounts,
  updateAccountRequest,
  type AccountDto,
  type UpdateAccountPayload,
} from '@/features/accounts/api/accounts.api';

type AccountsState = {
  items: AccountDto[];
  editing: AccountDto | null;
  isLoading: boolean;
  isCreating: boolean;
  isDeleting: boolean;
  isUpdating: boolean;
  error: string | null;

  loadAccounts: (force?: boolean) => Promise<void>;
  createAccount: (payload: {
    name: string;
    type: 'card' | 'cash' | 'savings' | 'investment';
    currency: 'RUB' | 'USD' | 'EUR';
    initialBalance: number;
  }) => Promise<void>;
  updateAccount: (accountId: string, payload: UpdateAccountPayload) => Promise<AccountDto>;
  deleteAccount: (accountId: string) => Promise<void>;
  openEdit: (account: AccountDto) => void;
  closeEdit: () => void;
};

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export const useAccountsStore = create<AccountsState>((set, get) => ({
  items: [],
  editing: null,
  isLoading: false,
  isCreating: false,
  isDeleting: false,
  isUpdating: false,
  error: null,

  loadAccounts: async (force = false) => {
    if (get().isLoading && !force) return;
    set({ isLoading: true, error: null });

    try {
      const items = await fetchAccounts();
      set({ items, isLoading: false });
    } catch (error) {
      console.error(error);
      set({ isLoading: false, error: getErrorMessage(error, 'Failed to load accounts') });
    }
  },

  createAccount: async (payload) => {
    if (get().isCreating) return;
    set({ isCreating: true, error: null });

    try {
      await createAccountRequest(payload);
      const items = await fetchAccounts();
      set({ items, isCreating: false });
    } catch (error) {
      console.error(error);
      set({ isCreating: false, error: getErrorMessage(error, 'Failed to create account') });
      throw error;
    }
  },

  updateAccount: async (accountId, payload) => {
    set({ isUpdating: true, error: null });

    const previousItems = get().items;
    const optimisticItems = previousItems.map((item) =>
      item.id === accountId ? { ...item, ...payload } : item,
    );
    set({ items: optimisticItems });

    try {
      const account = await updateAccountRequest(accountId, payload);
      set({
        items: get().items.map((item) => (item.id === account.id ? account : item)),
        editing: null,
        isUpdating: false,
      });
      return account;
    } catch (error) {
      console.error(error);
      set({
        items: previousItems,
        isUpdating: false,
        error: getErrorMessage(error, 'Failed to update account'),
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
        editing: get().editing?.id === accountId ? null : get().editing,
        isDeleting: false,
      });
    } catch (error) {
      console.error(error);
      set({ isDeleting: false, error: getErrorMessage(error, 'Failed to delete account') });
      throw error;
    }
  },

  openEdit: (account) => set({ editing: account }),
  closeEdit: () => set({ editing: null }),
}));
