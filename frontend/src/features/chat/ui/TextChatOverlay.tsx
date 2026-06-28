import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent,
} from "react";

import type { HomeCashflowMode } from "@/features/dashboard/lib/homeFinanceAnalytics";
import { AuditLogDrawer } from "@/features/audit-log/ui/AuditLogDrawer";
import { useChatController } from "@/features/chat/model/useChatController";
import { useChatStore } from "@/features/chat/model/chat.store";
import { useFirstRunChatSetupStore } from "@/features/chat/model/firstRunChatSetup.store";
import { useSettingsStore } from "@/features/settings/model/settings.store";
import { shouldIgnoreVoiceCommand, usePressToTalkVoice } from "@/features/voice";
import { VoicePermissionMiniPrompt } from "@/features/voice/ui/VoicePermissionMiniPrompt";
import { useI18n } from "@/shared/lib/i18n";
import {
  OVERLAY_DISMISS_DRAG_PX,
  SCROLL_BOTTOM_THRESHOLD_PX,
} from "@/features/chat/ui/text-chat-overlay/constants";
import {
  pickRotatingStatus,
  stripOptionalCompanionName,
} from "@/features/chat/ui/text-chat-overlay/helpers";
import { TextChatOverlayHeader } from "@/features/chat/ui/text-chat-overlay/TextChatOverlayHeader";
import { TextChatMessages } from "@/features/chat/ui/text-chat-overlay/TextChatMessages";
import { TextChatEmptyState } from "@/features/chat/ui/text-chat-overlay/TextChatEmptyState";
import { TextChatComposer } from "@/features/chat/ui/text-chat-overlay/TextChatComposer";
import { TextChatFirstRunActions } from "@/features/chat/ui/text-chat-overlay/TextChatFirstRunActions";

function createSetupMessage(id: string, text: string, kind: "text" | "success" | "error" = "text") {
  return {
    id,
    role: "assistant" as const,
    kind,
    text,
    createdAt: new Date().toISOString(),
  };
}

