import { useEffect, useMemo, useRef, useState } from 'react';

import { AuditLogDrawer } from '@/features/audit-log/ui/AuditLogDrawer';
import { MessageList } from '@/features/chat/ui/MessageList';
import { useChatController } from '@/features/chat/model/useChatController';
import { PendingActionsDrawer } from '@/features/pending-actions/ui/PendingActionsDrawer';
import { useI18n } from '@/shared/lib/i18n';

type TextChatOverlayProps = {
  open: boolean;
  initialCommand?: string | null;
  layer?: number;
  onClose: () => void;
};

export function TextChatOverlay({ open, initialCommand, layer = 130, onClose }: TextChatOverlayProps) {
  const { t } = useI18n();
  const [value, setValue] = useState(initialCommand?.trim() ?? '');
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const initialCommandRef = useRef<string | null>(null);

  const chat = useChatController();
  const lastAssistant = useMemo(
    () => chat.messages.filter((message) => message.role === 'assistant').at(-1),
    [chat.messages],
  );

  useEffect(() => {
    if (!open) return;
    const command = initialCommand?.trim() ?? '';
    if (!command || initialCommandRef.current === command) return;
    initialCommandRef.current = command;
    setValue(command);
  }, [initialCommand, open]);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => inputRef.current?.focus(), 120);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;

    input.style.height = 'auto';
    input.style.height = `${Math.min(input.scrollHeight, 132)}px`;
  }, [value]);

  if (!open) return null;

  const submit = async () => {
    const text = value.trim();
    if (!text || chat.isSending) return;
    setValue('');
    await chat.sendMessage({ text, source: 'text' }, { supersedeInFlight: true });
    window.setTimeout(() => inputRef.current?.blur(), 40);
  };

  const handleKeyDown = async (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Enter' || event.shiftKey) return;
    event.preventDefault();
    await submit();
  };

  return (
    <div
      className="text-chat-overlay"
      data-no-swipe="true"
      data-ai-core-modal="true"
      style={{ zIndex: layer }}
      onClick={onClose}
    >
      <div className="text-chat-overlay__stage" onClick={(event) => event.stopPropagation()}>
        <header className="text-chat-overlay__head">
          <div>
            <div className="app-eyebrow">{t('textChat.eyebrow')}</div>
            <h2>{t('textChat.title')}</h2>
          </div>
          <button type="button" className="app-icon-button" onClick={onClose} aria-label={t('common.close')}>
            ×
          </button>
        </header>

        <div className="text-chat-overlay__status" data-state={chat.isSending ? 'thinking' : chat.pendingActions.length > 0 ? 'confirm' : 'ready'}>
          <span className="text-chat-overlay__dot" />
          <span>
            {chat.isSending
              ? t('textChat.status.thinking')
              : chat.pendingActions.length > 0
                ? t('textChat.status.confirm', { count: chat.pendingActions.length })
                : lastAssistant?.text || t('textChat.status.ready')}
          </span>
        </div>

        {chat.messages.length > 0 ? (
          <MessageList
            messages={chat.messages}
            onConfirm={chat.confirmAction}
            onCancel={chat.cancelAction}
            onUndo={chat.undoMessageAction}
          />
        ) : (
          <div className="text-chat-overlay__empty">
            <div className="text-chat-overlay__orb">Ф</div>
            <h3>{t('textChat.empty.title')}</h3>
            <p>{t('textChat.empty.caption')}</p>
            <div className="text-chat-overlay__chips">
              <button type="button" onClick={() => setValue(t('textChat.prompt.expense'))}>{t('textChat.prompt.expense')}</button>
              <button type="button" onClick={() => setValue(t('textChat.prompt.goal'))}>{t('textChat.prompt.goal')}</button>
            </div>
          </div>
        )}

        {chat.pendingActions.length > 0 ? (
          <button type="button" className="text-chat-overlay__pending" onClick={chat.openPending}>
            <strong>{t('textChat.pending.title')}</strong>
            <span>{t('textChat.pending.caption', { count: chat.pendingActions.length })}</span>
          </button>
        ) : null}

        <form
          className="text-chat-overlay__composer"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <textarea
            ref={inputRef}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            placeholder={t('textChat.placeholder')}
            disabled={chat.isSending}
          />
          <button type="submit" disabled={chat.isSending || !value.trim()} aria-label={t('textChat.send')}>
            ↑
          </button>
        </form>
      </div>

      <PendingActionsDrawer
        open={chat.isPendingOpen}
        items={chat.pendingActions}
        onClose={chat.closePending}
        onConfirm={chat.confirmAction}
        onCancel={chat.cancelAction}
        onUpdate={chat.updatePendingAction}
      />

      <AuditLogDrawer
        open={chat.isAuditOpen}
        items={chat.auditLogs}
        onClose={chat.closeAudit}
      />
    </div>
  );
}
