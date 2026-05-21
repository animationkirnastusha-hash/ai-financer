import { create } from 'zustand';
import { applyReferralCode, fetchReferralInfo, type ReferralInfoDto } from '@/features/referral/api/referral.api';
import { useProgressionStore } from '@/features/progression/model/progression.store';

type ReferralState = {
  info: ReferralInfoDto | null;
  isLoading: boolean;
  isApplying: boolean;
  error: string | null;
  success: string | null;
  load: (force?: boolean) => Promise<void>;
  applyCode: (code: string) => Promise<void>;
};

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return 'Не удалось выполнить действие';
}

export const useReferralStore = create<ReferralState>((set, get) => ({
  info: null,
  isLoading: false,
  isApplying: false,
  error: null,
  success: null,

  load: async (force = false) => {
    if (get().isLoading && !force) return;
    set({ isLoading: true, error: null });

    try {
      const info = await fetchReferralInfo();
      set({ info, isLoading: false });
    } catch (error) {
      set({ isLoading: false, error: getErrorMessage(error) });
    }
  },

  applyCode: async (code) => {
    const value = code.trim();
    if (!value) {
      set({ error: 'Введи реферальный код' });
      return;
    }

    set({ isApplying: true, error: null, success: null });

    try {
      const info = await applyReferralCode(value);
      set({ info, isApplying: false, success: 'Код применён' });
      await Promise.allSettled([useProgressionStore.getState().load(true)]);
    } catch (error) {
      set({ isApplying: false, error: getErrorMessage(error) });
      throw error;
    }
  },
}));
