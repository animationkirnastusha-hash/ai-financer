import type { MessageKind, MessageRole } from '@/entities/message/model/message.types';
export type SendChatMessagePayload = {
  text: string;
};

export type AIParseResult = {
  success: boolean;
  intent: string;
  executed: boolean;
  requiresConfirmation: boolean;
  riskLevel: 'low' | 'medium' | 'high';
  message: string;
  parsed: Record<string, unknown> | null;
  meta?: {
    auditLogId?: string;
    pendingActionId?: string;
  };
};
export type ChatMessage = {
  id: string;
  role: MessageRole;
  kind: MessageKind;
  text: string;
  content: string;
  createdAt: string;

  actionId?: string;
  actionType?: string;
  data?: Record<string, unknown>;
};
export type ChatResponse = AIParseResult;