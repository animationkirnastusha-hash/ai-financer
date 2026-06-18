import { useCallback, useState } from 'react';

import type { MessageEntity } from '@/entities/message/model/message.types';
import { cn } from '@/shared/lib/cn';
import { formatTime } from '@/shared/lib/format';
import { FinancePreviewCard } from '@/features/chat/ui/FinancePreviewCard';
import { AssistantTypingText } from '@/features/chat/ui/message/AssistantTypingText';
import { useI18n } from '@/shared/lib/i18n';
import { Button } from '@/shared/ui/Button';


async function copyMessageText(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', 'true');
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  textarea.style.top = '0';
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  document.body.removeChild(textarea);
}

type MessageCardProps = {
  message: MessageEntity & { auditLogId?: string; canUndo?: boolean };
  onConfirm?: (id: string) => void;
  onCancel?: (id: string) => void;
  onUndo?: (auditLogId: string) => void;
  animateText?: boolean;
};

export function MessageCard({
  message,
  onConfirm,
  onCancel,
  onUndo,
  animateText = false,
}: MessageCardProps) {
  const { t } = useI18n();
  const isUser = message.role === 'user';
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');

  const handleCopy = useCallback(async () => {
    if (!message.text) return;

    try {
      await copyMessageText(message.text);
      setCopyState('copied');
    } catch {
      setCopyState('failed');
    }

    window.setTimeout(() => setCopyState('idle'), 1400);
  }, [message.text]);

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
        <div className="text-chat-message__text">
          {!isUser ? <AssistantTypingText text={message.text} enabled={animateText} /> : message.text}
        </div>

        {!isUser && message.canUndo && message.auditLogId ? (
          <div className="text-chat-message__undo">
            <Button
              className="h-9 px-3 text-xs"
              variant="secondary"
              onClick={() => onUndo?.(message.auditLogId!)}
            >
              {t('voicePending.action.cancel')}
            </Button>
          </div>
        ) : null}

        <div className="text-chat-message__meta-row">
          <div className="text-chat-message__time">{formatTime(message.createdAt)}</div>
          {isUser ? (
            <button
              type="button"
              className="text-chat-message__copy"
              onClick={handleCopy}
              aria-label={t('textChat.message.copy')}
            >
              {copyState === 'copied'
                ? t('textChat.message.copied')
                : copyState === 'failed'
                  ? t('textChat.message.copyFailed')
                  : t('textChat.message.copy')}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
