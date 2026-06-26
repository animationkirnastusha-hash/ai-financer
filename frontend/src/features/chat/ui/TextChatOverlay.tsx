import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent,
} from "react";

import { createAccount } from "@/features/accounts/api/accounts.api";
import { useAccountsStore } from "@/features/accounts/model/accounts.store";
import { AuditLogDrawer } from "@/features/audit-log/ui/AuditLogDrawer";
import { useChatController } from "@/features/chat/model/useChatController";
import { useChatStore } from "@/features/chat/model/chat.store";
import { useFirstRunChatSetupStore } from "@/features/chat/model/firstRunChatSetup.store";
import { useSettingsStore } from "@/features/settings/model/settings.store";
import { useAppModalStore } from "@/features/modals/model/appModal.store";
import { markProductTourPending } from "@/features/product-tour/model/productTourPending.store";
import { useReceiptScansStore } from "@/features/receipt-scans/model/receiptScans.store";
import { getReceiptUploadIssueKey } from "@/features/receipt-scans/lib/receiptUploadGuards";
import { useSubscriptionStore } from "@/features/subscription/model/subscription.store";
import { createTransaction } from "@/features/transactions/api/transactions.api";
import { useTransactionsStore } from "@/features/transactions/model/transactions.store";
import { useVoiceInput } from "@/features/voice/model/useVoiceInput";
import { VOICE_MANUAL_SESSION_MS } from "@/features/voice/model/voiceConstants";
import { shouldIgnoreVoiceCommand } from "@/features/voice/model/voiceText";
import { useI18n } from "@/shared/lib/i18n";
import {
  OVERLAY_DISMISS_DRAG_PX,
  RECEIPT_CAMERA_ACCEPT_TYPES,
  RECEIPT_FILE_ACCEPT_TYPES,
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

type FirstRunParsedAccount = {
  name: string;
  type: "card" | "cash";
  balance: number;
};

function inferFirstRunAccountType(name: string): FirstRunParsedAccount["type"] {
  const normalized = name.toLowerCase();
  return normalized.includes("нал") || normalized.includes("cash") ? "cash" : "card";
}

function parseFirstRunAmount(rawValue: string): { amount: number; token: string } | null {
  const match = rawValue.match(/(?:^|[\s,.:;])(?<amount>\d+(?:[\s,.]\d{3})*(?:[,.]\d+)?|\d+)(?:\s*)(?<suffix>к|k|тыс\.?|тысяч)?(?=$|[\s,.:;!?₽рr])/i);
  const amountText = match?.groups?.amount;
  if (!match || !amountText) return null;

  const compact = amountText.replace(/\s/g, "");
  const decimalText = /[,.]\d{1,2}$/.test(compact)
    ? compact.replace(",", ".")
    : compact.replace(/[,.]/g, "");
  const base = Number(decimalText);
  if (!Number.isFinite(base) || base < 0) return null;

  const suffix = match.groups?.suffix?.toLowerCase() ?? "";
  const multiplier = suffix ? 1000 : 1;
  return {
    amount: Math.round(base * multiplier * 100) / 100,
    token: match[0],
  };
}

function parseFirstRunAccountCommand(value: string): FirstRunParsedAccount | "missing-account" | "missing-balance" {
  const source = value.trim();
  if (!source) return "missing-account";

  const amount = parseFirstRunAmount(source);
  if (!amount) return "missing-balance";

  const withoutAmount = source.replace(amount.token, " " );
  const cleaned = withoutAmount
    .replace(/[«»"']/g, " " )
    .replace(/[,.!?;:()]/g, " " )
    .replace(/\b(создай|создать|добавь|добавить|открой|сделай|первый|первую|сч[её]т|аккаунт|баланс|остаток|сейчас|сумма|положи|пополнить|пополнение|доход|туда|на|в|и|рубл(?:ь|я|ей)?|руб|р|₽)\b/gi, " " )
    .replace(/\b(create|add|open|make|first|account|balance|current|amount|put|top\s*up|income|money|to|on|in|and|rub|rubles|rur)\b/gi, " " )
    .replace(/\s+/g, " " )
    .trim();

  let name = cleaned;
  const lower = source.toLowerCase();
  if (!name) {
    if (lower.includes("нал") || lower.includes("cash")) name = lower.includes("cash") ? "Cash" : "Наличные";
    else if (lower.includes("карт") || lower.includes("card")) name = lower.includes("card") ? "Card" : "Карта";
  }

  if (!name) return "missing-account";
  return { name: name.slice(0, 48), type: inferFirstRunAccountType(name), balance: amount.amount };
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
  layer = 130,
  onClose,
}: TextChatOverlayProps) {
  const { t } = useI18n();
  const [value, setValue] = useState(initialCommand?.trim() ?? "");
  const [showJumpToBottom, setShowJumpToBottom] = useState(false);
  const [isVoicePressed, setIsVoicePressed] = useState(false);
  const [voiceHint, setVoiceHint] = useState<string | null>(
    mode === "voice" ? null : null,
  );
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
  const receiptCameraInputRef = useRef<HTMLInputElement | null>(null);
  const receiptFileInputRef = useRef<HTMLInputElement | null>(null);
  const [receiptHint, setReceiptHint] = useState<string | null>(null);
  const [isSetupBusy, setIsSetupBusy] = useState(false);
  const setupVoiceTextHandlerRef = useRef<(text: string) => Promise<boolean>>(async () => false);

  const chat = useChatController();
  const appendChatMessage = useChatStore((state) => state.appendMessage);
  const setChatMessages = useChatStore((state) => state.setMessages);
  const openModal = useAppModalStore((state) => state.openModal);
  const loadAccounts = useAccountsStore((state) => state.loadAccounts);
  const refreshTransactions = useTransactionsStore((state) => state.refreshDashboard);
  const subscription = useSubscriptionStore((state) => state.status);
  const loadSubscription = useSubscriptionStore((state) => state.load);
  const uploadReceipt = useReceiptScansStore((state) => state.upload);
  const isReceiptUploading = useReceiptScansStore((state) => state.isUploading);
  const setupStage = useFirstRunChatSetupStore((state) => state.stage);
  const setupIsActive = useFirstRunChatSetupStore((state) => state.isActive);
  const setupCloseLocked = useFirstRunChatSetupStore((state) => state.closeLocked);
  const startFirstRunSetup = useFirstRunChatSetupStore((state) => state.start);
  const skipSetupMicrophone = useFirstRunChatSetupStore((state) => state.skipMicrophone);
  const finishSetupMicrophone = useFirstRunChatSetupStore((state) => state.finishMicrophone);
  const completeSetupWithAccount = useFirstRunChatSetupStore((state) => state.completeWithAccount);
  const dismissFirstRunSetup = useFirstRunChatSetupStore((state) => state.dismiss);
  const primaryAccountId = useSettingsStore((state) => state.primaryAccountId);
  const incomeAccountId = useSettingsStore((state) => state.incomeAccountId);
  const setPrimaryAccountId = useSettingsStore((state) => state.setPrimaryAccountId);
  const setIncomeAccountId = useSettingsStore((state) => state.setIncomeAccountId);
  const companionName = useSettingsStore(
    (state) => state.companionName || "Фина",
  );
  const appLanguage = useSettingsStore((state) => state.appLanguage);
  const voicePermissionPrompted = useSettingsStore(
    (state) => state.voicePermissionPrompted,
  );
  const setVoicePermissionPrompted = useSettingsStore(
    (state) => state.setVoicePermissionPrompted,
  );

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

  const hasReceiptAccess = Boolean(
    subscription?.access?.hasPremium ||
    subscription?.access?.hasBusiness ||
    subscription?.features?.receiptScan,
  );

  const sendText = useCallback(
    async (text: string, source: "text" | "voice" = "text") => {
      const clean = text.trim();
      if (!clean || chat.isSending) return;
      shouldStickToBottomRef.current = true;
      if (source === "voice") lastVoiceSendAtRef.current = Date.now();
      await chat.sendMessage(
        { text: clean, source },
        { supersedeInFlight: true },
      );
    },
    [chat],
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

  const voice = useVoiceInput({
    lang: appLanguage === "en" ? "en-US" : "ru-RU",
    sessionMs: VOICE_MANUAL_SESSION_MS,
    permissionWasPrompted: voicePermissionPrompted,
    onText: async (rawText) => {
      const text = stripOptionalCompanionName(rawText, companionName);
      if (!text || shouldIgnoreVoiceCommand(text)) {
        setVoiceHint(t("textChat.voice.notHeard"));
        return;
      }
      const handledBySetup = await setupVoiceTextHandlerRef.current(text);
      if (handledBySetup) {
        setVoiceHint(null);
        return;
      }

      setVoiceHint(t("textChat.voice.thinking"));
      await sendText(text, "voice");
      setVoiceHint(null);
    },
  });

  const statusText = useMemo(() => {
    const seed = chat.messages.length + inlinePendingActions.length;
    if (voice.state === "recording")
      return pickRotatingStatus(t, "listening", seed);
    if (voice.state === "uploading")
      return pickRotatingStatus(t, "thinking", seed + 1);
    if (chat.isSending) return pickRotatingStatus(t, "thinking", seed + 2);
    if (hasBlockingConfirmation)
      return pickRotatingStatus(t, "confirm", seed);
    if (setupCloseLocked) return t("textChat.status.locked");
    return voiceHint || pickRotatingStatus(t, "ready", seed);
  }, [
    chat.isSending,
    chat.messages.length,
    hasBlockingConfirmation,
    inlinePendingActions.length,
    setupCloseLocked,
    t,
    voice.state,
    voiceHint,
  ]);

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

  const startVoice = useCallback(async () => {
    if (
      chat.isSending ||
      voice.state === "recording" ||
      voice.state === "uploading"
    )
      return false;

    const result = await voice.start();
    if (result === "started") {
      setVoicePermissionPrompted(true);
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

    voicePressActiveRef.current = false;
    voiceStopAfterStartRef.current = false;
    setIsVoicePressed(false);
    voice.reset?.();

    if (result === "permission-consumed") {
      const nextPermission = await voice.refreshPermissionState?.();
      const allowed = nextPermission === "granted";
      setVoicePermissionPrompted(allowed);
      setVoiceHint(allowed ? t("textChat.voice.permissionReady") : t("textChat.voice.needPermission"));
    } else if (result === "busy") {
      setVoiceHint(t("textChat.voice.busy"));
    } else if (result === "permission-ready") {
      setVoiceHint(t("textChat.voice.needPermission"));
    } else {
      setVoiceHint(t("textChat.voice.startFailed"));
    }

    return false;
  }, [chat.isSending, setVoicePermissionPrompted, t, voice]);

  const handleVoicePointerDown = useCallback(
    (event: PointerEvent<HTMLButtonElement>) => {
      if (value.trim() || chat.isSending || voice.state === "uploading") return;
      event.preventDefault();
      event.stopPropagation();
      voicePointerIdRef.current = event.pointerId;
      voiceStartXRef.current = event.clientX;
      voiceCancelledBySwipeRef.current = false;
      voicePressActiveRef.current = true;
      voiceStopAfterStartRef.current = false;
      event.currentTarget.setPointerCapture?.(event.pointerId);
      void startVoice();
    },
    [chat.isSending, startVoice, value, voice.state],
  );

  const handleVoicePointerMove = useCallback(
    (event: PointerEvent<HTMLButtonElement>) => {
      if (
        voicePointerIdRef.current !== event.pointerId ||
        voiceCancelledBySwipeRef.current
      )
        return;
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
    if (voice.state === "recording") return;
    if (!voicePressActiveRef.current && !isVoicePressed) return;
    voicePointerIdRef.current = null;
    voicePressActiveRef.current = false;
    voiceStopAfterStartRef.current = false;
    voiceCancelledBySwipeRef.current = false;
    setIsVoicePressed(false);
  }, [isVoicePressed, voice.state]);

  useEffect(() => {
    if (!open) return;

    const finishLostVoicePointer = () => {
      if (!voicePressActiveRef.current) return;
      voicePointerIdRef.current = null;
      voicePressActiveRef.current = false;
      if (voiceCancelledBySwipeRef.current) {
        voiceCancelledBySwipeRef.current = false;
        return;
      }
      stopVoiceAndSend();
    };

    const cancelLostVoicePointer = () => {
      if (!voicePressActiveRef.current) return;
      voicePointerIdRef.current = null;
      voicePressActiveRef.current = false;
      voiceCancelledBySwipeRef.current = false;
      cancelVoice(t("textChat.voice.cancelled"));
    };

    window.addEventListener('pointerup', finishLostVoicePointer);
    window.addEventListener('pointercancel', cancelLostVoicePointer);
    window.addEventListener('blur', cancelLostVoicePointer);
    return () => {
      window.removeEventListener('pointerup', finishLostVoicePointer);
      window.removeEventListener('pointercancel', cancelLostVoicePointer);
      window.removeEventListener('blur', cancelLostVoicePointer);
    };
  }, [cancelVoice, open, stopVoiceAndSend, t]);

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
    if (!open || subscription) return;
    void loadSubscription();
  }, [loadSubscription, open, subscription]);

  useEffect(() => {
    if (!open) return;
    const text = initialAssistantMessage?.trim();
    if (!text) return;

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
  }, [appendChatMessage, chat.messages, initialAssistantMessage, open]);

  useEffect(() => {
    if (
      !open ||
      mode !== "voice" ||
      !autoStartVoice ||
      autoStartDoneRef.current
    )
      return;
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
      if (
        cleanCommand &&
        autoSubmittedInitialCommandRef.current !== cleanCommand
      ) {
        autoSubmittedInitialCommandRef.current = cleanCommand;
        setValue("");
        setVoiceHint(t("textChat.voice.thinking"));
        void sendText(cleanCommand, "voice").finally(() => setVoiceHint(null));
      }
      return;
    }

    setValue(command);
  }, [autoSubmitInitialCommand, companionName, initialCommand, open, sendText]);

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
  }, [
    chat.messages.length,
    inlinePendingActions.length,
    chat.isSending,
    open,
    scrollToBottom,
  ]);

  useEffect(() => {
    if (!open || !autoCloseOnVoiceResult || isVoicePressed) return;
    if (
      chat.isSending ||
      voice.state !== "idle" ||
      hasBlockingConfirmation
    )
      return;
    if (
      !lastVoiceSendAtRef.current ||
      Date.now() - lastVoiceSendAtRef.current > 24000
    )
      return;

    const lastMessage = chat.messages.at(-1);
    if (
      !lastMessage ||
      lastMessage.role !== "assistant" ||
      lastMessage.kind !== "success"
    )
      return;

    const key = `${lastMessage.id}:${lastMessage.createdAt}:${lastMessage.text}`;
    if (lastAutoClosedMessageKeyRef.current === key) return;
    lastAutoClosedMessageKeyRef.current = key;

    if (autoCloseTimerRef.current !== null)
      window.clearTimeout(autoCloseTimerRef.current);
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
  }, [
    autoCloseOnVoiceResult,
    chat.isSending,
    chat.messages,
    hasBlockingConfirmation,
    isVoicePressed,
    onClose,
    open,
    voice.state,
  ]);

  const closeOverlay = useCallback(() => {
    if (setupCloseLocked) {
      setReceiptHint(t("textChat.setup.closeLocked"));
      return;
    }

    voicePointerIdRef.current = null;
    voicePressActiveRef.current = false;
    voiceStopAfterStartRef.current = false;
    voiceCancelledBySwipeRef.current = false;
    voice.cancel();
    voice.reset?.();
    setIsVoicePressed(false);
    setVoiceHint(null);
    setDragOffset(0);
    dragStartYRef.current = null;
    if (setupStage === 'done') dismissFirstRunSetup();
    onClose();
  }, [dismissFirstRunSetup, onClose, setupCloseLocked, setupStage, t, voice]);

  const handleDragPointerDown = useCallback(
    (event: PointerEvent<HTMLButtonElement>) => {
      dragStartYRef.current = event.clientY;
      setDragOffset(0);
      event.currentTarget.setPointerCapture?.(event.pointerId);
    },
    [],
  );

  const handleDragPointerMove = useCallback(
    (event: PointerEvent<HTMLButtonElement>) => {
      if (dragStartYRef.current === null) return;
      const dy = Math.max(0, event.clientY - dragStartYRef.current);
      setDragOffset(Math.min(150, dy));
    },
    [],
  );

  const handleDragPointerEnd = useCallback(() => {
    if (!setupCloseLocked && dragOffset >= OVERLAY_DISMISS_DRAG_PX) closeOverlay();
    dragStartYRef.current = null;
    setDragOffset(0);
  }, [closeOverlay, dragOffset, setupCloseLocked]);

  const handleReceiptFile = useCallback(
    async (file: File | null) => {
      if (!hasReceiptAccess || isReceiptUploading) return;

      const issueKey = getReceiptUploadIssueKey(file);
      if (issueKey) {
        setReceiptHint(t(issueKey));
        if (receiptCameraInputRef.current) receiptCameraInputRef.current.value = "";
        if (receiptFileInputRef.current) receiptFileInputRef.current.value = "";
        return;
      }

      setReceiptHint(t("textChat.receipt.uploading"));
      const scan = await uploadReceipt(file as File);
      const uploadError = useReceiptScansStore.getState().error;
      setReceiptHint(scan ? t("textChat.receipt.success") : t(uploadError || "receipts.upload.failed"));
      if (receiptCameraInputRef.current) receiptCameraInputRef.current.value = "";
      if (receiptFileInputRef.current) receiptFileInputRef.current.value = "";
    },
    [hasReceiptAccess, isReceiptUploading, t, uploadReceipt],
  );


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
    if (!open || !firstRunSetup || setupStage !== 'idle') return;
    startFirstRunSetup();
  }, [firstRunSetup, open, setupStage, startFirstRunSetup]);

  useEffect(() => {
    if (!open || !setupIsActive) return;

    const timers: number[] = [];
    const schedule = (delay: number, id: string, text: string, kind: "text" | "success" | "error" = "text") => {
      timers.push(window.setTimeout(() => appendSetupAssistantMessage(id, text, kind), delay));
    };

    if (setupStage === 'microphone') {
      schedule(0, 'first-run-setup-welcome', t('textChat.setup.welcome'));
      schedule(720, 'first-run-setup-microphone', t('textChat.setup.microphone'));
    }

    if (setupStage === 'account') {
      const hasAccountPrompt = useChatStore.getState().messages.some((message) =>
        message.id === 'first-run-setup-account' ||
        message.id === 'first-run-setup-microphone-ready' ||
        message.id === 'first-run-setup-microphone-skipped',
      );
      if (!hasAccountPrompt) {
        schedule(0, 'first-run-setup-account', t('textChat.setup.account'));
      }
    }

    if (setupStage === 'done') {
      schedule(0, 'first-run-setup-created', t('textChat.setup.created'), 'success');
      schedule(680, 'first-run-setup-tour', t('textChat.setup.tour'));
    }

    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [appendSetupAssistantMessage, open, setupIsActive, setupStage, t]);

  const handleReceiptClick = useCallback(() => {
    if (isReceiptUploading) return;

    if (!hasReceiptAccess) {
      openModal({ type: 'receipt-premium-lock' });
      return;
    }

    receiptCameraInputRef.current?.click();
  }, [hasReceiptAccess, isReceiptUploading, openModal]);

  const handleSetupEnableMicrophone = useCallback(async () => {
    if (setupStage !== 'microphone' || isSetupBusy) return;

    setIsSetupBusy(true);
    try {
      const allowed = await voice.primePermission();
      setVoicePermissionPrompted(allowed);
      appendSetupAssistantMessage(
        allowed ? 'first-run-setup-microphone-ready' : 'first-run-setup-microphone-failed',
        allowed ? t('textChat.setup.microphoneReady') : t('textChat.setup.microphoneFailed'),
        allowed ? 'success' : 'error',
      );
      window.setTimeout(finishSetupMicrophone, 420);
    } catch {
      setVoicePermissionPrompted(false);
      appendSetupAssistantMessage('first-run-setup-microphone-failed', t('textChat.setup.microphoneFailed'), 'error');
      window.setTimeout(finishSetupMicrophone, 420);
    } finally {
      setIsSetupBusy(false);
    }
  }, [appendSetupAssistantMessage, finishSetupMicrophone, isSetupBusy, setVoicePermissionPrompted, setupStage, t, voice]);

  const handleSetupSkipMicrophone = useCallback(() => {
    if (setupStage !== 'microphone') return;
    appendSetupAssistantMessage('first-run-setup-microphone-skipped', t('textChat.setup.microphoneSkipped'));
    window.setTimeout(skipSetupMicrophone, 420);
  }, [appendSetupAssistantMessage, setupStage, skipSetupMicrophone, t]);

  const createSetupAccountFromText = useCallback(
    async (text: string) => {
      if (setupStage !== 'account' || isSetupBusy) return false;

      const parsed = parseFirstRunAccountCommand(text);
      if (parsed === 'missing-account') {
        appendSetupAssistantMessage(`first-run-setup-account-missing-${Date.now()}`, t('textChat.setup.accountNeedName'), 'error');
        return true;
      }
      if (parsed === 'missing-balance') {
        appendSetupAssistantMessage(`first-run-setup-balance-missing-${Date.now()}`, t('textChat.setup.accountNeedBalance'), 'error');
        return true;
      }

      setIsSetupBusy(true);
      try {
        const account = await createAccount({
          name: parsed.name,
          type: parsed.type,
          currency: 'RUB',
          initialBalance: 0,
          showInTotalBalance: true,
        });

        if (!primaryAccountId) setPrimaryAccountId(account.id);
        if (!incomeAccountId) setIncomeAccountId(account.id);

        if (parsed.balance > 0) {
          await createTransaction({
            accountId: account.id,
            amount: parsed.balance,
            type: 'income',
            title: t('textChat.setup.initialBalanceTitle'),
            description: t('textChat.setup.initialBalanceDescription'),
            date: new Date().toISOString(),
            isAIGenerated: false,
          });
        }

        await Promise.all([loadAccounts(true), refreshTransactions()]);
        markProductTourPending();
        completeSetupWithAccount(account);
      } catch {
        appendSetupAssistantMessage('first-run-setup-create-failed', t('textChat.setup.createFailed'), 'error');
      } finally {
        setIsSetupBusy(false);
      }

      return true;
    },
    [
      appendSetupAssistantMessage,
      completeSetupWithAccount,
      incomeAccountId,
      isSetupBusy,
      loadAccounts,
      primaryAccountId,
      refreshTransactions,
      setIncomeAccountId,
      setPrimaryAccountId,
      setupStage,
      t,
    ],
  );

  useEffect(() => {
    setupVoiceTextHandlerRef.current = createSetupAccountFromText;
  }, [createSetupAccountFromText]);

  useEffect(() => {
    if (!voice.error) return;

    setIsVoicePressed(false);

    if (
      voice.error === 'microphone-denied' ||
      voice.error === 'not-allowed' ||
      voice.error === 'service-not-allowed'
    ) {
      setVoicePermissionPrompted(false);
      setVoiceHint(t('textChat.voice.needPermission'));
      voice.reset?.();
      return;
    }

    setVoiceHint(voice.error === 'no-speech' ? t('textChat.voice.notHeard') : t('textChat.voice.startFailed'));
    voice.reset?.();
  }, [setVoicePermissionPrompted, t, voice, voice.error]);

  useEffect(
    () => () => {
      if (autoCloseTimerRef.current !== null)
        window.clearTimeout(autoCloseTimerRef.current);
      voicePointerIdRef.current = null;
      voicePressActiveRef.current = false;
      voiceStopAfterStartRef.current = false;
      voiceCancelledBySwipeRef.current = false;
      voice.cancel();
    },
    [voice],
  );

  if (!shouldRender) return null;

  const submit = async () => {
    const text = value.trim();
    if (!text || chat.isSending || isSetupBusy) return;

    if (setupIsActive && setupStage === 'account') {
      setValue("");
      await createSetupAccountFromText(text);
      window.setTimeout(() => inputRef.current?.blur(), 40);
      return;
    }

    if (setupCloseLocked) {
      setReceiptHint(t("textChat.setup.closeLocked"));
      return;
    }

    setValue("");
    await sendText(text, "text");
    window.setTimeout(() => inputRef.current?.blur(), 40);
  };

  const handleMessagesScroll = () => {
    const list = listRef.current;
    if (!list) return;
    const distanceToBottom =
      list.scrollHeight - list.scrollTop - list.clientHeight;
    const isNearBottom = distanceToBottom < SCROLL_BOTTOM_THRESHOLD_PX;
    shouldStickToBottomRef.current = isNearBottom;
    setShowJumpToBottom(!isNearBottom);
  };

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
        style={{
          transform: !isClosing && dragOffset ? `translateY(${dragOffset}px)` : undefined,
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <TextChatOverlayHeader
          statusState={statusState}
          statusText={statusText}
          closeLabel={t("common.close")}
          receiptLabel={t("textChat.receipt.action")}
          receiptDisabled={isReceiptUploading}
          closeDisabled={setupCloseLocked}
          onReceiptClick={handleReceiptClick}
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

        {setupIsActive ? (
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

        <input
          ref={receiptCameraInputRef}
          type="file"
          accept={RECEIPT_CAMERA_ACCEPT_TYPES}
          capture="environment"
          className="sr-only"
          onChange={(event) => void handleReceiptFile(event.target.files?.[0] ?? null)}
        />
        <input
          ref={receiptFileInputRef}
          type="file"
          accept={RECEIPT_FILE_ACCEPT_TYPES}
          className="sr-only"
          onChange={(event) => void handleReceiptFile(event.target.files?.[0] ?? null)}
        />

        {receiptHint ? (
          <div className="text-chat-overlay__receipt-hint">{receiptHint}</div>
        ) : null}

        {showJumpToBottom ? (
          <button
            type="button"
            className="text-chat-overlay__jump"
            onClick={() => scrollToBottom()}
            aria-label={t("textChat.jumpToBottom")}
          >
            ↓
          </button>
        ) : null}

        <TextChatComposer
          value={value}
          inputRef={inputRef}
          isSending={chat.isSending || isSetupBusy}
          inputDisabled={setupIsActive && setupStage !== 'account'}
          voiceState={voice.state}
          isVoicePressed={isVoicePressed}
          isVoiceCancelledBySwipe={voiceCancelledBySwipeRef.current}
          placeholder={setupStage === 'account' ? t('textChat.setup.accountPlaceholder') : t("textChat.placeholder")}
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
      </div>

      <AuditLogDrawer
        open={chat.isAuditOpen}
        items={chat.auditLogs}
        onClose={chat.closeAudit}
      />
    </div>
  );
}
