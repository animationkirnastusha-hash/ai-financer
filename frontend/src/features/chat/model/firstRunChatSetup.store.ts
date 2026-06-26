import { create } from 'zustand';
import type { AccountDto } from '@/features/accounts/api/accounts.api';

export type FirstRunSetupStage =
  | 'idle'
  | 'microphone'
  | 'account'
  | 'balance'
  | 'done';

export type FirstRunMicrophoneStatus = 'pending' | 'enabled' | 'skipped' | 'failed';

type PersistedSetupState = {
  stage?: FirstRunSetupStage;
  microphoneStatus?: FirstRunMicrophoneStatus;
  createdAccount?: AccountDto | null;
  completed?: boolean;
};

type FirstRunChatSetupState = {
  stage: FirstRunSetupStage;
  microphoneStatus: FirstRunMicrophoneStatus;
  createdAccount: AccountDto | null;
  completed: boolean;
  isActive: boolean;
  closeLocked: boolean;
  start: () => void;
  skipMicrophone: () => void;
  finishMicrophone: () => void;
  failMicrophone: () => void;
  completeAccount: (account: AccountDto) => void;
  completeWithAccount: (account: AccountDto | null) => void;
  dismiss: () => void;
  reset: () => void;
};

export const FIRST_RUN_CHAT_SETUP_STORAGE_KEY = 'ai-financer-first-run-chat-setup:v5';

const LEGACY_STORAGE_KEYS = [
  'ai-financer-first-run-chat-setup:v1',
  'ai-financer-first-run-chat-setup:v2',
  'ai-financer-first-run-chat-setup:v3',
  'ai-financer-first-run-chat-setup:v4',
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

function isBlockingStage(stage: FirstRunSetupStage) {
  return stage !== 'idle' && stage !== 'done';
}

export const useFirstRunChatSetupStore = create<FirstRunChatSetupState>((set) => {
  LEGACY_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key));

  const persisted = readPersisted();
  const initialStage = persisted.completed ? 'done' : persisted.stage ?? 'idle';
  const initialMicrophoneStatus = persisted.microphoneStatus ?? 'pending';

  return {
    stage: initialStage,
    microphoneStatus: initialMicrophoneStatus,
    createdAccount: persisted.createdAccount ?? null,
    completed: Boolean(persisted.completed),
    isActive: initialStage !== 'idle' && !persisted.completed,
    closeLocked: isBlockingStage(initialStage),

    start: () => {
      persist({ stage: 'microphone', microphoneStatus: 'pending', createdAccount: null, completed: false });
      set({
        stage: 'microphone',
        microphoneStatus: 'pending',
        createdAccount: null,
        completed: false,
        isActive: true,
        closeLocked: true,
      });
    },

    skipMicrophone: () => {
      persist({ stage: 'account', microphoneStatus: 'skipped', createdAccount: null, completed: false });
      set({ stage: 'account', microphoneStatus: 'skipped', isActive: true, closeLocked: true });
    },

    finishMicrophone: () => {
      persist({ stage: 'account', microphoneStatus: 'enabled', createdAccount: null, completed: false });
      set({ stage: 'account', microphoneStatus: 'enabled', isActive: true, closeLocked: true });
    },

    failMicrophone: () => {
      persist({ stage: 'account', microphoneStatus: 'failed', createdAccount: null, completed: false });
      set({ stage: 'account', microphoneStatus: 'failed', isActive: true, closeLocked: true });
    },

    completeAccount: (createdAccount) => {
      const microphoneStatus = readPersisted().microphoneStatus ?? 'pending';
      persist({ stage: 'balance', microphoneStatus, createdAccount, completed: false });
      set({ stage: 'balance', createdAccount, microphoneStatus, isActive: true, closeLocked: true });
    },

    completeWithAccount: (createdAccount) => {
      const microphoneStatus = readPersisted().microphoneStatus ?? 'pending';
      persist({ stage: 'done', microphoneStatus, createdAccount, completed: true });
      set({
        stage: 'done',
        createdAccount,
        microphoneStatus,
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
        microphoneStatus: 'pending',
        createdAccount: null,
        completed: false,
        isActive: false,
        closeLocked: false,
      });
    },
  };
});