type TextChatOverlayProps = {
  open: boolean;
  initialCommand?: string | null;
  initialAssistantMessage?: string | null;
  mode?: "text" | "voice";
  autoStartVoice?: boolean;
  autoCloseOnVoiceResult?: boolean;
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
  mode = "text",
  autoStartVoice = false,
  autoCloseOnVoiceResult = false,
  autoSubmitInitialCommand = false,
  firstRunSetup = false,
  quickCreateMode = null,
  hiddenCommandPrefix = null,
  layer = 130,
  onClose,
}: TextChatOverlayProps) {
  const { t } = useI18n();
  const [value, setValue] = useState(initialCommand?.trim() ?? "");
  const [showJumpToBottom, setShowJumpToBottom] = useState(false);
  const [voiceHint, setVoiceHint] = useState<string | null>(mode === "voice" ? null : null);
  const [localHint, setLocalHint] = useState<string | null>(null);
  const [isSetupBusy, setIsSetupBusy] = useState(false);
  const [showVoicePermissionHelp, setShowVoicePermissionHelp] = useState(false);
  const [showSetupResumePrompt, setShowSetupResumePrompt] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const initialCommandRef = useRef<string | null>(null);
  const shouldStickToBottomRef = useRef(true);
  const autoStartDoneRef = useRef(false);
  const autoSubmittedInitialCommandRef = useRef<string | null>(null);
  const lastVoiceSendAtRef = useRef(0);
  const lastAutoClosedMessageKeyRef = useRef("");
  const autoCloseTimerRef = useRef<number | null>(null);
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
  const setupMicrophoneStatus = useFirstRunChatSetupStore((state) => state.microphoneStatus);
  const setupDraftAccountName = useFirstRunChatSetupStore((state) => state.draftAccountName);
  const setupIsActive = useFirstRunChatSetupStore((state) => state.isActive);
  const setupCloseLocked = useFirstRunChatSetupStore((state) => state.closeLocked);
  const setupInterrupted = useFirstRunChatSetupStore((state) => state.interrupted);
  const setupCompleted = useFirstRunChatSetupStore((state) => state.completed);
  const startFirstRunSetup = useFirstRunChatSetupStore((state) => state.start);
  const skipSetupMicrophone = useFirstRunChatSetupStore((state) => state.skipMicrophone);
  const finishSetupMicrophone = useFirstRunChatSetupStore((state) => state.finishMicrophone);
  const setSetupAccountDraftName = useFirstRunChatSetupStore((state) => state.setAccountDraftName);
  const completeSetupWithAccount = useFirstRunChatSetupStore((state) => state.completeWithAccount);
  const dismissFirstRunSetup = useFirstRunChatSetupStore((state) => state.dismiss);
  const markFirstRunSetupInterrupted = useFirstRunChatSetupStore((state) => state.markInterrupted);
  const resumeFirstRunSetup = useFirstRunChatSetupStore((state) => state.resumeInterrupted);
  const abandonFirstRunSetup = useFirstRunChatSetupStore((state) => state.abandonInterrupted);
  const companionName = useSettingsStore((state) => state.companionName || "Фина");
  const appLanguage = useSettingsStore((state) => state.appLanguage);
  const voicePermissionPrompted = useSettingsStore((state) => state.voicePermissionPrompted);
  const setVoicePermissionPrompted = useSettingsStore((state) => state.setVoicePermissionPrompted);

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
    const prefix = quickCreateMode === "income"
      ? t("textChat.quickCreate.incomePrefix")
      : t("textChat.quickCreate.expensePrefix");

    return { text: `${prefix} ${clean}`, displayText: clean };
  }, [hiddenCommandPrefix, inlinePendingActions.length, quickCreateMode, t]);

  const sendText = useCallback(
    async (text: string, source: "text" | "voice" = "text") => {
      const clean = text.trim();
      if (!clean || chat.isSending) return;
      const payload = buildQuickCreateCommand(clean);
      shouldStickToBottomRef.current = true;
      if (source === "voice") lastVoiceSendAtRef.current = Date.now();
      await chat.sendMessage(
        { text: payload.text, displayText: payload.displayText, source },
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

  const voice = usePressToTalkVoice({
    lang: appLanguage === "en" ? "en-US" : "ru-RU",
    source: "chat",
    maxDurationMs: 9000,
    permissionWasPrompted: voicePermissionPrompted,
    onText: async (rawText) => {
      const text = stripOptionalCompanionName(rawText, companionName);
      if (!text || shouldIgnoreVoiceCommand(text)) {
        setVoiceHint(t("textChat.voice.notHeard"));
        return;
      }

      if (setupIsActive && (setupStage === 'account' || setupStage === 'balance')) {
        const handled = await setupInputHandlerRef.current?.(text);
        if (handled) {
          setVoiceHint(null);
          return;
        }
      }

      setVoiceHint(t("textChat.voice.thinking"));
      await sendText(text, "voice");
      setVoiceHint(null);
    },
  });

  const statusText = useMemo(() => {
    const seed = chat.messages.length + inlinePendingActions.length;
    if (voice.state === "recording") return pickRotatingStatus(t, "listening", seed);
    if (voice.state === "uploading") return pickRotatingStatus(t, "thinking", seed + 1);
    if (chat.isSending) return pickRotatingStatus(t, "thinking", seed + 2);
    if (hasBlockingConfirmation) return pickRotatingStatus(t, "confirm", seed);
    if (setupCloseLocked) return t("textChat.status.locked");
    return voiceHint || pickRotatingStatus(t, "ready", seed);
  }, [chat.isSending, chat.messages.length, hasBlockingConfirmation, inlinePendingActions.length, setupCloseLocked, t, voice.state, voiceHint]);

  const statusState =
    voice.state === "recording"
      ? "listening"
      : voice.state === "uploading" || chat.isSending
        ? "thinking"
        : hasBlockingConfirmation
          ? "confirm"
          : setupCloseLocked
            ? "locked"
            : "ready";

  const contextualPrompts: string[] = [];
  const isVoicePressed = voice.isPressed;

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    const list = listRef.current;
    if (!list) return;
    list.scrollTo({ top: list.scrollHeight, behavior });
    shouldStickToBottomRef.current = true;
    setShowJumpToBottom(false);
  }, []);

  const promptVoicePermissionInChat = useCallback(() => {
    voice.cancel('permission-help');
    voice.reset();
    setVoiceHint(t("textChat.voice.needPermission"));
    setShowVoicePermissionHelp(true);
    shouldStickToBottomRef.current = true;
    setChatMessages((messages) => {
      if (messages.some((message) => message.id === "voice-permission-request")) return messages;
      return [
        ...messages,
        createSetupMessage(
          "voice-permission-request",
          t("textChat.voice.permissionPrompt"),
        ),
      ];
    });
  }, [setChatMessages, t, voice]);

  const handleVoicePointerDown = useCallback(
    (event: PointerEvent<HTMLButtonElement>) => {
      if (value.trim() || chat.isSending || voice.state === "uploading" || isSetupBusy || setupStage === 'microphone') return;
      if (!setupIsActive && (voice.permissionState === "denied" || voice.permissionState === "unsupported")) {
        promptVoicePermissionInChat();
        return;
      }
      setVoiceHint(t("textChat.voice.listening"));
      voice.handlePointerDown(event);
    },
    [chat.isSending, isSetupBusy, promptVoicePermissionInChat, setupIsActive, setupStage, t, value, voice],
  );

  const handleVoicePointerMove = useCallback(
    (event: PointerEvent<HTMLButtonElement>) => {
      voice.handlePointerMove(event);
    },
    [voice],
  );

  const handleVoicePointerEnd = useCallback(
    (event: PointerEvent<HTMLButtonElement>) => {
      setVoiceHint(t("textChat.voice.recognizing"));
      voice.handlePointerUp(event);
    },
    [t, voice],
  );

  const handleVoicePointerCancel = useCallback(
    (event: PointerEvent<HTMLButtonElement>) => {
      setVoiceHint(t("textChat.voice.cancelled"));
      voice.handlePointerCancel(event);
    },
    [t, voice],
  );

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
    void voice.refreshPermissionState();
  }, [open, voice.refreshPermissionState]);

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
    if (chat.messages.some((message) => message.role === "assistant" && message.text === text)) {
      initialAssistantMessageKeyRef.current = key;
      return;
    }

    initialAssistantMessageKeyRef.current = key;
    appendChatMessage({
      id: crypto.randomUUID(),
      role: "assistant",
      kind: "text",
      text,
      createdAt: new Date().toISOString(),
    });
  }, [appendChatMessage, chat.messages, firstRunSetup, initialAssistantMessage, open, quickCreateMode]);

  useEffect(() => {
    if (!open || mode !== "voice" || !autoStartVoice || autoStartDoneRef.current) return;
    autoStartDoneRef.current = true;
    setVoiceHint(t("textChat.voice.holdToTalk"));
  }, [autoStartVoice, mode, open, t]);

  useEffect(() => {
    if (!open) return;
    const command = initialCommand?.trim() ?? "";
    if (!command || initialCommandRef.current === command) return;
    initialCommandRef.current = command;

    if (autoSubmitInitialCommand) {
      const cleanCommand = stripOptionalCompanionName(command, companionName);
      if (cleanCommand && autoSubmittedInitialCommandRef.current !== cleanCommand) {
        autoSubmittedInitialCommandRef.current = cleanCommand;
        setValue("");
        setVoiceHint(t("textChat.voice.thinking"));
        void sendText(cleanCommand, "voice").finally(() => setVoiceHint(null));
      }
      return;
    }

    setValue(command);
  }, [autoSubmitInitialCommand, companionName, initialCommand, open, sendText, t]);

  useEffect(() => {
    if (!open || !quickCreateMode || quickCreateBootstrappedRef.current) return;

    const text = initialAssistantMessage?.trim();
    quickCreateBootstrappedRef.current = true;
    quickCreateConsumedRef.current = false;
    shouldStickToBottomRef.current = true;
    setValue("");
    setShowSetupResumePrompt(false);
    setShowVoicePermissionHelp(false);
    setLocalHint(null);

    setChatMessages(text ? [createSetupMessage(`quick-create-${quickCreateMode}-${Date.now()}`, text)] : []);
  }, [initialAssistantMessage, open, quickCreateMode, setChatMessages]);

  useEffect(() => {
    if (!open || mode === "voice") return;
    const timer = window.setTimeout(() => inputRef.current?.focus(), 120);
    return () => window.clearTimeout(timer);
  }, [mode, open]);

  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;

    input.style.height = "auto";
    input.style.height = `${Math.min(input.scrollHeight, 132)}px`;
  }, [value]);

  useEffect(() => {
    if (!open) return;
    const frame = window.requestAnimationFrame(() => {
      if (shouldStickToBottomRef.current) scrollToBottom("auto");
      else setShowJumpToBottom(true);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [chat.messages.length, inlinePendingActions.length, chat.isSending, open, scrollToBottom]);

  useEffect(() => {
    if (!open || !autoCloseOnVoiceResult || isVoicePressed) return;
    if (chat.isSending || voice.state !== "idle" || hasBlockingConfirmation) return;
    if (!lastVoiceSendAtRef.current || Date.now() - lastVoiceSendAtRef.current > 24000) return;

    const lastMessage = chat.messages.at(-1);
    if (!lastMessage || lastMessage.role !== "assistant" || lastMessage.kind !== "success") return;

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
  }, [autoCloseOnVoiceResult, chat.isSending, chat.messages, hasBlockingConfirmation, isVoicePressed, onClose, open, voice.state]);

  const closeOverlay = useCallback(() => {
    const shouldPauseSetup = setupIsActive && setupStage !== 'done';

    voice.cancel('overlay-close');
    voice.reset();
    setVoiceHint(null);
    setLocalHint(null);
    setShowVoicePermissionHelp(false);
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
  }, [dismissFirstRunSetup, markFirstRunSetupInterrupted, onClose, setChatMessages, setupIsActive, setupStage, voice]);

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
    (id: string, text: string, kind: "text" | "success" | "error" = "text") => {
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
      setShowVoicePermissionHelp(false);
      setLocalHint(null);
      setValue("");
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
      if (setupStage === 'microphone') return [createSetupMessage('first-run-setup-intro', t('textChat.setup.intro'))];

      if (setupStage === 'account') {
        const key = setupMicrophoneStatus === 'enabled'
          ? 'textChat.setup.accountAfterMic'
          : setupMicrophoneStatus === 'skipped'
            ? 'textChat.setup.accountAfterSkip'
            : 'textChat.setup.accountAfterFail';
        return [createSetupMessage(`first-run-setup-account-${setupMicrophoneStatus}`, t(key))];
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
  }, [open, setChatMessages, setupDraftAccountName, setupIsActive, setupMicrophoneStatus, setupStage, showSetupResumePrompt, t]);

  const handleSetupEnableMicrophone = useCallback(async () => {
    if (setupStage !== 'microphone' || isSetupBusy) return;

    setIsSetupBusy(true);
    setShowVoicePermissionHelp(false);
    try {
      const allowed = await voice.primePermission();
      setVoicePermissionPrompted(allowed);
      voice.reset();
      if (allowed) {
        finishSetupMicrophone();
        return;
      }

      setShowVoicePermissionHelp(true);
      setLocalHint(t('textChat.setup.microphoneHelpHint'));
    } finally {
      setIsSetupBusy(false);
    }
  }, [finishSetupMicrophone, isSetupBusy, setVoicePermissionPrompted, setupStage, t, voice]);

  const handleSetupSkipMicrophone = useCallback(() => {
    if (setupStage !== 'microphone') return;
    setShowVoicePermissionHelp(false);
    voice.cancel('overlay-close');
    voice.reset();
    setVoicePermissionPrompted(false);
    skipSetupMicrophone();
  }, [setVoicePermissionPrompted, setupStage, skipSetupMicrophone, voice]);

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

  const handleVoicePermissionRetry = useCallback(async () => {
    setIsSetupBusy(true);
    try {
      const allowed = await voice.primePermission();
      setVoicePermissionPrompted(allowed);
      voice.reset();
      if (allowed) {
        setShowVoicePermissionHelp(false);
        if (setupStage === 'microphone') finishSetupMicrophone();
        else setVoiceHint(t('textChat.voice.permissionReady'));
      } else {
        setShowVoicePermissionHelp(true);
      }
    } finally {
      setIsSetupBusy(false);
    }
  }, [finishSetupMicrophone, setVoicePermissionPrompted, setupStage, t, voice]);

  useEffect(() => {
    if (!voice.error) return;


    if (voice.error === 'microphone-denied' || voice.error === 'not-allowed' || voice.error === 'service-not-allowed' || voice.error === 'unsupported') {
      setVoicePermissionPrompted(false);
      setVoiceHint(t('textChat.voice.needPermission'));
      setShowVoicePermissionHelp(true);
      voice.reset();
      return;
    }

    setVoiceHint(t('textChat.voice.startFailed'));
    voice.reset();
  }, [setVoicePermissionPrompted, t, voice, voice.error]);

  useEffect(() => () => {
    if (autoCloseTimerRef.current !== null) window.clearTimeout(autoCloseTimerRef.current);
    voice.cancel('overlay-close');
  }, [voice]);

  if (!shouldRender) return null;

  const submit = async () => {
    const text = value.trim();
    if (!text || chat.isSending || isSetupBusy) return;

    if (setupIsActive) {
      setValue("");
      const handled = await handleSetupInput(text);
      if (handled) {
        window.setTimeout(() => inputRef.current?.blur(), 40);
        return;
      }
    }

    setValue("");
    await sendText(text, "text");
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

  const setupInputDisabled = showSetupResumePrompt || (setupIsActive && (setupStage === 'microphone' || setupStage === 'done'));
  const placeholder = setupStage === 'account'
    ? t('textChat.setup.accountPlaceholder')
    : setupStage === 'balance'
      ? t('textChat.setup.balancePlaceholder')
      : t("textChat.placeholder");

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
          closeLabel={t("common.close")}
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
          isVoiceUploading={voice.state === "uploading"}
          pendingTitle={t("textChat.pending.title")}
          onScroll={handleMessagesScroll}
          onConfirm={chat.confirmAction}
          onCancel={chat.cancelAction}
          onUndo={chat.undoMessageAction}
          emptyState={
            <TextChatEmptyState
              isVoicePressed={isVoicePressed}
              voiceState={voice.state}
              prompts={contextualPrompts}
              voiceLabel={t("textChat.voice.hold")}
              title={t("textChat.empty.title")}
              caption={t("textChat.empty.caption")}
              onPrompt={(prompt) => void sendText(prompt, "text")}
              onVoicePointerDown={handleVoicePointerDown}
              onVoicePointerMove={handleVoicePointerMove}
              onVoicePointerEnd={handleVoicePointerEnd}
              onVoicePointerCancel={handleVoicePointerCancel}
            />
          }
        />

        {setupIsActive && !showSetupResumePrompt ? (
          <TextChatFirstRunActions
            stage={setupStage}
            isBusy={isSetupBusy}
            enableMicLabel={t("textChat.setup.action.enableMic")}
            skipLabel={t("textChat.setup.action.skip")}
            closeChatLabel={t("textChat.setup.action.closeChat")}
            skipBalanceLabel={t("textChat.setup.action.skipBalance")}
            onEnableMic={handleSetupEnableMicrophone}
            onSkipMic={handleSetupSkipMicrophone}
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
          <button type="button" className="text-chat-overlay__jump" onClick={() => scrollToBottom()} aria-label={t("textChat.jumpToBottom")}>
            ↓
          </button>
        ) : null}

        <TextChatComposer
          value={value}
          inputRef={inputRef}
          isSending={chat.isSending || isSetupBusy}
          inputDisabled={setupInputDisabled}
          voiceState={voice.state}
          isVoicePressed={isVoicePressed}
          isVoiceCancelledBySwipe={voice.isCancelledBySwipe}
          placeholder={placeholder}
          sendLabel={t("textChat.send")}
          voiceLabel={t("textChat.voice.hold")}
          voiceCancelHint={t("textChat.voice.swipeCancel")}
          voiceCancelledLabel={t("textChat.voice.cancelled")}
          onValueChange={setValue}
          onSubmit={submit}
          onVoicePointerDown={handleVoicePointerDown}
          onVoicePointerMove={handleVoicePointerMove}
          onVoicePointerEnd={handleVoicePointerEnd}
          onVoicePointerCancel={handleVoicePointerCancel}
        />

        {showVoicePermissionHelp ? (
          <VoicePermissionMiniPrompt
            wakeName={companionName}
            isPriming={isSetupBusy}
            permissionState={voice.permissionState}
            placement="chat"
            onPrime={handleVoicePermissionRetry}
            onClose={setupStage === 'microphone' ? handleSetupSkipMicrophone : () => setShowVoicePermissionHelp(false)}
          />
        ) : null}
      </div>

      <AuditLogDrawer open={chat.isAuditOpen} items={chat.auditLogs} onClose={chat.closeAudit} />
    </div>
  );
}
