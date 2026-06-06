import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';

import { useAccountsStore } from '@/features/accounts/model/accounts.store';
import { AuditLogDrawer } from '@/features/audit-log/ui/AuditLogDrawer';
import { FinancePreviewCard } from '@/features/chat/ui/FinancePreviewCard';
import { MessageCard } from '@/features/chat/ui/MessageCard';
import { useChatController } from '@/features/chat/model/useChatController';
import { useSettingsStore } from '@/features/settings/model/settings.store';
import { useTransactionsStore } from '@/features/transactions/model/transactions.store';
import { useVoiceInput } from '@/features/voice/model/useVoiceInput';
import { VOICE_MANUAL_SESSION_MS } from '@/features/voice/model/voiceConstants';
import { normalizeForWake, normalizeVoiceText, shouldIgnoreVoiceCommand } from '@/features/voice/model/voiceText';
import { useI18n } from '@/shared/lib/i18n';

const SCROLL_BOTTOM_THRESHOLD_PX = 120;

type TextChatOverlayProps = {
  open: boolean;
  initialCommand?: string | null;
  mode?: 'text' | 'voice';
  autoStartVoice?: boolean;
  layer?: number;
  onClose: () => void;
};

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function stripOptionalCompanionName(text: string, companionName: string) {
  const cleanText = normalizeVoiceText(text);
  const cleanName = normalizeForWake(companionName || 'Фина');
  const aliases = Array.from(new Set([cleanName, 'фина', 'финна', 'фину', 'фине', 'финой', 'fina'].filter(Boolean)));

  for (const alias of aliases) {
    const pattern = new RegExp(`^\\s*${escapeRegExp(alias)}[\\s,.:;!—-]*`, 'i');
    if (pattern.test(cleanText)) return normalizeVoiceText(cleanText.replace(pattern, ''));
  }

  return cleanText;
}

function formatAmount(value: number | string | null | undefined) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return '';
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(amount);
}

function chooseAccountName(accounts: Array<{ name?: string | null; type?: string | null }>) {
  const preferred = accounts.find((account) => String(account.type).toLowerCase() === 'cash')
    ?? accounts.find((account) => String(account.name ?? '').toLowerCase().includes('нал'))
    ?? accounts.find((account) => String(account.name ?? '').toLowerCase().includes('карт'))
    ?? accounts[0];
  return preferred?.name?.trim() || '';
}

