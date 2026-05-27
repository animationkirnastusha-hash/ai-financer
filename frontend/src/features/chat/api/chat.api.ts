import { apiClient } from '@/shared/api/client';
import type {
  ChatResponse,
  SendChatMessagePayload,
} from '@/features/chat/model/chat.types';

export const chatApi = {
  sendMessage: (payload: SendChatMessagePayload, signal?: AbortSignal) =>
    apiClient.post<ChatResponse>('/ai/parse', {
      command: payload.text,
      execute: payload.execute ?? true,
      source: payload.source ?? 'text',
      voiceSession: payload.voiceSession,
    }, signal),

  undoByAuditLog: (auditLogId: string) =>
    apiClient.post<any>('/ai/undo', { auditLogId }),
};
