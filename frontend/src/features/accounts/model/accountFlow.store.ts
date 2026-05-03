import { create } from 'zustand';
import type { CreateAccountDraft } from '@/features/accounts/model/accountFlow.types';

type AccountFlowState = {
  isCreateAccountOpen: boolean;
  draft: CreateAccountDraft;

  openCreateAccount: (prefill?: Partial<CreateAccountDraft>) => void;
  closeCreateAccount: () => void;
  updateDraft: (patch: Partial<CreateAccountDraft>) => void;
  resetDraft: () => void;
};

const initialDraft: CreateAccountDraft = {
  name: '',
  type: 'card',
  currency: 'RUB',
  initialBalance: '',
};

export const useAccountFlowStore = create<AccountFlowState>((set) => ({
  isCreateAccountOpen: false,
  draft: initialDraft,

  openCreateAccount: (prefill) =>
    set({
      isCreateAccountOpen: true,
      draft: {
        ...initialDraft,
        ...prefill,
      },
    }),

  closeCreateAccount: () =>
    set({
      isCreateAccountOpen: false,
    }),

  updateDraft: (patch) =>
    set((state) => ({
      draft: {
        ...state.draft,
        ...patch,
      },
    })),

  resetDraft: () =>
    set({
      draft: initialDraft,
    }),
}));