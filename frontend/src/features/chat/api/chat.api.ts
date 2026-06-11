import { request } from '@/shared/api/http';
import { apiClient } from '@/shared/api/client';
import type {
  ChatResponse,
  SendChatMessagePayload,
} from '@/features/chat/model/chat.types';

function buildIdempotencyKey(payload: SendChatMessagePayload) {
  const key = payload.idempotencyKey?.trim() || payload.voiceSession?.id?.trim() || '';
  return key ? key.slice(0, 128) : undefined;
}

export const chatApi = {
  sendMessage: (payload: SendChatMessagePayload, signal?: AbortSignal) => {
    const idempotencyKey = buildIdempotencyKey(payload);

    return request<ChatResponse>('/ai/parse', {
      method: 'POST',
      signal,
      headers: idempotencyKey ? { 'x-idempotency-key': idempotencyKey } : undefined,
      body: {
        command: payload.text,
        execute: payload.execute ?? true,
        source: payload.source ?? 'text',
        voiceSession: payload.voiceSession,
        idempotencyKey,
      },
    });
  },

  undoByAuditLog: (auditLogId: string) =>
    apiClient.post<any>('/ai/undo', { auditLogId, idempotencyKey: `undo:${auditLogId}` }),
};
