import { create } from 'zustand';
import type { PremiumTrigger } from './premium.types';

type PremiumState = {
  isPremiumOpen: boolean;
  activeTrigger: PremiumTrigger | null;

  openPremium: (trigger: PremiumTrigger) => void;
  closePremium: () => void;
};

export const usePremiumStore = create<PremiumState>((set) => ({
  isPremiumOpen: false,
  activeTrigger: null,

  openPremium: (trigger) => {
    set({
      isPremiumOpen: true,
      activeTrigger: trigger,
    });
  },

  closePremium: () => {
    set({
      isPremiumOpen: false,
      activeTrigger: null,
    });
  },
}));