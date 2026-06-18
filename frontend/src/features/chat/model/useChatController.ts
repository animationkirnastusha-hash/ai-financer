import { useCallback, useMemo } from "react";

import { chatApi } from "@/features/chat/api/chat.api";
import { createClientCommandId } from "@/features/chat/model/chatController.command";
import { handleChatNavigationIntent } from "@/features/chat/model/chatController.navigation";
import {
  appendLocalMessages,
  emitPendingSync,
  isClarificationPending,
  isConfirmationPending,
  isTransientNetworkError,
  sleep,
} from "@/features/chat/model/chatController.utils";
import type {
  ChatMessage,
  SendChatMessageOptions,
  SendChatMessagePayload,
} from "@/features/chat/model/chat.types";
import { useChatStore } from "@/features/chat/model/chat.store";
import { useChatControllerSync } from "@/features/chat/model/useChatControllerSync";
import { useChatPendingActionHandlers } from "@/features/chat/model/useChatPendingActionHandlers";
import { useNavigationStore } from "@/features/navigation/model/navigation.store";
import { useI18n } from "@/shared/lib/i18n";

let requestAbortController: AbortController | null = null;
let requestSeq = 0;

function hasCyrillic(value: unknown) {
  return typeof value === "string" && /[А-Яа-яЁё]/.test(value);
}

function resolveAssistantText(response: any, t: (key: string) => string, language: "ru" | "en") {
  const raw = typeof response?.message === "string" ? response.message.trim() : "";

  if (response?.executed) return t("textChat.result.actionDone");
  if (response?.intent === "clarification" && language === "en" && hasCyrillic(raw)) {
    const field = response?.meta?.clarification?.field || response?.parsed?.clarification?.field;
    if (field === "amount") return t("textChat.clarification.amount");
    if (field === "account" || field === "accountSetup") return t("textChat.clarification.account");
    return t("textChat.clarification.generic");
  }

  return raw || t("textChat.result.done");
}

export function useChatController() {
  const { language, t } = useI18n();
  const messages = useChatStore((state) => state.messages) as ChatMessage[];
  const setMessages = useChatStore((state) => state.setMessages) as (
    value: ChatMessage[] | ((messages: ChatMessage[]) => ChatMessage[]),
  ) => void;

  const navigateTo = useNavigationStore((state) => state.navigateTo);
  const goBack = useNavigationStore((state) => state.goBack);

  const {
    pendingActions,
    auditLogs,
    isPendingOpen,
    isAuditOpen,
    isSending,
    setIsSending,
    refreshFinanceState,
    openPending,
    closePending,
    openAudit,
    closeAudit,
  } = useChatControllerSync();

  const {
    confirmAction,
    cancelAction,
    undoMessageAction,
    updatePendingAction,
  } = useChatPendingActionHandlers({ refreshFinanceState, setMessages, t });

  const sendMessage = useCallback(
    async (
      input: string | SendChatMessagePayload,
      options: SendChatMessageOptions = {},
    ) => {
      const payload: SendChatMessagePayload =
        typeof input === "string" ? { text: input, source: "text" } : input;
      const text = payload.text.trim();
      if (!text) return;

      if (isSending && !options.supersedeInFlight) return;
      if (options.supersedeInFlight && requestAbortController) {
        requestAbortController.abort();
      }

      const currentRequestSeq = requestSeq + 1;
      requestSeq = currentRequestSeq;
      const controller = new AbortController();
      requestAbortController = controller;
      setIsSending(true);

      const userMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        text,
        content: text,
        createdAt: new Date().toISOString(),
        kind: "text",
      };

      setMessages((prev) => appendLocalMessages(prev, userMessage));

      const navigationHandled = handleChatNavigationIntent({
        text,
        t,
        setMessages,
        navigateTo,
        goBack,
      });

      if (navigationHandled) {
        if (requestAbortController === controller) requestAbortController = null;
        setIsSending(false);
        return;
      }

      const commandId = createClientCommandId(payload, text);
      const outboundPayload: SendChatMessagePayload = {
        ...payload,
        text,
        idempotencyKey: commandId,
      };

      try {
        let response;
        try {
          response = await chatApi.sendMessage(
            outboundPayload,
            controller.signal,
          );
        } catch (error) {
          if (controller.signal.aborted) return;
          if (!isTransientNetworkError(error)) throw error;
          await sleep(navigator.onLine ? 1400 : 2400);
          if (controller.signal.aborted) return;
          response = await chatApi.sendMessage(
            outboundPayload,
            controller.signal,
          );
        }

        if (requestSeq !== currentRequestSeq || controller.signal.aborted) return;

        const assistantText = resolveAssistantText(response, t, language);
        const responseData =
          response.parsed && typeof response.parsed === "object"
            ? (response.parsed as Record<string, unknown>)
            : undefined;

        if (response.requiresConfirmation && response.meta?.pendingActionId) {
          const previewMessage: ChatMessage = {
            id: crypto.randomUUID(),
            role: "assistant",
            text: assistantText,
            content: assistantText,
            createdAt: new Date().toISOString(),
            kind: "preview",
            actionType: response.intent,
            actionId: response.meta.pendingActionId,
            auditLogId: response.meta?.auditLogId,
            data: responseData,
          };

          setMessages((prev) => appendLocalMessages(prev, previewMessage));
          await refreshFinanceState();
          emitPendingSync();
          return;
        }

        const assistantMessage: ChatMessage = {
          id: crypto.randomUUID(),
          role: "assistant",
          text: assistantText,
          content: assistantText,
          createdAt: new Date().toISOString(),
          kind: response.executed ? "success" : "text",
          actionType: response.intent,
          actionId: response.meta?.auditLogId,
          auditLogId: response.meta?.auditLogId,
          canUndo: Boolean(
            response.meta?.undo?.available && response.meta?.auditLogId,
          ),
          data: responseData,
        };

        setMessages((prev) => appendLocalMessages(prev, assistantMessage));
        await refreshFinanceState();
      } catch (error) {
        if (controller.signal.aborted) return;
        console.error("Send message failed", error);

        setMessages((prev) =>
          appendLocalMessages(prev, {
            id: crypto.randomUUID(),
            role: "assistant",
            text: t("textChat.error.network"),
            content: t("textChat.error.network"),
            createdAt: new Date().toISOString(),
            kind: "error",
          }),
        );
      } finally {
        if (requestAbortController === controller) requestAbortController = null;
        if (requestSeq === currentRequestSeq) setIsSending(false);
      }
    },
    [goBack, isSending, language, navigateTo, refreshFinanceState, setIsSending, setMessages, t],
  );

  const clarificationActions = useMemo(
    () => pendingActions.filter(isClarificationPending),
    [pendingActions],
  );
  const confirmationActions = useMemo(
    () => pendingActions.filter(isConfirmationPending),
    [pendingActions],
  );

  return {
    messages,
    pendingActions,
    clarificationActions,
    confirmationActions,
    auditLogs,
    isPendingOpen,
    isAuditOpen,
    isSending,

    sendMessage,
    confirmAction,
    cancelAction,
    undoMessageAction,
    updatePendingAction,

    openPending,
    closePending,
    openAudit,
    closeAudit,
  };
}
