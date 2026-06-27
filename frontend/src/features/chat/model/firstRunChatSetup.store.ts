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
  interrupted?: boolean;
};

type FirstRunChatSetupState = {
  stage: FirstRunSetupStage;
  microphoneStatus: FirstRunMicrophoneStatus;
  createdAccount: AccountDto | null;
  completed: boolean;
  interrupted: boolean;
  isActive: boolean;
  closeLocked: boolean;
  start: () => void;
  skipMicrophone: () => void;
  finishMicrophone: () => void;
  failMicrophone: () => void;
  completeAccount: (account: AccountDto) => void;
  completeWithAccount: (account: AccountDto | null) => void;
  markInterrupted: () => void;
  resumeInterrupted: () => void;
  abandonInterrupted: () => void;
  dismiss: () => void;
  reset: () => void;
};

export const FIRST_RUN_CHAT_SETUP_STORAGE_KEY = 'ai-financer-first-run-chat-setup:v6';

const LEGACY_STORAGE_KEYS = [
  'ai-financer-first-run-chat-setup:v1',
  'ai-financer-first-run-chat-setup:v2',
  'ai-financer-first-run-chat-setup:v3',
  'ai-financer-first-run-chat-setup:v4',
  'ai-financer-first-run-chat-setup:v5',
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
    microphoneStatus: persisted.microphoneStatus ?? 'pending',
    createdAccount: persisted.createdAccount ?? null,
    completed: Boolean(persisted.completed),
    interrupted: Boolean(persisted.interrupted),
  };
}

export const useFirstRunChatSetupStore = create<FirstRunChatSetupState>((set) => {
  LEGACY_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key));

  const persisted = readPersisted();
  const initialStage = persisted.completed ? 'done' : persisted.stage ?? 'idle';
  const initialMicrophoneStatus = persisted.microphoneStatus ?? 'pending';
  const initialInterrupted = Boolean(persisted.interrupted && isSetupStage(initialStage) && !persisted.completed);

  return {
    stage: initialStage,
    microphoneStatus: initialMicrophoneStatus,
    createdAccount: persisted.createdAccount ?? null,
    completed: Boolean(persisted.completed),
    interrupted: initialInterrupted,
    isActive: initialStage !== 'idle' && !persisted.completed && !initialInterrupted,
    closeLocked: false,

    start: () => {
      persist({ stage: 'microphone', microphoneStatus: 'pending', createdAccount: null, completed: false, interrupted: false });
      set({
        stage: 'microphone',
        microphoneStatus: 'pending',
        createdAccount: null,
        completed: false,
        interrupted: false,
        isActive: true,
        closeLocked: false,
      });
    },

    skipMicrophone: () => {
      persist({ stage: 'account', microphoneStatus: 'skipped', createdAccount: null, completed: false, interrupted: false });
      set({ stage: 'account', microphoneStatus: 'skipped', interrupted: false, isActive: true, closeLocked: false });
    },

    finishMicrophone: () => {
      persist({ stage: 'account', microphoneStatus: 'enabled', createdAccount: null, completed: false, interrupted: false });
      set({ stage: 'account', microphoneStatus: 'enabled', interrupted: false, isActive: true, closeLocked: false });
    },

    failMicrophone: () => {
      persist({ stage: 'account', microphoneStatus: 'failed', createdAccount: null, completed: false, interrupted: false });
      set({ stage: 'account', microphoneStatus: 'failed', interrupted: false, isActive: true, closeLocked: false });
    },

    completeAccount: (createdAccount) => {
      const microphoneStatus = readPersisted().microphoneStatus ?? 'pending';
      persist({ stage: 'balance', microphoneStatus, createdAccount, completed: false, interrupted: false });
      set({ stage: 'balance', createdAccount, microphoneStatus, interrupted: false, isActive: true, closeLocked: false });
    },

    completeWithAccount: (createdAccount) => {
      const microphoneStatus = readPersisted().microphoneStatus ?? 'pending';
      persist({ stage: 'done', microphoneStatus, createdAccount, completed: true, interrupted: false });
      set({
        stage: 'done',
        createdAccount,
        microphoneStatus,
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
        microphoneStatus: current.microphoneStatus ?? 'pending',
        createdAccount: current.createdAccount ?? null,
        completed: false,
        interrupted: false,
        isActive: true,
        closeLocked: false,
      });
    },

    abandonInterrupted: () => {
      clearPersisted();
      persist({ stage: 'done', microphoneStatus: 'skipped', createdAccount: null, completed: true, interrupted: false });
      set({
        stage: 'done',
        microphoneStatus: 'skipped',
        createdAccount: null,
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
        microphoneStatus: 'pending',
        createdAccount: null,
        completed: false,
        interrupted: false,
        isActive: false,
        closeLocked: false,
      });
    },
  };
});
