import type { MessageEntity } from '@/entities/message/model/message.types';
import { formatAIMessage } from '@/features/chat/lib/formatAIMessage';
import type { AIParseResult } from '@/features/chat/model/chat.types';

export function mapParseResultToMessage(result: AIParseResult): MessageEntity {
  const shouldRenderAsPreview = !!result.parsed && !result.executed;

  return {
    id: result.meta?.auditLogId || crypto.randomUUID(),
    role: 'assistant',
    kind: shouldRenderAsPreview
      ? 'preview'
      : result.success
        ? 'success'
        : 'error',
    text: formatAIMessage(result),
    createdAt: new Date().toISOString(),
    actionId: result.meta?.pendingActionId,
    actionType: result.intent,
    data: {
      ...(result.parsed ?? {}),
      riskLevel: result.riskLevel,
      executed: result.executed,
      requiresConfirmation: result.requiresConfirmation,
      auditLogId: result.meta?.auditLogId,
      rawMessage: result.message,
    },
  };
}