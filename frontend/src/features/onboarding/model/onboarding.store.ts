import { create } from 'zustand';

type OnboardingState = {
  isOpen: boolean;
  hasSeenOnboarding: boolean;
  open: () => void;
  close: () => void;
  reset: () => void;
};

const STORAGE_KEY = 'ai-financer-onboarding-seen:v2';

function getInitialSeenState() {
  return localStorage.getItem(STORAGE_KEY) === 'true';
}

export const useOnboardingStore = create<OnboardingState>((set) => {
  const hasSeenOnboarding = getInitialSeenState();

  return {
    hasSeenOnboarding,
    isOpen: !hasSeenOnboarding,

    open: () => set({ isOpen: true }),

    close: () => {
      localStorage.setItem(STORAGE_KEY, 'true');

      set({
        isOpen: false,
        hasSeenOnboarding: true,
      });
    },

    reset: () => {
      localStorage.removeItem(STORAGE_KEY);

      set({
        isOpen: true,
        hasSeenOnboarding: false,
      });
    },
  };
});