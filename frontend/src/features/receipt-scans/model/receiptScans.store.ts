import { create } from 'zustand';
import { receiptScansApi, type ReceiptScanDto } from '@/features/receipt-scans/api/receiptScans.api';
import { useSubscriptionStore } from '@/features/subscription/model/subscription.store';

type ReceiptScansState = {
  items: ReceiptScanDto[];
  isLoading: boolean;
  isUploading: boolean;
  error: string | null;
  load: () => Promise<void>;
  upload: (file: File) => Promise<ReceiptScanDto | null>;
  clearError: () => void;
};

export const useReceiptScansStore = create<ReceiptScansState>((set) => ({
  items: [],
  isLoading: false,
  isUploading: false,
  error: null,

  clearError: () => set({ error: null }),

  load: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await receiptScansApi.list();
      set({ items: response.items, isLoading: false });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'receipt_scan_load_failed', isLoading: false });
    }
  },

  upload: async (file) => {
    set({ isUploading: true, error: null });
    try {
      const response = await receiptScansApi.upload(file);
      useSubscriptionStore.getState().setStatus(response.subscription);
      set((state) => ({ items: [response.scan, ...state.items], isUploading: false }));
      return response.scan;
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'receipt_scan_upload_failed', isUploading: false });
      return null;
    }
  },
}));
