import { useMemo, type ReactNode, type RefObject } from 'react';

import { FinancePreviewCard } from '@/features/chat/ui/FinancePreviewCard';
import { MessageCard } from '@/features/chat/ui/MessageCard';
import type { ChatMessage } from '@/features/chat/model/chat.types';

type PendingActionLike = {
  id?: string;
  title?: string;
  message?: string;
  intent?: string;
  type?: string;
  parsed?: unknown;
  payload?: unknown;
  data?: unknown;
};

type Props = {
  listRef: RefObject<HTMLDivElement | null>;
  messages: ChatMessage[];
  inlinePendingActions: PendingActionLike[];
  isSending: boolean;
  pendingTitle: string;
  onScroll: () => void;
  onConfirm: (actionId: string) => void | Promise<void>;
  onCancel: (actionId: string) => void | Promise<void>;
  onUndo: (auditLogId: string) => void | Promise<void>;
  emptyState: ReactNode;
};

export function TextChatMessages({
  listRef,
  messages,
  inlinePendingActions,
  isSending,
  pendingTitle,
  onScroll,
  onConfirm,
  onCancel,
  onUndo,
  emptyState,
}: Props) {
  const hasContent = messages.length > 0 || inlinePendingActions.length > 0;
  const latestAssistantMessageId = useMemo(() => {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      const message = messages[index];
      if (message.role === 'assistant' && message.kind !== 'preview') return message.id;
    }
    return null;
  }, [messages]);

  const shouldAnimateAssistantMessage = (message: ChatMessage) => {
    if (message.id !== latestAssistantMessageId || isSending) return false;
    const createdAt = Date.parse(message.createdAt);
    return Number.isFinite(createdAt) && Date.now() - createdAt < 9000;
  };

  return (
    <div
      ref={listRef}
      className="text-chat-overlay__messages"
      onScroll={onScroll}
    >
      {hasContent ? (
        <div className="text-chat-overlay__message-stack">
          {messages.map((message, index) => (
            <MessageCard
              key={message.id || `${message.role}-${message.createdAt}-${index}`}
              message={message}
              onConfirm={onConfirm}
              onCancel={onCancel}
              onUndo={onUndo}
              animateText={shouldAnimateAssistantMessage(message)}
            />
          ))}
          {inlinePendingActions.map((action) => (
            <FinancePreviewCard
              key={action.id}
              title={action.title || action.message || pendingTitle}
              intent={action.intent || action.type}
              actionId={action.id}
              data={
                (action.parsed ||
                  action.payload ||
                  action.data ||
                  {}) as Record<string, unknown>
              }
              onConfirm={onConfirm}
              onCancel={onCancel}
            />
          ))}
          {isSending ? (
            <div className="text-chat-overlay__typing">
              <span />
              <span />
              <span />
            </div>
          ) : null}
        </div>
      ) : (
        emptyState
      )}
    </div>
  );
}
