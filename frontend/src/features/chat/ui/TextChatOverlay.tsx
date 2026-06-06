import { useEffect, useMemo, useRef, useState } from 'react';

import { AuditLogDrawer } from '@/features/audit-log/ui/AuditLogDrawer';
import { MessageCard } from '@/features/chat/ui/MessageCard';
import { FinancePreviewCard } from '@/features/chat/ui/FinancePreviewCard';
import { useChatController } from '@/features/chat/model/useChatController';
import { useI18n } from '@/shared/lib/i18n';

const SCROLL_BOTTOM_THRESHOLD_PX = 120;

type TextChatOverlayProps = {
  open: boolean;
  initialCommand?: string | null;
  layer?: number;
  onClose: () => void;
};

export function TextChatOverlay({ open, initialCommand, layer = 130, onClose }: TextChatOverlayProps) {
  const { t } = useI18n();
  const [value, setValue] = useState(initialCommand?.trim() ?? '');
  const [showJumpToBottom, setShowJumpToBottom] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const initialCommandRef = useRef<string | null>(null);
  const shouldStickToBottomRef = useRef(true);

  const chat = useChatController();
  const pendingActionIdsInMessages = useMemo(() => new Set(
    chat.messages
      .map((message) => message.actionId)
      .filter((actionId): actionId is string => Boolean(actionId)),
  ), [chat.messages]);
  const inlinePendingActions = useMemo(
    () => chat.pendingActions.filter((action) => action?.id && !pendingActionIdsInMessages.has(action.id)),
    [chat.pendingActions, pendingActionIdsInMessages],
  );

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    const list = listRef.current;
    if (!list) return;
    list.scrollTo({ top: list.scrollHeight, behavior });
    shouldStickToBottomRef.current = true;
    setShowJumpToBottom(false);
  };

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

  useEffect(() => {
    if (!open) return;
    const frame = window.requestAnimationFrame(() => {
      if (shouldStickToBottomRef.current) scrollToBottom('auto');
      else setShowJumpToBottom(true);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [chat.messages.length, inlinePendingActions.length, chat.isSending, open]);

  if (!open) return null;

  const submit = async () => {
    const text = value.trim();
    if (!text || chat.isSending) return;
    setValue('');
    shouldStickToBottomRef.current = true;
    await chat.sendMessage({ text, source: 'text' }, { supersedeInFlight: true });
    window.setTimeout(() => inputRef.current?.blur(), 40);
  };

  const handleKeyDown = async (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Enter' || event.shiftKey) return;
    event.preventDefault();
    await submit();
  };

  const handleMessagesScroll = () => {
    const list = listRef.current;
    if (!list) return;
    const distanceToBottom = list.scrollHeight - list.scrollTop - list.clientHeight;
    const isNearBottom = distanceToBottom < SCROLL_BOTTOM_THRESHOLD_PX;
    shouldStickToBottomRef.current = isNearBottom;
    setShowJumpToBottom(!isNearBottom);
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
          <div className="text-chat-overlay__title-block">
            <div className="app-eyebrow">{t('textChat.eyebrow')}</div>
            <h2>{t('textChat.title')}</h2>
          </div>
          <div className="text-chat-overlay__head-actions">
            <div className="text-chat-overlay__companion" aria-hidden="true">
              <span className="text-chat-overlay__companion-face"><span /><span /></span>
            </div>
            <button type="button" className="app-icon-button" onClick={onClose} aria-label={t('common.close')}>
              ×
            </button>
          </div>
        </header>

        <div className="text-chat-overlay__status" data-state={chat.isSending ? 'thinking' : chat.pendingActions.length > 0 ? 'confirm' : 'ready'}>
          <span className="text-chat-overlay__dot" />
          <span>
            {chat.isSending
              ? t('textChat.status.thinking')
              : chat.pendingActions.length > 0
                ? t('textChat.status.confirm', { count: chat.pendingActions.length })
                : t('textChat.status.ready')}
          </span>
        </div>

        <div ref={listRef} className="text-chat-overlay__messages" onScroll={handleMessagesScroll}>
          {chat.messages.length > 0 || inlinePendingActions.length > 0 ? (
            <div className="text-chat-overlay__message-stack">
              {chat.messages.map((message, index) => (
                <MessageCard
                  key={message.id || `${message.role}-${message.createdAt}-${index}`}
                  message={message}
                  onConfirm={chat.confirmAction}
                  onCancel={chat.cancelAction}
                  onUndo={chat.undoMessageAction}
                />
              ))}
              {inlinePendingActions.map((action) => (
                <FinancePreviewCard
                  key={action.id}
                  title={action.title || action.message || t('textChat.pending.title')}
                  intent={action.intent || action.type}
                  actionId={action.id}
                  data={(action.parsed || action.payload || action.data || {}) as Record<string, unknown>}
                  onConfirm={chat.confirmAction}
                  onCancel={chat.cancelAction}
                />
              ))}
              {chat.isSending ? (
                <div className="text-chat-overlay__typing">
                  <span />
                  <span />
                  <span />
                </div>
              ) : null}
            </div>
          ) : (
            <div className="text-chat-overlay__empty">
              <div className="text-chat-overlay__orb">⌁</div>
              <h3>{t('textChat.empty.title')}</h3>
              <p>{t('textChat.empty.caption')}</p>
              <div className="text-chat-overlay__chips">
                <button type="button" onClick={() => setValue(t('textChat.prompt.expense'))}>{t('textChat.prompt.expense')}</button>
                <button type="button" onClick={() => setValue(t('textChat.prompt.goal'))}>{t('textChat.prompt.goal')}</button>
              </div>
            </div>
          )}
        </div>

        {showJumpToBottom ? (
          <button type="button" className="text-chat-overlay__jump" onClick={() => scrollToBottom()} aria-label="К последним сообщениям">
            ↓
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

      <AuditLogDrawer
        open={chat.isAuditOpen}
        items={chat.auditLogs}
        onClose={chat.closeAudit}
      />
    </div>
  );
}
