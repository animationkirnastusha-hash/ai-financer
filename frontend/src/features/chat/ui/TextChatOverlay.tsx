import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent,
} from 'react';

import type { HomeCashflowMode } from '@/features/dashboard/lib/homeFinanceAnalytics';
import { AuditLogDrawer } from '@/features/audit-log/ui/AuditLogDrawer';
import { useChatController } from '@/features/chat/model/useChatController';
import { useChatStore } from '@/features/chat/model/chat.store';
import { useFirstRunChatSetupStore } from '@/features/chat/model/firstRunChatSetup.store';
import { useSettingsStore } from '@/features/settings/model/settings.store';
import { useI18n } from '@/shared/lib/i18n';
import {
  OVERLAY_DISMISS_DRAG_PX,
  SCROLL_BOTTOM_THRESHOLD_PX,
} from '@/features/chat/ui/text-chat-overlay/constants';
import {
  pickRotatingStatus,
  stripOptionalCompanionName,
} from '@/features/chat/ui/text-chat-overlay/helpers';
import { TextChatOverlayHeader } from '@/features/chat/ui/text-chat-overlay/TextChatOverlayHeader';
import { TextChatMessages } from '@/features/chat/ui/text-chat-overlay/TextChatMessages';
import { TextChatEmptyState } from '@/features/chat/ui/text-chat-overlay/TextChatEmptyState';
import { TextChatComposer } from '@/features/chat/ui/text-chat-overlay/TextChatComposer';
import { TextChatFirstRunActions } from '@/features/chat/ui/text-chat-overlay/TextChatFirstRunActions';

function createSetupMessage(id: string, text: string, kind: 'text' | 'success' | 'error' = 'text') {
  return {
    id,
    role: 'assistant' as const,
    kind,
    text,
    createdAt: new Date().toISOString(),
  };
}

type TextChatOverlayProps = {
  open: boolean;
  initialCommand?: string | null;
  initialAssistantMessage?: string | null;
  autoSubmitInitialCommand?: boolean;
  firstRunSetup?: boolean;
  quickCreateMode?: HomeCashflowMode | null;
  hiddenCommandPrefix?: string | null;
  layer?: number;
  onClose: () => void;
};

