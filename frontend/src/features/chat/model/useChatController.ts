import { useCallback, useEffect, useMemo } from "react";

import { pendingActionsApi } from "@/features/pending-actions/api/pendingActions.api";
import { auditLogApi } from "@/features/audit-log/api/auditLog.api";
import { chatApi } from "@/features/chat/api/chat.api";
import { useAccountsStore } from "@/features/accounts/model/accounts.store";
import { useTransactionsStore } from "@/features/transactions/model/transactions.store";
import type {
  ChatMessage,
  SendChatMessageOptions,
  SendChatMessagePayload,
} from "@/features/chat/model/chat.types";
import { useAuthStore } from "@/features/auth/model/auth.store";
import {
  appendLocalMessages,
  emitPendingSync,
  isClarificationPending,
  isConfirmationPending,
  isTransientNetworkError,
  sleep,
} from "@/features/chat/model/chatController.utils";
import { useChatStore } from "@/features/chat/model/chat.store";
import { useChatControllerStore } from "@/features/chat/model/chatController.store";
import { parseNavigationIntent } from "@/features/navigation/lib/parseNavigationIntent";
import {
  useNavigationStore,
  type AppScreen,
} from "@/features/navigation/model/navigation.store";
import { useI18n } from "@/shared/lib/i18n";

function getScreenLabel(screen: AppScreen, t: (key: string) => string) {
  const keys: Partial<Record<AppScreen, string>> = {
    dashboard: 'screen.dashboard',
    accounts: 'screen.accounts',
    analytics: 'screen.analytics',
    goals: 'screen.goals',
    obligations: 'screen.obligations',
    'spending-limits': 'screen.limits',
    companion: 'screen.companion',
    settings: 'screen.settings',
    store: 'screen.store',
    premium: 'screen.premium',
    'business-accountant': 'screen.business',
    'receipt-scans': 'screen.receipts',
    sections: 'screen.sections',
    admin: 'screen.admin',
    referral: 'screen.referral',
  };

  return t(keys[screen] ?? 'common.section');
}


let refreshInFlight = false;
let refreshQueued = false;
let requestAbortController: AbortController | null = null;
let requestSeq = 0;
const handlingPendingActionIds = new Set<string>();

function createClientCommandId(payload: SendChatMessagePayload, text: string) {
  if (payload.idempotencyKey?.trim()) return payload.idempotencyKey.trim();
  if (payload.voiceSession?.id) return `voice:${payload.voiceSession.id}:parse`;
  const randomId = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const source = payload.source ?? "text";
  const normalized = text.trim().toLowerCase().replace(/\s+/g, " ").slice(0, 80);
  return `${source}:${randomId}:${normalized.length}`;
}

