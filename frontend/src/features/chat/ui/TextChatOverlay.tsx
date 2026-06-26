import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent,
} from "react";

import { useAccountsStore } from "@/features/accounts/model/accounts.store";
import { AuditLogDrawer } from "@/features/audit-log/ui/AuditLogDrawer";
import { useChatController } from "@/features/chat/model/useChatController";
import { useChatStore } from "@/features/chat/model/chat.store";
import { useSettingsStore } from "@/features/settings/model/settings.store";
import { useReceiptScansStore } from "@/features/receipt-scans/model/receiptScans.store";
import { getReceiptUploadIssueKey } from "@/features/receipt-scans/lib/receiptUploadGuards";
import { useSubscriptionStore } from "@/features/subscription/model/subscription.store";
import { useTransactionsStore } from "@/features/transactions/model/transactions.store";
import { useVoiceInput } from "@/features/voice/model/useVoiceInput";
import { VOICE_MANUAL_SESSION_MS } from "@/features/voice/model/voiceConstants";
import { shouldIgnoreVoiceCommand } from "@/features/voice/model/voiceText";
import { useI18n } from "@/shared/lib/i18n";
import {
  OVERLAY_DISMISS_DRAG_PX,
  SCROLL_BOTTOM_THRESHOLD_PX,
} from "@/features/chat/ui/text-chat-overlay/constants";
import {
  pickRotatingStatus,
  stripOptionalCompanionName,
} from "@/features/chat/ui/text-chat-overlay/helpers";
import { useTextChatContextualPrompts } from "@/features/chat/ui/text-chat-overlay/useTextChatContextualPrompts";
import { TextChatOverlayHeader } from "@/features/chat/ui/text-chat-overlay/TextChatOverlayHeader";
import { TextChatMessages } from "@/features/chat/ui/text-chat-overlay/TextChatMessages";
import { TextChatEmptyState } from "@/features/chat/ui/text-chat-overlay/TextChatEmptyState";
import { TextChatComposer } from "@/features/chat/ui/text-chat-overlay/TextChatComposer";

type TextChatOverlayProps = {
  open: boolean;
  initialCommand?: string | null;
  initialAssistantMessage?: string | null;
  mode?: "text" | "voice";
  autoStartVoice?: boolean;
  autoCloseOnVoiceResult?: boolean;
  autoSubmitInitialCommand?: boolean;
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

  const chat = useChatController();
  const appendChatMessage = useChatStore((state) => state.appendMessage);
  const accounts = useAccountsStore((state) => state.items);
  const transactions = useTransactionsStore((state) => state.items);
  const subscription = useSubscriptionStore((state) => state.status);
  const loadSubscription = useSubscriptionStore((state) => state.load);
  const uploadReceipt = useReceiptScansStore((state) => state.upload);
  const isReceiptUploading = useReceiptScansStore((state) => state.isUploading);
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
    return voiceHint || pickRotatingStatus(t, "ready", seed);
  }, [
    chat.isSending,
    chat.messages.length,
    hasBlockingConfirmation,
    inlinePendingActions.length,
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
          : "ready";

  const contextualPrompts = useTextChatContextualPrompts(accounts, transactions);

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
    [stopVoiceAndSend],
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
    onClose();
  }, [onClose, voice]);

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
    if (dragOffset >= OVERLAY_DISMISS_DRAG_PX) closeOverlay();
    dragStartYRef.current = null;
    setDragOffset(0);
  }, [closeOverlay, dragOffset]);

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

    setVoiceHint(t('textChat.voice.startFailed'));
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
    if (!text || chat.isSending) return;
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
      className={`text-chat-overlay${isClosing ? ' text-chat-overlay--closing' : ''}`}
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
          receiptCameraInputRef={receiptCameraInputRef}
          receiptFileInputRef={receiptFileInputRef}
          hasReceiptAccess={hasReceiptAccess}
          isReceiptUploading={isReceiptUploading}
          isSending={chat.isSending}
          voiceState={voice.state}
          isVoicePressed={isVoicePressed}
          isVoiceCancelledBySwipe={voiceCancelledBySwipeRef.current}
          placeholder={t("textChat.placeholder")}
          sendLabel={t("textChat.send")}
          voiceLabel={t("textChat.voice.hold")}
          receiptActionLabel={t("textChat.receipt.action")}
          receiptCameraLabel={t("textChat.receipt.camera")}
          voiceCancelHint={t("textChat.voice.swipeCancel")}
          voiceCancelledLabel={t("textChat.voice.cancelled")}
          onValueChange={setValue}
          onSubmit={submit}
          onReceiptFile={handleReceiptFile}
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
