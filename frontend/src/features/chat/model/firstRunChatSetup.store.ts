import { create } from 'zustand';
import type { AccountDto } from '@/features/accounts/api/accounts.api';

export type FirstRunSetupStage = 'idle' | 'microphone' | 'account' | 'done';

type PersistedSetupState = {
  stage?: FirstRunSetupStage;
  completed?: boolean;
};

type FirstRunChatSetupState = {
  stage: FirstRunSetupStage;
  createdAccount: AccountDto | null;
  completed: boolean;
  isActive: boolean;
  closeLocked: boolean;
  start: () => void;
  skipMicrophone: () => void;
  finishMicrophone: () => void;
  completeWithAccount: (account: AccountDto | null) => void;
  dismiss: () => void;
  reset: () => void;
};

export const FIRST_RUN_CHAT_SETUP_STORAGE_KEY = 'ai-financer-first-run-chat-setup:v2';

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

function normalizeStage(stage: PersistedSetupState['stage']): FirstRunSetupStage {
  if (stage === 'microphone' || stage === 'account' || stage === 'done') return stage;
  return 'idle';
}

function persist(state: PersistedSetupState) {
  localStorage.setItem(FIRST_RUN_CHAT_SETUP_STORAGE_KEY, JSON.stringify(state));
}

function clearPersisted() {
  localStorage.removeItem(FIRST_RUN_CHAT_SETUP_STORAGE_KEY);
}

function isBlockingStage(stage: FirstRunSetupStage) {
  return stage === 'microphone' || stage === 'account';
}

export const useFirstRunChatSetupStore = create<FirstRunChatSetupState>((set) => {
  const persisted = readPersisted();
  const initialStage = persisted.completed ? 'done' : normalizeStage(persisted.stage);

  return {
    stage: initialStage,
    createdAccount: null,
    completed: Boolean(persisted.completed),
    isActive: initialStage !== 'idle' && !persisted.completed,
    closeLocked: isBlockingStage(initialStage),

    start: () => {
      persist({ stage: 'microphone', completed: false });
      set({
        stage: 'microphone',
        createdAccount: null,
        completed: false,
        isActive: true,
        closeLocked: true,
      });
    },

    skipMicrophone: () => {
      persist({ stage: 'account', completed: false });
      set({ stage: 'account', isActive: true, closeLocked: true });
    },

    finishMicrophone: () => {
      persist({ stage: 'account', completed: false });
      set({ stage: 'account', isActive: true, closeLocked: true });
    },

    completeWithAccount: (createdAccount) => {
      persist({ stage: 'done', completed: true });
      set({
        stage: 'done',
        createdAccount,
        completed: true,
        isActive: true,
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
        completed: false,
        isActive: false,
        closeLocked: false,
      });
    },
  };
});