export function TextChatOverlay({ open, initialCommand, mode = 'text', autoStartVoice = false, layer = 130, onClose }: TextChatOverlayProps) {
  const { t } = useI18n();
  const [value, setValue] = useState(initialCommand?.trim() ?? '');
  const [showJumpToBottom, setShowJumpToBottom] = useState(false);
  const [isVoicePressed, setIsVoicePressed] = useState(false);
  const [voiceHint, setVoiceHint] = useState<string | null>(mode === 'voice' ? 'Слушаю' : null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const initialCommandRef = useRef<string | null>(null);
  const shouldStickToBottomRef = useRef(true);
  const autoStartDoneRef = useRef(false);
  const stopVoiceRef = useRef<(reason?: string) => void>(() => undefined);

  const chat = useChatController();
  const accounts = useAccountsStore((state) => state.items);
  const transactions = useTransactionsStore((state) => state.items);
  const companionName = useSettingsStore((state) => state.companionName || 'Фина');
  const appLanguage = useSettingsStore((state) => state.appLanguage);
  const voicePermissionPrompted = useSettingsStore((state) => state.voicePermissionPrompted);
  const setVoicePermissionPrompted = useSettingsStore((state) => state.setVoicePermissionPrompted);

  const pendingActionIdsInMessages = useMemo(() => new Set(
    chat.messages
      .map((message) => message.actionId)
      .filter((actionId): actionId is string => Boolean(actionId)),
  ), [chat.messages]);

  const inlinePendingActions = useMemo(
    () => chat.pendingActions.filter((action) => action?.id && !pendingActionIdsInMessages.has(action.id)),
    [chat.pendingActions, pendingActionIdsInMessages],
  );

  const sendText = useCallback(async (text: string, source: 'text' | 'voice' = 'text') => {
    const clean = text.trim();
    if (!clean || chat.isSending) return;
    shouldStickToBottomRef.current = true;
    await chat.sendMessage({ text: clean, source }, { supersedeInFlight: true });
  }, [chat]);

  const voice = useVoiceInput({
    lang: appLanguage === 'en' ? 'en-US' : 'ru-RU',
    sessionMs: VOICE_MANUAL_SESSION_MS,
    permissionWasPrompted: voicePermissionPrompted,
    onText: async (rawText) => {
      const text = stripOptionalCompanionName(rawText, companionName);
      if (!text || shouldIgnoreVoiceCommand(text)) {
        setVoiceHint('Не расслышала');
        return;
      }
      setVoiceHint('Думаю');
      await sendText(text, 'voice');
      setVoiceHint(null);
    },
  });

  const statusText = useMemo(() => {
    if (voice.state === 'recording') return 'Слушаю';
    if (voice.state === 'uploading') return 'Распознаю';
    if (chat.isSending) return t('textChat.status.thinking');
    if (chat.pendingActions.length > 0) return t('textChat.status.confirm', { count: chat.pendingActions.length });
    return voiceHint || t('textChat.status.ready');
  }, [chat.isSending, chat.pendingActions.length, t, voice.state, voiceHint]);

  const statusState = voice.state === 'recording'
    ? 'listening'
    : voice.state === 'uploading' || chat.isSending
      ? 'thinking'
      : chat.pendingActions.length > 0
        ? 'confirm'
        : 'ready';

  const contextualPrompts = useMemo(() => {
    const accountName = chooseAccountName(accounts);
    const latest = transactions[0];
    const latestAmount = formatAmount(latest?.amount);
    const latestTitle = latest?.title || latest?.description || 'последнюю операцию';

    const prompts = [
      accountName ? `расход 300 кофе с ${accountName}` : 'расход 300 кофе',
      accountName ? `доход 5000 на ${accountName}` : 'доход 5000',
      accountName ? `поставь лимит на ${accountName} 20000 в месяц` : 'поставь общий лимит расходов 80000 в месяц',
      'покажи лимиты',
      'создай цель отпуск 120000',
    ];

    if (latest?.id && latestAmount) prompts.unshift(`измени ${latestTitle} на ${latestAmount}`);

    return Array.from(new Set(prompts)).slice(0, 3);
  }, [accounts, transactions]);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    const list = listRef.current;
    if (!list) return;
    list.scrollTo({ top: list.scrollHeight, behavior });
    shouldStickToBottomRef.current = true;
    setShowJumpToBottom(false);
  }, []);

  const stopVoice = useCallback((reason = 'manual_stop') => {
    setIsVoicePressed(false);
    if (voice.state === 'recording') {
      setVoiceHint('Распознаю');
      voice.stop();
      return;
    }
    if (reason === 'cancel') {
      voice.cancel();
      setVoiceHint(null);
    }
  }, [voice]);

  stopVoiceRef.current = stopVoice;

  const startVoice = useCallback(async () => {
    if (chat.isSending || voice.state === 'recording' || voice.state === 'uploading') return;
    setIsVoicePressed(true);
    setVoiceHint('Слушаю');

    const result = await voice.start();
    if (result === 'started') return;

    if (result === 'permission-ready') {
      try {
        const ready = await voice.primePermission();
        if (ready) {
          setVoicePermissionPrompted(true);
          const secondTry = await voice.start();
          if (secondTry === 'started') return;
        }
      } catch {
        // handled below by fallback state
      }
      setVoiceHint('Нужен доступ к микрофону');
    } else if (result === 'busy') {
      setVoiceHint('Секунду');
    } else {
      setVoiceHint('Не удалось начать запись');
    }

    setIsVoicePressed(false);
  }, [chat.isSending, setVoicePermissionPrompted, voice]);

  useEffect(() => {
    if (!open) return;
    void voice.refreshPermissionState?.();
  }, [open, voice.refreshPermissionState]);

  useEffect(() => {
    if (!open || mode !== 'voice' || !autoStartVoice || autoStartDoneRef.current) return;
    autoStartDoneRef.current = true;

    const stop = () => stopVoiceRef.current('auto_pointer_up');
    const timer = window.setTimeout(() => {
      void startVoice();
      window.addEventListener('pointerup', stop, { once: true });
      window.addEventListener('touchend', stop, { once: true });
      window.addEventListener('mouseup', stop, { once: true });
    }, 80);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('pointerup', stop);
      window.removeEventListener('touchend', stop);
      window.removeEventListener('mouseup', stop);
    };
  }, [autoStartVoice, mode, open, startVoice]);

  useEffect(() => {
    if (!open) return;
    const command = initialCommand?.trim() ?? '';
    if (!command || initialCommandRef.current === command) return;
    initialCommandRef.current = command;
    setValue(command);
  }, [initialCommand, open]);

  useEffect(() => {
    if (!open || mode === 'voice') return;
    const timer = window.setTimeout(() => inputRef.current?.focus(), 120);
    return () => window.clearTimeout(timer);
  }, [mode, open]);

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
  }, [chat.messages.length, inlinePendingActions.length, chat.isSending, open, scrollToBottom]);

  useEffect(() => () => {
    voice.cancel();
  }, [voice]);

  if (!open) return null;

  const submit = async () => {
    const text = value.trim();
    if (!text || chat.isSending) return;
    setValue('');
    await sendText(text, 'text');
    window.setTimeout(() => inputRef.current?.blur(), 40);
  };

  const handleKeyDown = async (event: KeyboardEvent<HTMLTextAreaElement>) => {
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
        <header className="text-chat-overlay__head text-chat-overlay__head--compact">
          <div className="text-chat-overlay__status" data-state={statusState}>
            <span className="text-chat-overlay__dot" />
            <span>{statusText}</span>
          </div>
          <div className="text-chat-overlay__head-actions">
            <button
              type="button"
              className={isVoicePressed || voice.state === 'recording' ? 'text-chat-overlay__companion text-chat-overlay__companion--active' : 'text-chat-overlay__companion'}
              aria-label="Голосовая команда"
              onPointerDown={(event) => {
                event.preventDefault();
                event.stopPropagation();
                void startVoice();
              }}
              onPointerUp={(event) => {
                event.preventDefault();
                event.stopPropagation();
                stopVoice();
              }}
              onPointerCancel={(event) => {
                event.preventDefault();
                event.stopPropagation();
                stopVoice('cancel');
              }}
            >
              <span className="text-chat-overlay__companion-face"><span /><span /></span>
            </button>
            <button type="button" className="app-icon-button" onClick={onClose} aria-label={t('common.close')}>
              ×
            </button>
          </div>
        </header>

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
              {chat.isSending || voice.state === 'uploading' ? (
                <div className="text-chat-overlay__typing">
                  <span />
                  <span />
                  <span />
                </div>
              ) : null}
            </div>
          ) : (
            <div className="text-chat-overlay__empty">
              <button
                type="button"
                className={isVoicePressed || voice.state === 'recording' ? 'text-chat-overlay__orb text-chat-overlay__orb--active' : 'text-chat-overlay__orb'}
                aria-label="Голосовая команда"
                onPointerDown={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  void startVoice();
                }}
                onPointerUp={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  stopVoice();
                }}
              >
                ⌁
              </button>
              <h3>{t('textChat.empty.title')}</h3>
              <p>{t('textChat.empty.caption')}</p>
              <div className="text-chat-overlay__chips">
                {contextualPrompts.map((prompt) => (
                  <button key={prompt} type="button" onClick={() => void sendText(prompt, 'text')}>
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {showJumpToBottom ? (
          <button type="button" className="text-chat-overlay__jump" onClick={() => scrollToBottom()} aria-label={t('textChat.jumpToBottom')}>
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
