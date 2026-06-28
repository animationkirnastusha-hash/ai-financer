import type { MessageKind, MessageRole } from '@/entities/message/model/message.types';

export type ChatCommandSource = 'text';

export type SendChatMessagePayload = {
  text: string;
  displayText?: string;
  source?: ChatCommandSource;
  execute?: boolean;
  idempotencyKey?: string;
};

export type SendChatMessageOptions = {
  supersedeInFlight?: boolean;
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
    undo?: {
      available: boolean;
      actionType?: 'transaction';
      targetId?: string;
    };
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
  auditLogId?: string;
  canUndo?: boolean;
  data?: Record<string, unknown>;
};

export type ChatResponse = AIParseResult;