export function TextChatOverlay({
  open,
  initialCommand,
  initialAssistantMessage,
  autoSubmitInitialCommand = false,
  firstRunSetup = false,
  quickCreateMode = null,
  hiddenCommandPrefix = null,
  layer = 130,
  onClose,
}: TextChatOverlayProps) {
  const { t } = useI18n();
  const [value, setValue] = useState(initialCommand?.trim() ?? '');
  const [showJumpToBottom, setShowJumpToBottom] = useState(false);
  const [localHint, setLocalHint] = useState<string | null>(null);
  const [isSetupBusy, setIsSetupBusy] = useState(false);
  const [showSetupResumePrompt, setShowSetupResumePrompt] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const initialCommandRef = useRef<string | null>(null);
  const shouldStickToBottomRef = useRef(true);
  const autoSubmittedInitialCommandRef = useRef<string | null>(null);
  const initialAssistantMessageKeyRef = useRef<string | null>(null);
  const dragStartYRef = useRef<number | null>(null);
  const [dragOffset, setDragOffset] = useState(0);
  const [shouldRender, setShouldRender] = useState(open);
  const [isClosing, setIsClosing] = useState(false);
  const setupInputHandlerRef = useRef<((text: string) => Promise<boolean>) | null>(null);
  const quickCreateConsumedRef = useRef(false);
  const quickCreateBootstrappedRef = useRef(false);
  const firstRunSetupBootstrappedRef = useRef(false);

  const chat = useChatController();
  const appendChatMessage = useChatStore((state) => state.appendMessage);
  const setChatMessages = useChatStore((state) => state.setMessages);
  const setupStage = useFirstRunChatSetupStore((state) => state.stage);
  const setupDraftAccountName = useFirstRunChatSetupStore((state) => state.draftAccountName);
  const setupIsActive = useFirstRunChatSetupStore((state) => state.isActive);
  const setupCloseLocked = useFirstRunChatSetupStore((state) => state.closeLocked);
  const setupInterrupted = useFirstRunChatSetupStore((state) => state.interrupted);
  const setupCompleted = useFirstRunChatSetupStore((state) => state.completed);
  const startFirstRunSetup = useFirstRunChatSetupStore((state) => state.start);
  const setSetupAccountDraftName = useFirstRunChatSetupStore((state) => state.setAccountDraftName);
  const completeSetupWithAccount = useFirstRunChatSetupStore((state) => state.completeWithAccount);
  const dismissFirstRunSetup = useFirstRunChatSetupStore((state) => state.dismiss);
  const markFirstRunSetupInterrupted = useFirstRunChatSetupStore((state) => state.markInterrupted);
  const resumeFirstRunSetup = useFirstRunChatSetupStore((state) => state.resumeInterrupted);
  const abandonFirstRunSetup = useFirstRunChatSetupStore((state) => state.abandonInterrupted);
  const companionName = useSettingsStore((state) => state.companionName || 'Фина');

  const pendingActionIdsInMessages = useMemo(
    () =>
      new Set(
        chat.messages
          .map((message) => message.actionId)
          .filter((actionId): actionId is string => Boolean(actionId)),
      ),
    [chat.messages],
  );

  const inlinePendingActions = useMemo(
    () =>
      chat.confirmationActions.filter(
        (action) => action?.id && !pendingActionIdsInMessages.has(action.id),
      ),
    [chat.confirmationActions, pendingActionIdsInMessages],
  );

  const hasBlockingConfirmation = inlinePendingActions.length > 0;

  const buildQuickCreateCommand = useCallback((rawText: string) => {
    const clean = rawText.trim();
    if (inlinePendingActions.length > 0 || quickCreateConsumedRef.current) {
      return { text: clean, displayText: clean };
    }

    const flowPrefix = hiddenCommandPrefix?.trim();
    if (flowPrefix) {
      quickCreateConsumedRef.current = true;
      return { text: `${flowPrefix} ${clean}`, displayText: clean };
    }

    if (!quickCreateMode) {
      return { text: clean, displayText: clean };
    }

    quickCreateConsumedRef.current = true;
    const prefix = quickCreateMode === 'income'
      ? t('textChat.quickCreate.incomePrefix')
      : t('textChat.quickCreate.expensePrefix');

    return { text: `${prefix} ${clean}`, displayText: clean };
  }, [hiddenCommandPrefix, inlinePendingActions.length, quickCreateMode, t]);

  const sendText = useCallback(
    async (text: string) => {
      const clean = text.trim();
      if (!clean || chat.isSending) return;
      const payload = buildQuickCreateCommand(clean);
      shouldStickToBottomRef.current = true;
      await chat.sendMessage(
        { text: payload.text, displayText: payload.displayText, source: 'text' },
        { supersedeInFlight: true },
      );
    },
    [buildQuickCreateCommand, chat],
  );

  useEffect(() => {
    if (open) {
      setShouldRender(true);
      setIsClosing(false);
      return;
    }

    if (!shouldRender) return;
    setIsClosing(true);
    const timer = window.setTimeout(() => {
      setShouldRender(false);
      setIsClosing(false);
    }, 220);

    return () => window.clearTimeout(timer);
  }, [open, shouldRender]);

  const statusText = useMemo(() => {
    const seed = chat.messages.length + inlinePendingActions.length;
    if (chat.isSending) return pickRotatingStatus(t, 'thinking', seed + 2);
    if (hasBlockingConfirmation) return pickRotatingStatus(t, 'confirm', seed);
    if (setupCloseLocked) return t('textChat.status.locked');
    return localHint || pickRotatingStatus(t, 'ready', seed);
  }, [chat.isSending, chat.messages.length, hasBlockingConfirmation, inlinePendingActions.length, localHint, setupCloseLocked, t]);

  const statusState = chat.isSending
    ? 'thinking'
    : hasBlockingConfirmation
      ? 'confirm'
      : setupCloseLocked
        ? 'locked'
        : 'ready';

  const contextualPrompts: string[] = [];

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    const list = listRef.current;
    if (!list) return;
    list.scrollTo({ top: list.scrollHeight, behavior });
    shouldStickToBottomRef.current = true;
    setShowJumpToBottom(false);
  }, []);

  useEffect(() => {
    if (!open) {
      quickCreateConsumedRef.current = false;
      quickCreateBootstrappedRef.current = false;
      firstRunSetupBootstrappedRef.current = false;
      setShowSetupResumePrompt(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const handleNavigationCompleted = () => {
      window.setTimeout(onClose, 120);
    };

    window.addEventListener('ai-financer:navigation-completed', handleNavigationCompleted);
    return () => window.removeEventListener('ai-financer:navigation-completed', handleNavigationCompleted);
  }, [onClose, open]);

  useEffect(() => {
    if (!open) return;
    const text = initialAssistantMessage?.trim();
    if (!text || firstRunSetup || quickCreateMode) return;

    const key = `onboarding:${text}`;
    if (initialAssistantMessageKeyRef.current === key) return;
    if (chat.messages.some((message) => message.role === 'assistant' && message.text === text)) {
      initialAssistantMessageKeyRef.current = key;
      return;
    }

    initialAssistantMessageKeyRef.current = key;
    appendChatMessage({
      id: crypto.randomUUID(),
      role: 'assistant',
      kind: 'text',
      text,
      createdAt: new Date().toISOString(),
    });
  }, [appendChatMessage, chat.messages, firstRunSetup, initialAssistantMessage, open, quickCreateMode]);

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
        void sendText(cleanCommand);
      }
      return;
    }

    setValue(command);
  }, [autoSubmitInitialCommand, companionName, initialCommand, open, sendText]);

  useEffect(() => {
    if (!open || !quickCreateMode || quickCreateBootstrappedRef.current) return;

    const text = initialAssistantMessage?.trim();
    quickCreateBootstrappedRef.current = true;
    quickCreateConsumedRef.current = false;
    shouldStickToBottomRef.current = true;
    setValue('');
    setShowSetupResumePrompt(false);
    setLocalHint(null);

    setChatMessages(text ? [createSetupMessage(`quick-create-${quickCreateMode}-${Date.now()}`, text)] : []);
  }, [initialAssistantMessage, open, quickCreateMode, setChatMessages]);

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
  }, [chat.messages.length, inlinePendingActions.length, chat.isSending, open, scrollToBottom]);

  const closeOverlay = useCallback(() => {
    const shouldPauseSetup = setupIsActive && setupStage !== 'done';

    setLocalHint(null);
    setDragOffset(0);
    dragStartYRef.current = null;
    if (shouldPauseSetup) {
      markFirstRunSetupInterrupted();
      setChatMessages([]);
    } else if (setupStage === 'done') {
      setChatMessages([]);
      dismissFirstRunSetup();
    }
    setShowSetupResumePrompt(false);
    onClose();
  }, [dismissFirstRunSetup, markFirstRunSetupInterrupted, onClose, setChatMessages, setupIsActive, setupStage]);

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

  const appendSetupAssistantMessage = useCallback(
    (id: string, text: string, kind: 'text' | 'success' | 'error' = 'text') => {
      shouldStickToBottomRef.current = true;
      setChatMessages((messages) => {
        if (messages.some((message) => message.id === id)) return messages;
        return [...messages, createSetupMessage(id, text, kind)];
      });
    },
    [setChatMessages],
  );

  useEffect(() => {
    if (!open) return;

    if (firstRunSetup) {
      if (firstRunSetupBootstrappedRef.current) return;
      firstRunSetupBootstrappedRef.current = true;
      shouldStickToBottomRef.current = true;
      setShowSetupResumePrompt(false);
      setLocalHint(null);
      setValue('');
      setChatMessages([]);
      startFirstRunSetup();
      return;
    }

    if (setupCompleted) return;

    if (setupInterrupted) {
      setChatMessages([]);
      setShowSetupResumePrompt(true);
    }
  }, [firstRunSetup, open, setChatMessages, setupCompleted, setupInterrupted, startFirstRunSetup]);

  useEffect(() => {
    if (!open || !setupIsActive || showSetupResumePrompt) return;

    const messages = (() => {
      if (setupStage === 'account') {
        return [createSetupMessage('first-run-setup-account', t('textChat.setup.accountQuestion'))];
      }

      if (setupStage === 'balance' && setupDraftAccountName) {
        return [createSetupMessage('first-run-setup-balance', t('textChat.setup.balanceQuestion', { account: setupDraftAccountName }))];
      }

      if (setupStage === 'done') {
        return [createSetupMessage('first-run-setup-created', t('textChat.setup.created'), 'success')];
      }

      return [];
    })();

    if (!messages.length) return;
    shouldStickToBottomRef.current = true;
    setChatMessages((currentMessages) => {
      const existingIds = new Set(currentMessages.map((message) => message.id));
      const nextMessages = messages.filter((message) => !existingIds.has(message.id));
      return nextMessages.length ? [...currentMessages, ...nextMessages] : currentMessages;
    });
  }, [open, setChatMessages, setupDraftAccountName, setupIsActive, setupStage, showSetupResumePrompt, t]);

  const appendSetupUserMessage = useCallback(
    (text: string) => {
      shouldStickToBottomRef.current = true;
      appendChatMessage({
        id: crypto.randomUUID(),
        role: 'user',
        kind: 'text',
        text,
        createdAt: new Date().toISOString(),
      });
    },
    [appendChatMessage],
  );

  const buildFirstRunAccountCommand = useCallback(
    (accountName: string, balanceText: string) => t('textChat.setup.aiAccountCommand', {
      account: accountName,
      balance: balanceText,
    }),
    [t],
  );

  const finishSetupThroughAi = useCallback(
    async (balanceText: string) => {
      const accountName = setupDraftAccountName?.trim();
      if (!accountName || isSetupBusy) return;

      setIsSetupBusy(true);
      try {
        const command = buildFirstRunAccountCommand(accountName, balanceText);
        await chat.sendMessage(
          { text: command, displayText: balanceText, source: 'text' },
          { supersedeInFlight: true },
        );
        completeSetupWithAccount(null);
      } catch {
        appendSetupAssistantMessage('first-run-setup-create-failed', t('textChat.setup.createFailed'), 'error');
      } finally {
        setIsSetupBusy(false);
      }
    },
    [appendSetupAssistantMessage, buildFirstRunAccountCommand, chat, completeSetupWithAccount, isSetupBusy, setupDraftAccountName, t],
  );

  const handleSetupInput = useCallback(async (text: string) => {
    const clean = text.trim();
    if (!clean) return true;

    if (setupStage === 'account') {
      appendSetupUserMessage(clean);
      setSetupAccountDraftName(clean);
      return true;
    }

    if (setupStage === 'balance') {
      await finishSetupThroughAi(clean);
      return true;
    }

    return false;
  }, [appendSetupUserMessage, finishSetupThroughAi, setSetupAccountDraftName, setupStage]);

  useEffect(() => {
    setupInputHandlerRef.current = handleSetupInput;
  }, [handleSetupInput]);

  if (!shouldRender) return null;

  const submit = async () => {
    const text = value.trim();
    if (!text || chat.isSending || isSetupBusy) return;

    if (setupIsActive) {
      setValue('');
      const handled = await handleSetupInput(text);
      if (handled) {
        window.setTimeout(() => inputRef.current?.blur(), 40);
        return;
      }
    }

    setValue('');
    await sendText(text);
    window.setTimeout(() => inputRef.current?.blur(), 40);
  };

  const handleMessagesScroll = () => {
    const list = listRef.current;
    if (!list) return;
    const distanceToBottom = list.scrollHeight - list.scrollTop - list.clientHeight;
    const isNearBottom = distanceToBottom < SCROLL_BOTTOM_THRESHOLD_PX;
    shouldStickToBottomRef.current = isNearBottom;
    setShowJumpToBottom(!isNearBottom);
  };

  const handleResumeSetup = () => {
    setShowSetupResumePrompt(false);
    setChatMessages([]);
    resumeFirstRunSetup();
  };

  const handleAbandonSetup = () => {
    setShowSetupResumePrompt(false);
    setChatMessages([]);
    abandonFirstRunSetup();
  };

  const handleSkipSetupBalance = () => {
    void finishSetupThroughAi(t('textChat.setup.balanceSkipped'));
  };

  const setupInputDisabled = showSetupResumePrompt || (setupIsActive && setupStage === 'done');
  const placeholder = setupStage === 'account'
    ? t('textChat.setup.accountPlaceholder')
    : setupStage === 'balance'
      ? t('textChat.setup.balancePlaceholder')
      : t('textChat.placeholder');

  return (
    <div
      className={`text-chat-overlay${isClosing ? ' text-chat-overlay--closing' : ''}${setupIsActive ? ' text-chat-overlay--setup' : ''}`}
      aria-hidden={isClosing ? 'true' : undefined}
      data-no-swipe="true"
      data-ai-core-modal="true"
      style={{ zIndex: layer }}
    >
      <div
        className="text-chat-overlay__stage"
        style={{ transform: !isClosing && dragOffset ? `translateY(${dragOffset}px)` : undefined }}
        onClick={(event) => event.stopPropagation()}
      >
        <TextChatOverlayHeader
          statusState={statusState}
          statusText={statusText}
          closeLabel={t('common.close')}
          closeDisabled={false}
          onClose={closeOverlay}
          onDragPointerDown={handleDragPointerDown}
          onDragPointerMove={handleDragPointerMove}
          onDragPointerEnd={handleDragPointerEnd}
        />

        <TextChatMessages
          listRef={listRef}
          messages={chat.messages}
          inlinePendingActions={inlinePendingActions}
          isSending={chat.isSending}
          pendingTitle={t('textChat.pending.title')}
          onScroll={handleMessagesScroll}
          onConfirm={chat.confirmAction}
          onCancel={chat.cancelAction}
          onUndo={chat.undoMessageAction}
          emptyState={
            <TextChatEmptyState
              prompts={contextualPrompts}
              title={t('textChat.empty.title')}
              caption={t('textChat.empty.caption')}
              onPrompt={(prompt) => void sendText(prompt)}
            />
          }
        />

        {setupIsActive && !showSetupResumePrompt ? (
          <TextChatFirstRunActions
            stage={setupStage}
            isBusy={isSetupBusy}
            closeChatLabel={t('textChat.setup.action.closeChat')}
            skipBalanceLabel={t('textChat.setup.action.skipBalance')}
            onSkipBalance={handleSkipSetupBalance}
            onCloseChat={closeOverlay}
          />
        ) : null}

        {showSetupResumePrompt ? (
          <div className="text-chat-setup-resume" role="dialog" aria-modal="true" aria-label={t('textChat.setup.resume.title')}>
            <div>
              <strong>{t('textChat.setup.resume.title')}</strong>
              <p>{t('textChat.setup.resume.caption')}</p>
            </div>
            <div className="text-chat-setup-resume__actions">
              <button type="button" onClick={handleAbandonSetup} className="is-secondary">{t('common.no')}</button>
              <button type="button" onClick={handleResumeSetup}>{t('common.yes')}</button>
            </div>
          </div>
        ) : null}

        {localHint ? <div className="text-chat-overlay__local-hint">{localHint}</div> : null}

        {showJumpToBottom ? (
          <button type="button" className="text-chat-overlay__jump" onClick={() => scrollToBottom()} aria-label={t('textChat.jumpToBottom')}>
            ↓
          </button>
        ) : null}

        <TextChatComposer
          value={value}
          inputRef={inputRef}
          isSending={chat.isSending || isSetupBusy}
          inputDisabled={setupInputDisabled}
          placeholder={placeholder}
          sendLabel={t('textChat.send')}
          onValueChange={setValue}
          onSubmit={submit}
        />
      </div>

      <AuditLogDrawer open={chat.isAuditOpen} items={chat.auditLogs} onClose={chat.closeAudit} />
    </div>
  );
}
