import { create } from 'zustand';
import {
  applyReferralCode,
  fetchProgression,
  trackProgressionActivity,
  type ProgressionActivityType,
  type ProgressionSnapshotDto,
} from '@/features/progression/api/progression.api';

type ProgressionState = {
  snapshot: ProgressionSnapshotDto | null;
  isLoading: boolean;
  error: string | null;
  load: (force?: boolean) => Promise<void>;
  track: (type: ProgressionActivityType, payload?: unknown) => Promise<void>;
  applyReferral: (code: string) => Promise<void>;
};

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return 'Не удалось обновить прогресс';
}

export const useProgressionStore = create<ProgressionState>((set, get) => ({
  snapshot: null,
  isLoading: false,
  error: null,

  load: async (force = false) => {
    if (get().isLoading && !force) return;
    set({ isLoading: true, error: null });

    try {
      const snapshot = await fetchProgression();
      set({ snapshot, isLoading: false });
    } catch (error) {
      console.error(error);
      set({ isLoading: false, error: getErrorMessage(error) });
    }
  },

  track: async (type, payload) => {
    try {
      await trackProgressionActivity({ type, payload });
      await get().load(true);
    } catch (error) {
      console.error(error);
      set({ error: getErrorMessage(error) });
    }
  },

  applyReferral: async (code) => {
    set({ isLoading: true, error: null });

    try {
      const snapshot = await applyReferralCode(code);
      set({ snapshot, isLoading: false });
    } catch (error) {
      console.error(error);
      set({ isLoading: false, error: getErrorMessage(error) });
      throw error;
    }
  },
}));
