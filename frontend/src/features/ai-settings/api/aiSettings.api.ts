import { apiClient } from '@/shared/api/client';
import type {
  AISettingsPreset,
  AISettingsSnapshot,
  AISettingsUpdatePayload,
} from '@/features/ai-settings/model/aiSettings.types';

export const aiSettingsApi = {
  get: (signal?: AbortSignal) => apiClient.get<AISettingsSnapshot>('/ai-settings', signal),
  update: (payload: AISettingsUpdatePayload, signal?: AbortSignal) =>
    apiClient.patch<AISettingsSnapshot>('/ai-settings', payload, signal),
  applyPreset: (preset: AISettingsPreset, signal?: AbortSignal) =>
    apiClient.post<AISettingsSnapshot>(`/ai-settings/preset/${preset}`, undefined, signal),
};
