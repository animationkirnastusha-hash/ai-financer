import type { MessageEntity } from '@/entities/message/model/message.types';
import { cn } from '@/shared/lib/cn';
import { formatTime } from '@/shared/lib/format';
import { FinancePreviewCard } from '@/features/chat/ui/FinancePreviewCard';
import { Button } from '@/shared/ui/Button';

type MessageCardProps = {
  message: MessageEntity & { auditLogId?: string; canUndo?: boolean };
  onConfirm?: (id: string) => void;
  onCancel?: (id: string) => void;
  onUndo?: (auditLogId: string) => void;
};

export function MessageCard({
  message,
  onConfirm,
  onCancel,
  onUndo,
}: MessageCardProps) {
  const isUser = message.role === 'user';

  if (message.kind === 'preview') {
    return (
      <div className="text-chat-message text-chat-message--preview">
        <div className="text-chat-message__preview">
          <FinancePreviewCard
            title={message.text}
            intent={message.actionType}
            actionId={message.actionId}
            data={message.data}
            onConfirm={onConfirm}
            onCancel={onCancel}
          />
          <div className="text-chat-message__time">{formatTime(message.createdAt)}</div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'text-chat-message',
        isUser ? 'text-chat-message--user' : 'text-chat-message--assistant',
        !isUser && message.kind === 'success' && 'text-chat-message--success',
        !isUser && message.kind === 'error' && 'text-chat-message--error',
      )}
    >
      <div className="text-chat-message__bubble">
        <div className="text-chat-message__text">{message.text}</div>

        {!isUser && message.canUndo && message.auditLogId ? (
          <div className="text-chat-message__undo">
            <Button
              className="h-9 px-3 text-xs"
              variant="secondary"
              onClick={() => onUndo?.(message.auditLogId!)}
            >
              Отменить
            </Button>
          </div>
        ) : null}

        <div className="text-chat-message__time">{formatTime(message.createdAt)}</div>
      </div>
    </div>
  );
}
