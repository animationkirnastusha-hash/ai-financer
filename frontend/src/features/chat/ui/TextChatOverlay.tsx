import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';

import { useAccountsStore } from '@/features/accounts/model/accounts.store';
import { AuditLogDrawer } from '@/features/audit-log/ui/AuditLogDrawer';
import { FinancePreviewCard } from '@/features/chat/ui/FinancePreviewCard';
import { MessageCard } from '@/features/chat/ui/MessageCard';
import { useChatController } from '@/features/chat/model/useChatController';
import { useSettingsStore } from '@/features/settings/model/settings.store';
import { useReceiptScansStore } from '@/features/receipt-scans/model/receiptScans.store';
import { useSubscriptionStore } from '@/features/subscription/model/subscription.store';
import { useTransactionsStore } from '@/features/transactions/model/transactions.store';
import { useVoiceInput } from '@/features/voice/model/useVoiceInput';
import { VOICE_MANUAL_SESSION_MS } from '@/features/voice/model/voiceConstants';
import { normalizeForWake, normalizeVoiceText, shouldIgnoreVoiceCommand } from '@/features/voice/model/voiceText';
import { useI18n } from '@/shared/lib/i18n';

const SCROLL_BOTTOM_THRESHOLD_PX = 120;
const OVERLAY_DISMISS_DRAG_PX = 82;
const RECEIPT_MAX_FILE_BYTES = 8 * 1024 * 1024;
const RECEIPT_ACCEPTED_TYPES = 'image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf';

