import type { MessageEntity } from '@/entities/message/model/message.types';
import { useAutoScroll } from '@/shared/hooks/useAutoScroll';
import { MessageCard } from '@/features/chat/ui/MessageCard';

type MessageListProps = {
  messages: MessageEntity[];
  onConfirm?: (id: string) => void;
  onCancel?: (id: string) => void;
  onUndo?: (auditLogId: string) => void;
};

export function MessageList({
  messages,
  onConfirm,
  onCancel,
  onUndo,
}: MessageListProps) {
  const containerRef = useAutoScroll<HTMLDivElement>([messages]);

  return (
    <div ref={containerRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
      <div className="flex flex-col gap-3">
        {messages.map((message, index) => (
          <MessageCard
            key={message.id || `${message.role}-${message.createdAt}-${index}`}
            message={message}
            onConfirm={onConfirm}
            onCancel={onCancel}
            onUndo={onUndo}
          />
        ))}
      </div>
    </div>
  );
}