import { create } from 'zustand';
import { receiptScansApi, type CreateReceiptExpensePayload, type ReceiptScanDto, type ReviewReceiptScanPayload } from '@/features/receipt-scans/api/receiptScans.api';
import { useSubscriptionStore } from '@/features/subscription/model/subscription.store';

function replaceItem(items: ReceiptScanDto[], next: ReceiptScanDto) {
  return items.map((item) => (item.id === next.id ? next : item));
}

type ReceiptScansState = {
  items: ReceiptScanDto[];
  isLoading: boolean;
  isUploading: boolean;
  isSaving: boolean;
  error: string | null;
  load: () => Promise<void>;
  upload: (file: File) => Promise<ReceiptScanDto | null>;
  review: (receiptScanId: string, payload: ReviewReceiptScanPayload) => Promise<ReceiptScanDto | null>;
  createExpense: (receiptScanId: string, payload: CreateReceiptExpensePayload) => Promise<ReceiptScanDto | null>;
  clearError: () => void;
};

export const useReceiptScansStore = create<ReceiptScansState>((set) => ({
  items: [],
  isLoading: false,
  isUploading: false,
  isSaving: false,
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

  review: async (receiptScanId, payload) => {
    set({ isSaving: true, error: null });
    try {
      const response = await receiptScansApi.review(receiptScanId, payload);
      set((state) => ({ items: replaceItem(state.items, response.scan), isSaving: false }));
      return response.scan;
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'receipt_scan_review_failed', isSaving: false });
      return null;
    }
  },

  createExpense: async (receiptScanId, payload) => {
    set({ isSaving: true, error: null });
    try {
      const response = await receiptScansApi.createExpense(receiptScanId, payload);
      set((state) => ({ items: replaceItem(state.items, response.scan), isSaving: false }));
      return response.scan;
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'receipt_scan_expense_failed', isSaving: false });
      return null;
    }
  },
}));
