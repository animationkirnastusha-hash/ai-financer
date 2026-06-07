import { create } from 'zustand';
import { businessWorkspaceApi, type BusinessWorkspaceAccountDto, type BusinessWorkspaceDto, type BusinessWorkspaceSummaryDto, type UpdateBusinessWorkspacePayload } from '@/features/business-workspace/api/businessWorkspace.api';

type BusinessWorkspaceState = {
  workspace: BusinessWorkspaceDto | null;
  summary: BusinessWorkspaceSummaryDto | null;
  accounts: BusinessWorkspaceAccountDto[];
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  load: () => Promise<void>;
  save: (payload: UpdateBusinessWorkspacePayload) => Promise<void>;
};

export const useBusinessWorkspaceStore = create<BusinessWorkspaceState>((set, get) => ({
  workspace: null,
  summary: null,
  accounts: [],
  isLoading: false,
  isSaving: false,
  error: null,

  load: async () => {
    if (get().isLoading) return;
    set({ isLoading: true, error: null });
    try {
      const payload = await businessWorkspaceApi.me();
      set({
        workspace: payload.workspace,
        summary: payload.summary,
        accounts: payload.accounts,
        isLoading: false,
      });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'business_workspace_error', isLoading: false });
    }
  },

  save: async (payload) => {
    set({ isSaving: true, error: null });
    try {
      const result = await businessWorkspaceApi.update(payload);
      set({ workspace: result.workspace, summary: result.summary, isSaving: false });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'business_workspace_error', isSaving: false });
      throw error;
    }
  },
}));
