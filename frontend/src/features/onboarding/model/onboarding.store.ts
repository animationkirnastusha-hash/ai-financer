import { create } from 'zustand';
import type { OnboardingDraft, OnboardingStatus } from '@/features/onboarding/model/onboarding.types';

const STORAGE_KEY = 'ai-financer-onboarding-seen:v3';
const DRAFT_KEY = 'ai-financer-onboarding-draft:v1';

const defaultDraft: OnboardingDraft = {
  currency: 'RUB',
  accounts: [
    { id: 'cash', enabled: true, name: 'Наличка', type: 'cash', balance: 0 },
    { id: 'card', enabled: true, name: 'Карта', type: 'card', balance: 0 },
  ],
  loan: {
    enabled: false,
    kind: 'credit',
    title: 'Кредит',
    remainingAmount: 0,
    monthlyPayment: 0,
    paymentDay: 10,
  },
  goal: {
    enabled: false,
    title: 'Подушка безопасности',
    targetAmount: 50000,
  },
  reminders: {
    timing: 'one_day',
    creditPayments: true,
    goals: true,
    regularExpenses: true,
    weeklySummary: false,
  },
  voice: {
    voiceEnabled: true,
    textFallbackEnabled: true,
    testPhrase: '',
  },
  focus: 'personal',
};

type OnboardingState = {
  isOpen: boolean;
  hasSeenOnboarding: boolean;
  status: OnboardingStatus;
  draft: OnboardingDraft;
  open: () => void;
  close: () => void;
  complete: () => void;
  skip: () => void;
  reset: () => void;
  patchDraft: (patch: Partial<OnboardingDraft>) => void;
  setDraft: (draft: OnboardingDraft) => void;
};

function readSeen() {
  return localStorage.getItem(STORAGE_KEY) === 'true';
}

function readDraft(): OnboardingDraft {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return defaultDraft;
    const parsed = JSON.parse(raw) as Partial<OnboardingDraft>;
    return {
      ...defaultDraft,
      ...parsed,
      accounts: Array.isArray(parsed.accounts) && parsed.accounts.length ? parsed.accounts as OnboardingDraft['accounts'] : defaultDraft.accounts,
      loan: { ...defaultDraft.loan, ...(parsed.loan ?? {}) },
      goal: { ...defaultDraft.goal, ...(parsed.goal ?? {}) },
      reminders: { ...defaultDraft.reminders, ...(parsed.reminders ?? {}) },
      voice: { ...defaultDraft.voice, ...(parsed.voice ?? {}) },
    };
  } catch {
    return defaultDraft;
  }
}

function saveDraft(draft: OnboardingDraft) {
  localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
}

export const ONBOARDING_DRAFT_STORAGE_KEY = DRAFT_KEY;
export const ONBOARDING_SEEN_STORAGE_KEY = STORAGE_KEY;

export const useOnboardingStore = create<OnboardingState>((set, get) => {
  const hasSeenOnboarding = readSeen();

  return {
    hasSeenOnboarding,
    isOpen: !hasSeenOnboarding,
    status: hasSeenOnboarding ? 'completed' : 'not_started',
    draft: readDraft(),

    open: () => set({ isOpen: true, status: 'in_progress' }),

    close: () => {
      localStorage.setItem(STORAGE_KEY, 'true');
      set({ isOpen: false, hasSeenOnboarding: true, status: 'completed' });
    },

    complete: () => {
      saveDraft(get().draft);
      localStorage.setItem(STORAGE_KEY, 'true');
      set({ isOpen: false, hasSeenOnboarding: true, status: 'completed' });
    },

    skip: () => {
      saveDraft(get().draft);
      localStorage.setItem(STORAGE_KEY, 'true');
      set({ isOpen: false, hasSeenOnboarding: true, status: 'skipped' });
    },

    reset: () => {
      localStorage.removeItem(STORAGE_KEY);
      set({ isOpen: true, hasSeenOnboarding: false, status: 'in_progress', draft: readDraft() });
    },

    patchDraft: (patch) => {
      const draft = { ...get().draft, ...patch };
      saveDraft(draft);
      set({ draft });
    },

    setDraft: (draft) => {
      saveDraft(draft);
      set({ draft });
    },
  };
});
