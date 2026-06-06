import { create } from 'zustand';
import { subscriptionApi, type SubscriptionStatusDto } from '@/features/subscription/api/subscription.api';

type SubscriptionState = {
  status: SubscriptionStatusDto | null;
  isLoading: boolean;
  error: string | null;
  load: () => Promise<SubscriptionStatusDto | null>;
  startTrial: () => Promise<SubscriptionStatusDto | null>;
  setStatus: (status: SubscriptionStatusDto | null) => void;
};

export const useSubscriptionStore = create<SubscriptionState>((set, get) => ({
  status: null,
  isLoading: false,
  error: null,

  setStatus: (status) => set({ status }),

  load: async () => {
    if (get().isLoading) return get().status;
    set({ isLoading: true, error: null });
    try {
      const status = await subscriptionApi.me();
      set({ status, isLoading: false });
      return status;
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'subscription_error', isLoading: false });
      return get().status;
    }
  },

  startTrial: async () => {
    set({ isLoading: true, error: null });
    try {
      const status = await subscriptionApi.startTrial();
      set({ status, isLoading: false });
      return status;
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'subscription_error', isLoading: false });
      return get().status;
    }
  },
}));
