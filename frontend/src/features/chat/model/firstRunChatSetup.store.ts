import { create } from 'zustand';
import type { AccountDto } from '@/features/accounts/api/accounts.api';

export type FirstRunSetupStage = 'idle' | 'account' | 'balance' | 'done';

type PersistedSetupState = {
  stage?: FirstRunSetupStage;
  createdAccount?: AccountDto | null;
  draftAccountName?: string | null;
  completed?: boolean;
  interrupted?: boolean;
};

type FirstRunChatSetupState = {
  stage: FirstRunSetupStage;
  createdAccount: AccountDto | null;
  draftAccountName: string | null;
  completed: boolean;
  interrupted: boolean;
  isActive: boolean;
  closeLocked: boolean;
  start: () => void;
  setAccountDraftName: (accountName: string) => void;
  completeAccount: (account: AccountDto) => void;
  completeWithAccount: (account: AccountDto | null) => void;
  markInterrupted: () => void;
  resumeInterrupted: () => void;
  abandonInterrupted: () => void;
  dismiss: () => void;
  reset: () => void;
};

export const FIRST_RUN_CHAT_SETUP_STORAGE_KEY = 'ai-financer-first-run-chat-setup:v9';

const LEGACY_STORAGE_KEYS = [
  'ai-financer-first-run-chat-setup:v1',
  'ai-financer-first-run-chat-setup:v2',
  'ai-financer-first-run-chat-setup:v3',
  'ai-financer-first-run-chat-setup:v4',
  'ai-financer-first-run-chat-setup:v5',
  'ai-financer-first-run-chat-setup:v6',
  'ai-financer-first-run-chat-setup:v7',
  'ai-financer-first-run-chat-setup:v8',
];

function readPersisted(): PersistedSetupState {
  try {
    const raw = localStorage.getItem(FIRST_RUN_CHAT_SETUP_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as PersistedSetupState;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function persist(state: PersistedSetupState) {
  localStorage.setItem(FIRST_RUN_CHAT_SETUP_STORAGE_KEY, JSON.stringify(state));
}

function clearPersisted() {
  localStorage.removeItem(FIRST_RUN_CHAT_SETUP_STORAGE_KEY);
  LEGACY_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key));
}

function isSetupStage(stage: FirstRunSetupStage) {
  return stage !== 'idle' && stage !== 'done';
}

function getCurrentPersistedState(): PersistedSetupState {
  const persisted = readPersisted();
  return {
    stage: persisted.stage ?? 'idle',
    createdAccount: persisted.createdAccount ?? null,
    draftAccountName: persisted.draftAccountName ?? null,
    completed: Boolean(persisted.completed),
    interrupted: Boolean(persisted.interrupted),
  };
}

export const useFirstRunChatSetupStore = create<FirstRunChatSetupState>((set) => {
  LEGACY_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key));

  const persisted = readPersisted();
  const initialStage = persisted.completed ? 'done' : persisted.stage ?? 'idle';
  const initialInterrupted = Boolean(persisted.interrupted && isSetupStage(initialStage) && !persisted.completed);

  return {
    stage: initialStage,
    createdAccount: persisted.createdAccount ?? null,
    draftAccountName: persisted.draftAccountName ?? null,
    completed: Boolean(persisted.completed),
    interrupted: initialInterrupted,
    isActive: initialStage !== 'idle' && !persisted.completed && !initialInterrupted,
    closeLocked: false,

    start: () => {
      persist({ stage: 'account', createdAccount: null, draftAccountName: null, completed: false, interrupted: false });
      set({
        stage: 'account',
        createdAccount: null,
        draftAccountName: null,
        completed: false,
        interrupted: false,
        isActive: true,
        closeLocked: false,
      });
    },

    setAccountDraftName: (accountName) => {
      persist({ stage: 'balance', createdAccount: null, draftAccountName: accountName, completed: false, interrupted: false });
      set({
        stage: 'balance',
        createdAccount: null,
        draftAccountName: accountName,
        interrupted: false,
        isActive: true,
        closeLocked: false,
      });
    },

    completeAccount: (createdAccount) => {
      persist({ stage: 'balance', createdAccount, draftAccountName: createdAccount.name, completed: false, interrupted: false });
      set({ stage: 'balance', createdAccount, draftAccountName: createdAccount.name, interrupted: false, isActive: true, closeLocked: false });
    },

    completeWithAccount: (createdAccount) => {
      persist({ stage: 'done', createdAccount, draftAccountName: null, completed: true, interrupted: false });
      set({
        stage: 'done',
        createdAccount,
        draftAccountName: null,
        completed: true,
        interrupted: false,
        isActive: true,
        closeLocked: false,
      });
    },

    markInterrupted: () => {
      const current = getCurrentPersistedState();
      if (!isSetupStage(current.stage ?? 'idle') || current.completed) {
        set({ isActive: false, closeLocked: false, interrupted: false });
        return;
      }
      persist({ ...current, completed: false, interrupted: true });
      set({ isActive: false, closeLocked: false, interrupted: true });
    },

    resumeInterrupted: () => {
      const current = getCurrentPersistedState();
      const stage = current.stage ?? 'idle';
      if (!isSetupStage(stage) || current.completed) {
        set({ isActive: false, closeLocked: false, interrupted: false });
        return;
      }
      persist({ ...current, completed: false, interrupted: false });
      set({
        stage,
        createdAccount: current.createdAccount ?? null,
        draftAccountName: current.draftAccountName ?? null,
        completed: false,
        interrupted: false,
        isActive: true,
        closeLocked: false,
      });
    },

    abandonInterrupted: () => {
      clearPersisted();
      persist({ stage: 'done', createdAccount: null, draftAccountName: null, completed: true, interrupted: false });
      set({
        stage: 'done',
        createdAccount: null,
        draftAccountName: null,
        completed: true,
        interrupted: false,
        isActive: false,
        closeLocked: false,
      });
    },

    dismiss: () => {
      set({ isActive: false, closeLocked: false });
    },

    reset: () => {
      clearPersisted();
      set({
        stage: 'idle',
        createdAccount: null,
        draftAccountName: null,
        completed: false,
        interrupted: false,
        isActive: false,
        closeLocked: false,
      });
    },
  };
});
