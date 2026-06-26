import { create } from 'zustand';
import type { OnboardingStatus } from '@/features/onboarding/model/onboarding.types';

const STORAGE_KEY = 'ai-financer-onboarding-seen:v4';

type OnboardingState = {
  isOpen: boolean;
  hasSeenOnboarding: boolean;
  status: OnboardingStatus;
  open: () => void;
  close: () => void;
  complete: () => void;
  skip: () => void;
  reset: () => void;
};

function readSeen() {
  return localStorage.getItem(STORAGE_KEY) === 'true';
}

function markSeen() {
  localStorage.setItem(STORAGE_KEY, 'true');
}

export const ONBOARDING_SEEN_STORAGE_KEY = STORAGE_KEY;

export const useOnboardingStore = create<OnboardingState>((set) => {
  const hasSeenOnboarding = readSeen();

  return {
    hasSeenOnboarding,
    isOpen: !hasSeenOnboarding,
    status: hasSeenOnboarding ? 'completed' : 'not_started',

    open: () => set({ isOpen: true, status: 'in_progress' }),

    close: () => {
      markSeen();
      set({ isOpen: false, hasSeenOnboarding: true, status: 'completed' });
    },

    complete: () => {
      markSeen();
      set({ isOpen: false, hasSeenOnboarding: true, status: 'completed' });
    },

    skip: () => {
      markSeen();
      set({ isOpen: false, hasSeenOnboarding: true, status: 'skipped' });
    },

    reset: () => {
      localStorage.removeItem(STORAGE_KEY);
      set({ isOpen: true, hasSeenOnboarding: false, status: 'in_progress' });
    },
  };
});