type TextChatOverlayProps = {
  open: boolean;
  initialCommand?: string | null;
  mode?: 'text' | 'voice';
  autoStartVoice?: boolean;
  autoCloseOnVoiceResult?: boolean;
  autoSubmitInitialCommand?: boolean;
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


function pickRotatingStatus(t: (key: string, params?: Record<string, string | number>) => string, group: 'listening' | 'thinking' | 'ready' | 'confirm', seed = 0) {
  const variants = group === 'listening'
    ? ['textChat.status.listening.a', 'textChat.status.listening.b', 'textChat.status.listening.c']
    : group === 'thinking'
      ? ['textChat.status.thinking.a', 'textChat.status.thinking.b', 'textChat.status.thinking.c']
      : group === 'confirm'
        ? ['textChat.status.confirm.a', 'textChat.status.confirm.b', 'textChat.status.confirm.c']
        : ['textChat.status.ready.a', 'textChat.status.ready.b', 'textChat.status.ready.c'];
  return t(variants[Math.abs(seed) % variants.length]);
}

function chooseAccountName(accounts: Array<{ name?: string | null; type?: string | null }>) {
  const preferred = accounts.find((account) => String(account.type).toLowerCase() === 'cash')
    ?? accounts.find((account) => String(account.name ?? '').toLowerCase().includes('нал'))
    ?? accounts.find((account) => String(account.name ?? '').toLowerCase().includes('карт'))
    ?? accounts[0];
  return preferred?.name?.trim() || '';
}

export function TextChatOverlay({ open, initialCommand, mode = 'text', autoStartVoice = false, autoCloseOnVoiceResult = false, autoSubmitInitialCommand = false, layer = 130, onClose }: TextChatOverlayProps) {
  const { t } = useI18n();
  const [value, setValue] = useState(initialCommand?.trim() ?? '');
  const [showJumpToBottom, setShowJumpToBottom] = useState(false);
  const [isVoicePressed, setIsVoicePressed] = useState(false);
  const [isVoiceLocked, setIsVoiceLocked] = useState(false);
  const [voiceHint, setVoiceHint] = useState<string | null>(mode === 'voice' ? 'Слушаю' : null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const initialCommandRef = useRef<string | null>(null);
  const shouldStickToBottomRef = useRef(true);
  const autoStartDoneRef = useRef(false);
  const autoSubmittedInitialCommandRef = useRef<string | null>(null);
  const stopVoiceRef = useRef<(reason?: string) => void>(() => undefined);
  const lastVoiceSendAtRef = useRef(0);
  const lastAutoClosedMessageKeyRef = useRef('');
  const autoCloseTimerRef = useRef<number | null>(null);
  const dragStartYRef = useRef<number | null>(null);
  const [dragOffset, setDragOffset] = useState(0);
  const receiptCameraInputRef = useRef<HTMLInputElement | null>(null);
  const receiptFileInputRef = useRef<HTMLInputElement | null>(null);
  const [receiptHint, setReceiptHint] = useState<string | null>(null);

  const chat = useChatController();
  const accounts = useAccountsStore((state) => state.items);
  const transactions = useTransactionsStore((state) => state.items);
  const subscription = useSubscriptionStore((state) => state.status);
  const loadSubscription = useSubscriptionStore((state) => state.load);
  const uploadReceipt = useReceiptScansStore((state) => state.upload);
  const isReceiptUploading = useReceiptScansStore((state) => state.isUploading);
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


  const hasReceiptAccess = Boolean(subscription?.access?.hasPremium || subscription?.access?.hasBusiness || subscription?.features?.receiptScan);

  const sendText = useCallback(async (text: string, source: 'text' | 'voice' = 'text') => {
    const clean = text.trim();
    if (!clean || chat.isSending) return;
    shouldStickToBottomRef.current = true;
    if (source === 'voice') lastVoiceSendAtRef.current = Date.now();
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
    const seed = chat.messages.length + inlinePendingActions.length;
    if (voice.state === 'recording') return pickRotatingStatus(t, 'listening', seed);
    if (voice.state === 'uploading') return pickRotatingStatus(t, 'thinking', seed + 1);
    if (chat.isSending) return pickRotatingStatus(t, 'thinking', seed + 2);
    if (chat.pendingActions.length > 0) return pickRotatingStatus(t, 'confirm', seed);
    if (isVoiceLocked) return t('textChat.status.locked');
    return voiceHint || pickRotatingStatus(t, 'ready', seed);
  }, [chat.isSending, chat.messages.length, chat.pendingActions.length, inlinePendingActions.length, isVoiceLocked, t, voice.state, voiceHint]);

  const statusState = voice.state === 'recording'
    ? 'listening'
    : voice.state === 'uploading' || chat.isSending
      ? 'thinking'
      : chat.pendingActions.length > 0
        ? 'confirm'
        : isVoiceLocked
          ? 'locked'
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
      setVoiceHint(isVoiceLocked ? t('textChat.status.locked') : null);
    }
  }, [isVoiceLocked, t, voice]);

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
    if (!open || subscription) return;
    void loadSubscription();
  }, [loadSubscription, open, subscription]);

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

    if (autoSubmitInitialCommand) {
      const cleanCommand = stripOptionalCompanionName(command, companionName);
      if (cleanCommand && autoSubmittedInitialCommandRef.current !== cleanCommand) {
        autoSubmittedInitialCommandRef.current = cleanCommand;
        setValue('');
        setVoiceHint('Думаю');
        void sendText(cleanCommand, 'voice').finally(() => setVoiceHint(null));
      }
      return;
    }

    setValue(command);
  }, [autoSubmitInitialCommand, companionName, initialCommand, open, sendText]);

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

  useEffect(() => {
    if (!open || !autoCloseOnVoiceResult || isVoiceLocked || isVoicePressed) return;
    if (chat.isSending || voice.state !== 'idle' || chat.pendingActions.length > 0) return;
    if (!lastVoiceSendAtRef.current || Date.now() - lastVoiceSendAtRef.current > 24000) return;

    const lastMessage = chat.messages.at(-1);
    if (!lastMessage || lastMessage.role !== 'assistant' || lastMessage.kind !== 'success') return;

    const key = `${lastMessage.id}:${lastMessage.createdAt}:${lastMessage.text}`;
    if (lastAutoClosedMessageKeyRef.current === key) return;
    lastAutoClosedMessageKeyRef.current = key;

    if (autoCloseTimerRef.current !== null) window.clearTimeout(autoCloseTimerRef.current);
    autoCloseTimerRef.current = window.setTimeout(() => {
      autoCloseTimerRef.current = null;
      onClose();
    }, 1250);

    return () => {
      if (autoCloseTimerRef.current !== null) {
        window.clearTimeout(autoCloseTimerRef.current);
        autoCloseTimerRef.current = null;
      }
    };
  }, [autoCloseOnVoiceResult, chat.isSending, chat.messages, chat.pendingActions.length, isVoiceLocked, isVoicePressed, onClose, open, voice.state]);


  const closeOverlay = useCallback(() => {
    if (chat.pendingActions.length > 0) {
      setVoiceHint(t('textChat.close.pending'));
      return;
    }
    if (voice.state === 'recording' || voice.state === 'uploading') voice.cancel();
    onClose();
  }, [chat.pendingActions.length, onClose, t, voice]);

  const handleDragPointerDown = useCallback((event: PointerEvent<HTMLButtonElement>) => {
    dragStartYRef.current = event.clientY;
    setDragOffset(0);
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }, []);

  const handleDragPointerMove = useCallback((event: PointerEvent<HTMLButtonElement>) => {
    if (dragStartYRef.current === null) return;
    const dy = Math.max(0, event.clientY - dragStartYRef.current);
    setDragOffset(Math.min(150, dy));
  }, []);

  const handleDragPointerEnd = useCallback(() => {
    if (dragOffset >= OVERLAY_DISMISS_DRAG_PX) closeOverlay();
    dragStartYRef.current = null;
    setDragOffset(0);
  }, [closeOverlay, dragOffset]);

  const handleReceiptFile = useCallback(async (file: File | null) => {
    if (!file || !hasReceiptAccess || isReceiptUploading) return;
    if (file.size > RECEIPT_MAX_FILE_BYTES) {
      setReceiptHint(t('receipts.upload.tooLarge'));
      return;
    }
    setReceiptHint(t('textChat.receipt.uploading'));
    const scan = await uploadReceipt(file);
    setReceiptHint(scan ? t('textChat.receipt.success') : t('textChat.receipt.error'));
    if (receiptCameraInputRef.current) receiptCameraInputRef.current.value = '';
    if (receiptFileInputRef.current) receiptFileInputRef.current.value = '';
  }, [hasReceiptAccess, isReceiptUploading, t, uploadReceipt]);

  useEffect(() => () => {
    if (autoCloseTimerRef.current !== null) window.clearTimeout(autoCloseTimerRef.current);
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
    >
      <div
        className="text-chat-overlay__stage"
        style={{ transform: dragOffset ? `translateY(${dragOffset}px)` : undefined }}
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          className="text-chat-overlay__handle"
          aria-label={t('common.close')}
          onPointerDown={handleDragPointerDown}
          onPointerMove={handleDragPointerMove}
          onPointerUp={handleDragPointerEnd}
          onPointerCancel={handleDragPointerEnd}
        >
          <span />
        </button>
        <header className="text-chat-overlay__head text-chat-overlay__head--compact">
          <div className="text-chat-overlay__status" data-state={statusState}>
            <span className="text-chat-overlay__dot" />
            <span>{statusText}</span>
          </div>
          <div className="text-chat-overlay__head-actions">
            <button
              type="button"
              className={isVoicePressed || voice.state === 'recording' || isVoiceLocked ? 'text-chat-overlay__companion text-chat-overlay__companion--active' : 'text-chat-overlay__companion'}
              aria-label={t('textChat.voice.hold')}
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
            {mode === 'voice' ? (
              <button
                type="button"
                className={isVoiceLocked ? 'text-chat-overlay__lock text-chat-overlay__lock--active' : 'text-chat-overlay__lock'}
                aria-label={isVoiceLocked ? t('textChat.voice.unlock') : t('textChat.voice.lock')}
                onClick={() => setIsVoiceLocked((locked) => !locked)}
              >
                ∞
              </button>
            ) : null}
            <button type="button" className="app-icon-button" onClick={closeOverlay} aria-label={t('common.close')}>
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
                className={isVoicePressed || voice.state === 'recording' || isVoiceLocked ? 'text-chat-overlay__orb text-chat-overlay__orb--active' : 'text-chat-overlay__orb'}
                aria-label={t('textChat.voice.hold')}
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

        {receiptHint ? <div className="text-chat-overlay__receipt-hint">{receiptHint}</div> : null}

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
          {hasReceiptAccess ? (
            <div className="text-chat-overlay__receipt-actions">
              <button type="button" className="text-chat-overlay__receipt-main" disabled={isReceiptUploading} onClick={() => receiptFileInputRef.current?.click()}>
                {t('textChat.receipt.action')}
              </button>
              <button type="button" className="text-chat-overlay__receipt-mini" disabled={isReceiptUploading} onClick={() => receiptCameraInputRef.current?.click()} aria-label={t('textChat.receipt.camera')}>
                ◉
              </button>
              <input ref={receiptCameraInputRef} type="file" accept={RECEIPT_ACCEPTED_TYPES} capture="environment" className="sr-only" onChange={(event) => void handleReceiptFile(event.target.files?.[0] ?? null)} />
              <input ref={receiptFileInputRef} type="file" accept={RECEIPT_ACCEPTED_TYPES} className="sr-only" onChange={(event) => void handleReceiptFile(event.target.files?.[0] ?? null)} />
            </div>
          ) : null}
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
