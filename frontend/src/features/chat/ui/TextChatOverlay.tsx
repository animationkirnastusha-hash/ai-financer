import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent,
} from "react";

import { createAccount, type AccountDto } from "@/features/accounts/api/accounts.api";
import type { HomeCashflowMode } from "@/features/dashboard/lib/homeFinanceAnalytics";
import { useAccountsStore } from "@/features/accounts/model/accounts.store";
import { AuditLogDrawer } from "@/features/audit-log/ui/AuditLogDrawer";
import { useChatController } from "@/features/chat/model/useChatController";
import { useChatStore } from "@/features/chat/model/chat.store";
import { useFirstRunChatSetupStore } from "@/features/chat/model/firstRunChatSetup.store";
import { useSettingsStore } from "@/features/settings/model/settings.store";
import { createTransaction } from "@/features/transactions/api/transactions.api";
import { useTransactionsStore } from "@/features/transactions/model/transactions.store";
import { useUnifiedVoiceCapture } from '@/features/voice/manager/useUnifiedVoiceCapture';
import { VOICE_MANUAL_SESSION_MS } from "@/features/voice/model/voiceConstants";
import { shouldIgnoreVoiceCommand } from "@/features/voice/model/voiceText";
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
    content: text,
    createdAt: new Date().toISOString(),
  };
}

function inferFirstRunAccountType(name: string): "card" | "cash" {
  const normalized = name.toLowerCase();
  return normalized.includes("нал") || normalized.includes("cash") || normalized.includes("кош") ? "cash" : "card";
}

function parseFirstRunAmount(value: string): number | null {
  const match = value
    .toLowerCase()
    .replace(/\s+/g, " ")
    .match(/(?:^|\D)(\d+(?:[\s.,]\d{1,3})*)(?:\s*)(к|k|тыс|тысяч)?(?:\D|$)/i);
  if (!match) return null;

  const raw = match[1].replace(/\s/g, "").replace(",", ".");
  const suffix = match[2]?.toLowerCase();
  const amount = Number(raw);
  if (!Number.isFinite(amount) || amount < 0) return null;

  const multiplier = suffix === "к" || suffix === "k" || suffix === "тыс" || suffix === "тысяч" ? 1000 : 1;
  return Math.round(amount * multiplier * 100) / 100;
}

