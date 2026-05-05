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
      <div className="flex w-full justify-start">
        <div className="space-y-2">
          <FinancePreviewCard
            title={message.text}
            intent={message.actionType}
            actionId={message.actionId}
            data={message.data}
            onConfirm={onConfirm}
            onCancel={onCancel}
          />
          <div className="pl-1 text-[11px] text-white/35">
            {formatTime(message.createdAt)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('flex w-full', isUser ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[85%] rounded-[24px] px-4 py-3',
          isUser && 'bg-emerald-400 text-black',
          !isUser && message.kind === 'success' && 'border border-emerald-400/20 bg-emerald-400/10 text-white',
          !isUser && message.kind === 'error' && 'border border-rose-400/20 bg-rose-400/10 text-white',
          !isUser && message.kind === 'text' && 'border border-white/10 bg-white/6 text-white',
        )}
      >
        <div className="whitespace-pre-wrap text-sm leading-6">{message.text}</div>

        {!isUser && message.canUndo && message.auditLogId ? (
          <div className="mt-3">
            <Button
              className="h-9 px-3 text-xs"
              variant="secondary"
              onClick={() => onUndo?.(message.auditLogId!)}
            >
              ↩️ Отменить
            </Button>
          </div>
        ) : null}

        <div
          className={cn(
            'mt-2 text-[11px]',
            isUser ? 'text-black/60' : 'text-white/35',
          )}
        >
          {formatTime(message.createdAt)}
        </div>
      </div>
    </div>
  );
}
