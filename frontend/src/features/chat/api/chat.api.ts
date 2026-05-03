import { apiClient } from '@/shared/api/client';
import type {
  ChatResponse,
  SendChatMessagePayload,
} from '@/features/chat/model/chat.types';

export const chatApi = {
  sendMessage: (payload: SendChatMessagePayload) =>
    apiClient.post<ChatResponse>('/ai/parse', {
      command: payload.text,
      execute: true,
    }),
};