function cleanFirstRunAccountName(value: string) {
  return value
    .replace(/[«»"']/g, "")
    .replace(/\b(создай|создать|добавь|добавить|открой|сделай|мне|пожалуйста|счет|счёт|account|create|add|open)\b/gi, " ")
    .replace(/\b(и|and|туда|на|в|положи|положить|закинь|пополнить|пополнение|баланс|balance|put|top\s*up)\b.*$/gi, " ")
    .replace(/\d+(?:[\s.,]\d{1,3})*(?:\s*)(?:к|k|тыс|тысяч)?/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseFirstRunAccountCommand(text: string): { name: string; type: "card" | "cash"; amount: number | null } | null {
  const source = text.trim();
  if (!source) return null;

  const normalized = source.toLowerCase();
  const hasAccountIntent = /\b(счет|счёт|account)\b/i.test(normalized);
  if (!hasAccountIntent) return null;

  const amount = parseFirstRunAmount(source);
  const afterAccount = source.split(/счет|счёт|account/i)[1] ?? source;
  const name = cleanFirstRunAccountName(afterAccount) || cleanFirstRunAccountName(source);
  if (!name) return null;

  const prettyName = name.charAt(0).toUpperCase() + name.slice(1);
  return { name: prettyName, type: inferFirstRunAccountType(prettyName), amount };
}

function isSkipBalanceCommand(text: string) {
  return /^(нет|не надо|потом|пропустить|ноль|0|no|later|skip)$/i.test(text.trim());
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
  const [isVoicePressed, setIsVoicePressed] = useState(false);
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
  const voicePointerIdRef = useRef<number | null>(null);
  const voiceStartXRef = useRef(0);
  const voiceCancelledBySwipeRef = useRef(false);
  const voicePressActiveRef = useRef(false);
  const voiceStopAfterStartRef = useRef(false);
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
  const loadAccounts = useAccountsStore((state) => state.loadAccounts);
  const refreshTransactions = useTransactionsStore((state) => state.refreshDashboard);
  const setupStage = useFirstRunChatSetupStore((state) => state.stage);
  const setupMicrophoneStatus = useFirstRunChatSetupStore((state) => state.microphoneStatus);
  const setupCreatedAccount = useFirstRunChatSetupStore((state) => state.createdAccount);
  const setupIsActive = useFirstRunChatSetupStore((state) => state.isActive);
  const setupCloseLocked = useFirstRunChatSetupStore((state) => state.closeLocked);
  const setupInterrupted = useFirstRunChatSetupStore((state) => state.interrupted);
  const setupCompleted = useFirstRunChatSetupStore((state) => state.completed);
  const startFirstRunSetup = useFirstRunChatSetupStore((state) => state.start);
  const skipSetupMicrophone = useFirstRunChatSetupStore((state) => state.skipMicrophone);
  const finishSetupMicrophone = useFirstRunChatSetupStore((state) => state.finishMicrophone);
  const completeSetupAccount = useFirstRunChatSetupStore((state) => state.completeAccount);
  const completeSetupWithAccount = useFirstRunChatSetupStore((state) => state.completeWithAccount);
  const dismissFirstRunSetup = useFirstRunChatSetupStore((state) => state.dismiss);
  const markFirstRunSetupInterrupted = useFirstRunChatSetupStore((state) => state.markInterrupted);
  const resumeFirstRunSetup = useFirstRunChatSetupStore((state) => state.resumeInterrupted);
  const abandonFirstRunSetup = useFirstRunChatSetupStore((state) => state.abandonInterrupted);
  const primaryAccountId = useSettingsStore((state) => state.primaryAccountId);
  const incomeAccountId = useSettingsStore((state) => state.incomeAccountId);
  const setPrimaryAccountId = useSettingsStore((state) => state.setPrimaryAccountId);
  const setIncomeAccountId = useSettingsStore((state) => state.setIncomeAccountId);
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
    const prefix = appLanguage === "en"
      ? quickCreateMode === "income" ? "Record income:" : "Record expense:"
      : quickCreateMode === "income" ? "Запиши доход:" : "Запиши расход:";

    return { text: `${prefix} ${clean}`, displayText: clean };
  }, [appLanguage, hiddenCommandPrefix, inlinePendingActions.length, quickCreateMode]);

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
      setIsVoicePressed(false);
    }, 220);

    return () => window.clearTimeout(timer);
  }, [open, shouldRender]);

  const voice = useUnifiedVoiceCapture({
    lang: appLanguage === "en" ? "en-US" : "ru-RU",
    sessionMs: VOICE_MANUAL_SESSION_MS,
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

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    const list = listRef.current;
    if (!list) return;
    list.scrollTo({ top: list.scrollHeight, behavior });
    shouldStickToBottomRef.current = true;
    setShowJumpToBottom(false);
  }, []);

  const cancelVoice = useCallback(
    (message?: string) => {
      voicePressActiveRef.current = false;
      voiceStopAfterStartRef.current = false;
      setIsVoicePressed(false);
      voice.cancel();
      setVoiceHint(message ?? t("textChat.voice.cancelled"));
    },
    [t, voice],
  );

  const stopVoiceAndSend = useCallback(() => {
    voicePressActiveRef.current = false;
    setIsVoicePressed(false);

    if (voice.state === "recording" || voice.state === "idle") {
      setVoiceHint(t("textChat.voice.recognizing"));
      voice.stop();
      return;
    }

    if (voice.state === "uploading") setVoiceHint(t("textChat.voice.recognizing"));
  }, [t, voice]);

  const promptVoicePermissionInChat = useCallback(() => {
    voicePointerIdRef.current = null;
    voicePressActiveRef.current = false;
    voiceStopAfterStartRef.current = false;
    voiceCancelledBySwipeRef.current = false;
    setIsVoicePressed(false);
    voice.cancel();
    voice.reset?.();
    setVoiceHint(t("textChat.voice.needPermission"));
    setShowVoicePermissionHelp(true);
    shouldStickToBottomRef.current = true;
    setChatMessages((messages) => {
      if (messages.some((message) => message.id === "voice-permission-request")) return messages;
      return [
        ...messages,
        {
          id: "voice-permission-request",
          role: "assistant",
          kind: "text",
          text: t("textChat.voice.permissionPrompt"),
          createdAt: new Date().toISOString(),
        },
      ];
    });
  }, [setChatMessages, t, voice]);

  const startVoice = useCallback(async () => {
    if (chat.isSending || voice.state === "recording" || voice.state === "uploading") return false;

    const result = await voice.start();
    if (result === "started") {
      setVoicePermissionPrompted(true);
      setShowVoicePermissionHelp(false);
      setVoiceHint(t("textChat.voice.listening"));
      setIsVoicePressed(true);
      if (voiceStopAfterStartRef.current || voicePointerIdRef.current === null) {
        voiceStopAfterStartRef.current = false;
        window.setTimeout(() => {
          setIsVoicePressed(false);
          setVoiceHint(t("textChat.voice.recognizing"));
          voice.stop();
        }, 140);
      }
      return true;
    }

    voicePointerIdRef.current = null;
    voicePressActiveRef.current = false;
    voiceStopAfterStartRef.current = false;
    setIsVoicePressed(false);
    voice.reset?.();

    if (result === "permission-consumed" || result === "permission-ready") {
      const nextPermission = await voice.refreshPermissionState?.();
      const allowed = nextPermission === "granted";
      setVoicePermissionPrompted(allowed);
      if (allowed) {
        setVoiceHint(t("textChat.voice.permissionReady"));
      } else {
        promptVoicePermissionInChat();
      }
    } else if (result === "busy") {
      setVoiceHint(t("textChat.voice.busy"));
    } else {
      setVoiceHint(t("textChat.voice.startFailed"));
    }

    return false;
  }, [chat.isSending, promptVoicePermissionInChat, setVoicePermissionPrompted, t, voice]);

  const handleVoicePointerDown = useCallback(
    (event: PointerEvent<HTMLButtonElement>) => {
      if (value.trim() || chat.isSending || voice.state === "uploading" || isSetupBusy || setupStage === 'microphone') return;
      event.preventDefault();
      event.stopPropagation();

      if (!setupIsActive && (voice.permissionState === "denied" || voice.permissionState === "unsupported")) {
        promptVoicePermissionInChat();
        return;
      }

      voicePointerIdRef.current = event.pointerId;
      voiceStartXRef.current = event.clientX;
      voiceCancelledBySwipeRef.current = false;
      voicePressActiveRef.current = true;
      voiceStopAfterStartRef.current = false;
      event.currentTarget.setPointerCapture?.(event.pointerId);
      void startVoice();
    },
    [chat.isSending, isSetupBusy, promptVoicePermissionInChat, setupIsActive, setupStage, startVoice, value, voice.permissionState, voice.state],
  );

  const handleVoicePointerMove = useCallback(
    (event: PointerEvent<HTMLButtonElement>) => {
      if (voicePointerIdRef.current !== event.pointerId || voiceCancelledBySwipeRef.current) return;
      const dx = event.clientX - voiceStartXRef.current;
      if (dx <= -72) {
        voiceCancelledBySwipeRef.current = true;
        cancelVoice(t("textChat.voice.cancelled"));
      }
    },
    [cancelVoice, t],
  );

  const handleVoicePointerEnd = useCallback(
    (event: PointerEvent<HTMLButtonElement>) => {
      if (voicePointerIdRef.current !== event.pointerId) return;
      event.preventDefault();
      event.stopPropagation();
      voicePointerIdRef.current = null;
      voicePressActiveRef.current = false;
      if (voiceCancelledBySwipeRef.current) {
        voiceCancelledBySwipeRef.current = false;
        return;
      }
      if (voice.state === "recording" || voice.state === "uploading") {
        stopVoiceAndSend();
        return;
      }

      voiceStopAfterStartRef.current = true;
      stopVoiceAndSend();
    },
    [stopVoiceAndSend, voice.state],
  );

  const handleVoicePointerCancel = useCallback(
    (event: PointerEvent<HTMLButtonElement>) => {
      if (voicePointerIdRef.current !== event.pointerId) return;
      voicePointerIdRef.current = null;
      voicePressActiveRef.current = false;
      voiceCancelledBySwipeRef.current = false;
      cancelVoice(t("textChat.voice.cancelled"));
    },
    [cancelVoice, t],
  );

  useEffect(() => {
    if (!open) return;

    const releaseIfNeeded = () => {
      if (voicePointerIdRef.current === null) return;
      voicePointerIdRef.current = null;
      voicePressActiveRef.current = false;
      if (voiceCancelledBySwipeRef.current) {
        voiceCancelledBySwipeRef.current = false;
        cancelVoice(t("textChat.voice.cancelled"));
        return;
      }
      stopVoiceAndSend();
    };

    const cancelIfNeeded = () => {
      if (voicePointerIdRef.current === null && voice.state !== 'recording') return;
      voicePointerIdRef.current = null;
      voicePressActiveRef.current = false;
      voiceCancelledBySwipeRef.current = false;
      cancelVoice(t("textChat.voice.cancelled"));
    };

    window.addEventListener('pointerup', releaseIfNeeded, true);
    window.addEventListener('pointercancel', cancelIfNeeded, true);
    window.addEventListener('blur', cancelIfNeeded);
    document.addEventListener('visibilitychange', cancelIfNeeded);

    return () => {
      window.removeEventListener('pointerup', releaseIfNeeded, true);
      window.removeEventListener('pointercancel', cancelIfNeeded, true);
      window.removeEventListener('blur', cancelIfNeeded);
      document.removeEventListener('visibilitychange', cancelIfNeeded);
    };
  }, [cancelVoice, open, stopVoiceAndSend, t, voice.state]);

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
    void voice.refreshPermissionState?.();
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

    voicePointerIdRef.current = null;
    voicePressActiveRef.current = false;
    voiceStopAfterStartRef.current = false;
    voiceCancelledBySwipeRef.current = false;
    voice.cancel();
    voice.reset?.();
    setIsVoicePressed(false);
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

      if (setupStage === 'balance' && setupCreatedAccount) {
        return [createSetupMessage('first-run-setup-balance', t('textChat.setup.balanceQuestion', { account: setupCreatedAccount.name }))];
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
  }, [open, setChatMessages, setupCreatedAccount, setupIsActive, setupMicrophoneStatus, setupStage, showSetupResumePrompt, t]);

  const handleSetupEnableMicrophone = useCallback(async () => {
    if (setupStage !== 'microphone' || isSetupBusy) return;

    setIsSetupBusy(true);
    setShowVoicePermissionHelp(false);
    try {
      const allowed = await voice.primePermission();
      setVoicePermissionPrompted(allowed);
      voice.reset?.();
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
    voice.cancel();
    voice.reset?.();
    setVoicePermissionPrompted(false);
    skipSetupMicrophone();
  }, [setVoicePermissionPrompted, setupStage, skipSetupMicrophone, voice]);

  const addInitialBalance = useCallback(async (account: AccountDto, amount: number) => {
    if (amount <= 0) return;
    await createTransaction({
      accountId: account.id,
      amount,
      type: 'income',
      title: t('textChat.setup.initialBalanceTitle'),
      description: t('textChat.setup.initialBalanceDescription'),
      date: new Date().toISOString(),
      isAIGenerated: false,
    });
  }, [t]);

  const createSetupAccount = useCallback(async (name: string, amount: number | null) => {
    if (isSetupBusy) return;

    setIsSetupBusy(true);
    try {
      const account = await createAccount({
        name,
        type: inferFirstRunAccountType(name),
        currency: 'RUB',
        initialBalance: 0,
        showInTotalBalance: true,
      });

      if (!primaryAccountId) setPrimaryAccountId(account.id);
      if (!incomeAccountId) setIncomeAccountId(account.id);

      if (amount !== null && amount > 0) {
        await addInitialBalance(account, amount);
        await Promise.all([loadAccounts(true), refreshTransactions()]);
        completeSetupWithAccount(account);
        return;
      }

      await Promise.all([loadAccounts(true), refreshTransactions()]);
      completeSetupAccount(account);
    } catch {
      appendSetupAssistantMessage('first-run-setup-create-failed', t('textChat.setup.createFailed'), 'error');
    } finally {
      setIsSetupBusy(false);
    }
  }, [addInitialBalance, appendSetupAssistantMessage, completeSetupAccount, completeSetupWithAccount, incomeAccountId, isSetupBusy, loadAccounts, primaryAccountId, refreshTransactions, setIncomeAccountId, setPrimaryAccountId, t]);

  const completeBalanceStep = useCallback(async (amount: number) => {
    if (!setupCreatedAccount || isSetupBusy) return;

    setIsSetupBusy(true);
    try {
      if (amount > 0) await addInitialBalance(setupCreatedAccount, amount);
      await Promise.all([loadAccounts(true), refreshTransactions()]);
      completeSetupWithAccount(setupCreatedAccount);
    } catch {
      appendSetupAssistantMessage('first-run-setup-balance-save-failed', t('textChat.setup.createFailed'), 'error');
    } finally {
      setIsSetupBusy(false);
    }
  }, [addInitialBalance, appendSetupAssistantMessage, completeSetupWithAccount, isSetupBusy, loadAccounts, refreshTransactions, setupCreatedAccount, t]);

  const handleSetupInput = useCallback(async (text: string) => {
    const clean = text.trim();
    if (!clean) return true;

    if (setupStage === 'account') {
      const parsed = parseFirstRunAccountCommand(clean);
      if (!parsed) {
        appendSetupAssistantMessage('first-run-setup-account-invalid', t('textChat.setup.accountInvalid'), 'error');
        return true;
      }

      await createSetupAccount(parsed.name, parsed.amount);
      return true;
    }

    if (setupStage === 'balance') {
      if (isSkipBalanceCommand(clean)) {
        await completeBalanceStep(0);
        return true;
      }

      const amount = parseFirstRunAmount(clean);
      if (amount === null) {
        appendSetupAssistantMessage('first-run-setup-balance-invalid', t('textChat.setup.balanceInvalid'), 'error');
        return true;
      }

      await completeBalanceStep(amount);
      return true;
    }

    return false;
  }, [appendSetupAssistantMessage, completeBalanceStep, createSetupAccount, setupStage, t]);

  useEffect(() => {
    setupInputHandlerRef.current = handleSetupInput;
  }, [handleSetupInput]);

  const handleVoicePermissionRetry = useCallback(async () => {
    setIsSetupBusy(true);
    try {
      const allowed = await voice.primePermission();
      setVoicePermissionPrompted(allowed);
      voice.reset?.();
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

    setIsVoicePressed(false);
    voicePointerIdRef.current = null;
    voicePressActiveRef.current = false;

    if (voice.error === 'microphone-denied' || voice.error === 'not-allowed' || voice.error === 'service-not-allowed' || voice.error === 'unsupported') {
      setVoicePermissionPrompted(false);
      setVoiceHint(t('textChat.voice.needPermission'));
      setShowVoicePermissionHelp(true);
      setIsVoicePressed(false);
      voice.reset?.();
      return;
    }

    setVoiceHint(t('textChat.voice.startFailed'));
    voice.reset?.();
  }, [setVoicePermissionPrompted, t, voice, voice.error]);

  useEffect(() => () => {
    if (autoCloseTimerRef.current !== null) window.clearTimeout(autoCloseTimerRef.current);
    voicePointerIdRef.current = null;
    voicePressActiveRef.current = false;
    voiceStopAfterStartRef.current = false;
    voiceCancelledBySwipeRef.current = false;
    voice.cancel();
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
            onEnableMic={handleSetupEnableMicrophone}
            onSkipMic={handleSetupSkipMicrophone}
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
          isVoiceCancelledBySwipe={voiceCancelledBySwipeRef.current}
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
