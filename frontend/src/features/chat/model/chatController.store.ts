import { create } from 'zustand';

export type ChatControllerStoreState = {
  pendingActions: any[];
  auditLogs: any[];
  isPendingOpen: boolean;
  isAuditOpen: boolean;
  isSending: boolean;

  setPendingActions: (value: any[] | ((items: any[]) => any[])) => void;
  setAuditLogs: (value: any[] | ((items: any[]) => any[])) => void;
  setIsPendingOpen: (value: boolean) => void;
  setIsAuditOpen: (value: boolean) => void;
  setIsSending: (value: boolean) => void;
};

export const useChatControllerStore = create<ChatControllerStoreState>((set) => ({
  pendingActions: [],
  auditLogs: [],
  isPendingOpen: false,
  isAuditOpen: false,
  isSending: false,

  setPendingActions: (value) => set((state) => ({
    pendingActions: typeof value === 'function' ? value(state.pendingActions) : value,
  })),
  setAuditLogs: (value) => set((state) => ({
    auditLogs: typeof value === 'function' ? value(state.auditLogs) : value,
  })),
  setIsPendingOpen: (value) => set({ isPendingOpen: value }),
  setIsAuditOpen: (value) => set({ isAuditOpen: value }),
  setIsSending: (value) => set({ isSending: value }),
}));