export function useChatController() {
  const { t } = useI18n();
  const messages = useChatStore((state) => state.messages) as ChatMessage[];
  const setMessages = useChatStore((state) => state.setMessages) as (
    value: ChatMessage[] | ((messages: ChatMessage[]) => ChatMessage[]),
  ) => void;
  const pendingActions = useChatControllerStore((state) => state.pendingActions);
  const setPendingActions = useChatControllerStore((state) => state.setPendingActions);
  const auditLogs = useChatControllerStore((state) => state.auditLogs);
  const setAuditLogs = useChatControllerStore((state) => state.setAuditLogs);
  const isPendingOpen = useChatControllerStore((state) => state.isPendingOpen);
  const setIsPendingOpen = useChatControllerStore((state) => state.setIsPendingOpen);
  const isAuditOpen = useChatControllerStore((state) => state.isAuditOpen);
  const setIsAuditOpen = useChatControllerStore((state) => state.setIsAuditOpen);
  const isSending = useChatControllerStore((state) => state.isSending);
  const setIsSending = useChatControllerStore((state) => state.setIsSending);

  const loadAccounts = useAccountsStore((state) => state.loadAccounts);
  const refreshTransactions = useTransactionsStore((state) => state.refreshAll);

  const hasAuthToken = useAuthStore((state) => Boolean(state.token));
  const navigateTo = useNavigationStore((state) => state.navigateTo);
  const goBack = useNavigationStore((state) => state.goBack);

  const loadPendingActions = useCallback(async () => {
    if (!hasAuthToken) return;

    try {
      const items = await pendingActionsApi.list();
      setPendingActions(Array.isArray(items) ? items : []);
    } catch (error) {
      console.error("Failed to load pending actions", error);
      setPendingActions([]);
    }
  }, [hasAuthToken]);

  const loadAuditLogs = useCallback(async () => {
    if (!hasAuthToken) return;

    try {
      const items = await auditLogApi.list();
      setAuditLogs(Array.isArray(items) ? items : []);
    } catch (error) {
      console.error("Failed to load audit logs", error);
      setAuditLogs([]);
    }
  }, [hasAuthToken]);

  const refreshFinanceState = useCallback(async () => {
    if (refreshInFlight) {
      refreshQueued = true;
      return;
    }

    refreshInFlight = true;

    try {
      do {
        refreshQueued = false;
        await Promise.allSettled([
          loadPendingActions(),
          loadAuditLogs(),
          loadAccounts(true),
          refreshTransactions(),
        ]);
      } while (refreshQueued);
    } finally {
      refreshInFlight = false;
    }
  }, [loadAccounts, loadAuditLogs, loadPendingActions, refreshTransactions]);

  useEffect(() => {
    void refreshFinanceState();
  }, [refreshFinanceState]);

  useEffect(() => {
    const handler = () => {
      void refreshFinanceState();
    };
    window.addEventListener("ai-financer:pending-sync", handler);
    return () =>
      window.removeEventListener("ai-financer:pending-sync", handler);
  }, [refreshFinanceState]);

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

      const navigationIntent = parseNavigationIntent(text);
      if (navigationIntent.type === "open_screen") {
        navigateTo(navigationIntent.screen);
        setMessages((prev) =>
          appendLocalMessages(prev, {
            id: crypto.randomUUID(),
            role: "assistant",
            text: t("textChat.nav.openScreen", {
              screen: getScreenLabel(navigationIntent.screen, t),
            }),
            content: t("textChat.nav.openScreen", {
              screen: getScreenLabel(navigationIntent.screen, t),
            }),
            createdAt: new Date().toISOString(),
            kind: "success",
            actionType: "navigation",
          }),
        );
        if (requestAbortController === controller)
          requestAbortController = null;
        setIsSending(false);
        return;
      }

      if (navigationIntent.type === "go_back") {
        goBack();
        setMessages((prev) =>
          appendLocalMessages(prev, {
            id: crypto.randomUUID(),
            role: "assistant",
            text: t("textChat.nav.back"),
            content: t("textChat.nav.back"),
            createdAt: new Date().toISOString(),
            kind: "success",
            actionType: "navigation",
          }),
        );
        if (requestAbortController === controller)
          requestAbortController = null;
        setIsSending(false);
        return;
      }

      if (navigationIntent.type === "open_text_chat") {
        setMessages((prev) =>
          appendLocalMessages(prev, {
            id: crypto.randomUUID(),
            role: "assistant",
            text: t("textChat.nav.chatOpen"),
            content: t("textChat.nav.chatOpen"),
            createdAt: new Date().toISOString(),
            kind: "text",
            actionType: "navigation",
          }),
        );
        if (requestAbortController === controller)
          requestAbortController = null;
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

        if (requestSeq !== currentRequestSeq || controller.signal.aborted)
          return;

        const assistantText = response.message || t("textChat.result.done");
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
        if (requestAbortController === controller)
          requestAbortController = null;
        if (requestSeq === currentRequestSeq) setIsSending(false);
      }
    },
    [goBack, isSending, navigateTo, refreshFinanceState, t],
  );

  const confirmAction = useCallback(
    async (actionId: string) => {
      if (!actionId || handlingPendingActionIds.has(actionId))
        return;
      handlingPendingActionIds.add(actionId);

      setPendingActions((prev) => prev.filter((item) => item.id !== actionId));

      try {
        const response: any = await pendingActionsApi.confirm(actionId);
        const assistantText = response?.message || t("textChat.result.actionDone");

        setMessages((prev) =>
          appendLocalMessages(prev, {
            id: crypto.randomUUID(),
            role: "assistant",
            text: assistantText,
            content: assistantText,
            createdAt: new Date().toISOString(),
            kind: response?.success === false ? "error" : "success",
            actionType: response?.intent,
            actionId: response?.meta?.auditLogId,
            data:
              response?.data && typeof response.data === "object"
                ? response.data
                : undefined,
          }),
        );
      } catch (error) {
        console.error("Confirm action failed", error);

        setMessages((prev) =>
          appendLocalMessages(prev, {
            id: crypto.randomUUID(),
            role: "assistant",
            text: t("textChat.error.confirm"),
            content: t("textChat.error.confirm"),
            createdAt: new Date().toISOString(),
            kind: "error",
          }),
        );
      } finally {
        setIsPendingOpen(false);
        await refreshFinanceState();
        emitPendingSync();
      }
    },
    [refreshFinanceState, t],
  );

  const cancelAction = useCallback(
    async (actionId: string) => {
      if (!actionId || handlingPendingActionIds.has(actionId))
        return;
      handlingPendingActionIds.add(actionId);

      setPendingActions((prev) => prev.filter((item) => item.id !== actionId));

      try {
        const response: any = await pendingActionsApi.cancel(actionId);
        const assistantText = response?.message || t("textChat.result.actionCancelled");

        setMessages((prev) =>
          appendLocalMessages(prev, {
            id: crypto.randomUUID(),
            role: "assistant",
            text: assistantText,
            content: assistantText,
            createdAt: new Date().toISOString(),
            kind: "text",
            actionType: response?.intent,
            actionId: response?.meta?.auditLogId,
          }),
        );
      } catch (error) {
        console.error("Cancel action failed", error);
      } finally {
        setIsPendingOpen(false);
        await refreshFinanceState();
        emitPendingSync();
      }
    },
    [refreshFinanceState, t],
  );

  const undoMessageAction = useCallback(
    async (auditLogId: string) => {
      if (!auditLogId) return;

      try {
        const response = await chatApi.undoByAuditLog(auditLogId);
        const assistantText = response?.message || t("textChat.result.undoDone");

        setMessages((prev) =>
          appendLocalMessages(
            prev.map((message) =>
              message.auditLogId === auditLogId
                ? { ...message, canUndo: false }
                : message,
            ),
            {
              id: crypto.randomUUID(),
              role: "assistant",
              text: assistantText,
              content: assistantText,
              createdAt: new Date().toISOString(),
              kind: "text",
            },
          ),
        );
      } catch (error) {
        console.error("Undo failed", error);

        setMessages((prev) =>
          appendLocalMessages(prev, {
            id: crypto.randomUUID(),
            role: "assistant",
            text: t("textChat.error.undo"),
            content: t("textChat.error.undo"),
            createdAt: new Date().toISOString(),
            kind: "error",
          }),
        );
      } finally {
        await refreshFinanceState();
      }
    },
    [refreshFinanceState, t],
  );

  const updatePendingAction = useCallback(
    async (actionId: string, parsed: Record<string, unknown>) => {
      if (!actionId) return;
      await pendingActionsApi.update(actionId, parsed);
      await refreshFinanceState();
    },
    [refreshFinanceState],
  );

  const openPending = useCallback(() => {
    setIsPendingOpen(true);
    emitPendingSync();
  }, []);
  const closePending = useCallback(() => setIsPendingOpen(false), []);
  const openAudit = useCallback(() => setIsAuditOpen(true), []);
  const closeAudit = useCallback(() => setIsAuditOpen(false), []);

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
