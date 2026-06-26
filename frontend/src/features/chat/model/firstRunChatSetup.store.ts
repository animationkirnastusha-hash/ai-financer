import { create } from 'zustand';
import type { AccountDto } from '@/features/accounts/api/accounts.api';

export type FirstRunSetupStage = 'idle' | 'microphone' | 'account' | 'done';
export type FirstRunMicrophoneStatus = 'unknown' | 'enabled' | 'skipped' | 'failed';

export type FirstRunAccountDraft = {
  name: string;
  type: 'card' | 'cash';
  balance: number;
};

type PersistedSetupState = {
  stage?: FirstRunSetupStage;
  completed?: boolean;
  microphoneStatus?: FirstRunMicrophoneStatus;
};

type FirstRunChatSetupState = {
  stage: FirstRunSetupStage;
  microphoneStatus: FirstRunMicrophoneStatus;
  accountDraft: FirstRunAccountDraft | null;
  createdAccount: AccountDto | null;
  completed: boolean;
  isActive: boolean;
  closeLocked: boolean;
  start: () => void;
  skipMicrophone: () => void;
  finishMicrophone: (status?: Extract<FirstRunMicrophoneStatus, 'enabled' | 'failed'>) => void;
  completeWithAccount: (account: AccountDto | null) => void;
  dismiss: () => void;
  reset: () => void;
};

export const FIRST_RUN_CHAT_SETUP_STORAGE_KEY = 'ai-financer-first-run-chat-setup:v4';

const LEGACY_FIRST_RUN_KEYS = [
  'ai-financer-first-run-chat-setup:v1',
  'ai-financer-first-run-chat-setup:v2',
  'ai-financer-first-run-chat-setup:v3',
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

function clearLegacyPersisted() {
  LEGACY_FIRST_RUN_KEYS.forEach((key) => localStorage.removeItem(key));
}

function clearPersisted() {
  localStorage.removeItem(FIRST_RUN_CHAT_SETUP_STORAGE_KEY);
  clearLegacyPersisted();
}

function isBlockingStage(stage: FirstRunSetupStage) {
  return stage === 'microphone' || stage === 'account';
}

export const useFirstRunChatSetupStore = create<FirstRunChatSetupState>((set) => {
  const persisted = readPersisted();
  const initialStage = persisted.completed ? 'done' : persisted.stage ?? 'idle';
  const initialMicrophoneStatus = persisted.microphoneStatus ?? 'unknown';

  return {
    stage: initialStage,
    microphoneStatus: initialMicrophoneStatus,
    accountDraft: null,
    createdAccount: null,
    completed: Boolean(persisted.completed),
    isActive: initialStage !== 'idle' && !persisted.completed,
    closeLocked: isBlockingStage(initialStage),

    start: () => {
      clearLegacyPersisted();
      persist({ stage: 'microphone', completed: false, microphoneStatus: 'unknown' });
      set({
        stage: 'microphone',
        microphoneStatus: 'unknown',
        accountDraft: null,
        createdAccount: null,
        completed: false,
        isActive: true,
        closeLocked: true,
      });
    },

    skipMicrophone: () => {
      persist({ stage: 'account', completed: false, microphoneStatus: 'skipped' });
      set({ stage: 'account', microphoneStatus: 'skipped', isActive: true, closeLocked: true });
    },

    finishMicrophone: (status = 'enabled') => {
      persist({ stage: 'account', completed: false, microphoneStatus: status });
      set({ stage: 'account', microphoneStatus: status, isActive: true, closeLocked: true });
    },

    completeWithAccount: (createdAccount) => {
      persist({ stage: 'done', completed: true, microphoneStatus: readPersisted().microphoneStatus ?? 'unknown' });
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
        microphoneStatus: 'unknown',
        accountDraft: null,
        createdAccount: null,
        completed: false,
        isActive: false,
        closeLocked: false,
      });
    },
  };
});
