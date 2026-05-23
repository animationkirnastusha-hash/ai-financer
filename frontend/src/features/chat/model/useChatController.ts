import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { pendingActionsApi } from "@/features/pending-actions/api/pendingActions.api";
import { auditLogApi } from "@/features/audit-log/api/auditLog.api";
import { chatApi } from "@/features/chat/api/chat.api";
import { useAccountsStore } from "@/features/accounts/model/accounts.store";
import { useTransactionsStore } from "@/features/transactions/model/transactions.store";
import type { ChatMessage } from "@/features/chat/model/chat.types";

const MAX_LOCAL_CHAT_MESSAGES = 50;

function appendCappedMessage(prev: ChatMessage[], message: ChatMessage) {
  return [...prev.slice(-(MAX_LOCAL_CHAT_MESSAGES - 1)), message];
}

export function useChatController() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [pendingActions, setPendingActions] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [isPendingOpen, setIsPendingOpen] = useState(false);
  const [isAuditOpen, setIsAuditOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const refreshInFlightRef = useRef<Promise<void> | null>(null);

  const loadAccounts = useAccountsStore((state) => state.loadAccounts);
  const refreshTransactions = useTransactionsStore((state) => state.refreshAll);

  const hasAuthToken = useMemo(() => {
    return !!localStorage.getItem("auth-token");
  }, []);

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
    if (refreshInFlightRef.current) {
      await refreshInFlightRef.current;
      return;
    }

    const task = Promise.allSettled([
      loadPendingActions(),
      loadAuditLogs(),
      loadAccounts(true),
      refreshTransactions(),
    ]).then(() => undefined);

    refreshInFlightRef.current = task;

    try {
      await task;
    } finally {
      if (refreshInFlightRef.current === task) {
        refreshInFlightRef.current = null;
      }
    }
  }, [loadAccounts, loadAuditLogs, loadPendingActions, refreshTransactions]);

  useEffect(() => {
    void refreshFinanceState();
  }, [refreshFinanceState]);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isSending) return;

      setIsSending(true);

      const userMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        text,
        content: text,
        createdAt: new Date().toISOString(),
        kind: "text",
      };

      setMessages((prev) => appendCappedMessage(prev, userMessage));

      try {
        const response = await chatApi.sendMessage({ text });

        const assistantText = response.message || "Готово";

        const assistantMessage: ChatMessage = {
          id: crypto.randomUUID(),
          role: "assistant",
          text: assistantText,
          content: assistantText,
          createdAt: new Date().toISOString(),
          kind: response.requiresConfirmation ? "preview" : "text",
          actionType: response.intent,
          actionId: response.meta?.pendingActionId || response.meta?.auditLogId,
          auditLogId: response.meta?.auditLogId,
          canUndo: Boolean(
            response.meta?.undo?.available && response.meta?.auditLogId,
          ),
          data:
            response.parsed && typeof response.parsed === "object"
              ? (response.parsed as Record<string, unknown>)
              : undefined,
        };

        setMessages((prev) => appendCappedMessage(prev, assistantMessage));

        await refreshFinanceState();
      } catch (error) {
        console.error("Send message failed", error);

        const errorText = "Не удалось обработать запрос.";

        const assistantError: ChatMessage = {
          id: crypto.randomUUID(),
          role: "assistant",
          text: errorText,
          content: errorText,
          createdAt: new Date().toISOString(),
          kind: "error",
        };

        setMessages((prev) => appendCappedMessage(prev, assistantError));
      } finally {
        setIsSending(false);
      }
    },
    [isSending, refreshFinanceState],
  );

  const confirmAction = useCallback(
    async (actionId: string) => {
      if (!actionId) return;

      setPendingActions((prev) => prev.filter((item) => item.id !== actionId));

      try {
        const response: any = await pendingActionsApi.confirm(actionId);

        const assistantText = response?.message || "✅ Действие подтверждено.";

        setMessages((prev) =>
          appendCappedMessage(prev, {
            id: crypto.randomUUID(),
            role: "assistant",
            text: assistantText,
            content: assistantText,
            createdAt: new Date().toISOString(),
            kind: "text",
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
          appendCappedMessage(prev, {
            id: crypto.randomUUID(),
            role: "assistant",
            text: "Не удалось подтвердить действие. Возможно, оно уже выполнено, отменено или истекло.",
            content:
              "Не удалось подтвердить действие. Возможно, оно уже выполнено, отменено или истекло.",
            createdAt: new Date().toISOString(),
            kind: "error",
          }),
        );
      } finally {
        await refreshFinanceState();
      }
    },
    [refreshFinanceState],
  );

  const cancelAction = useCallback(
    async (actionId: string) => {
      if (!actionId) return;

      setPendingActions((prev) => prev.filter((item) => item.id !== actionId));

      try {
        const response: any = await pendingActionsApi.cancel(actionId);

        const assistantText = response?.message || "Действие отменено.";

        setMessages((prev) =>
          appendCappedMessage(prev, {
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
        await refreshFinanceState();
      }
    },
    [refreshFinanceState],
  );

  const undoMessageAction = useCallback(
    async (auditLogId: string) => {
      if (!auditLogId) return;

      try {
        const response = await chatApi.undoByAuditLog(auditLogId);
        const assistantText = response?.message || "↩️ Операция отменена.";

        setMessages((prev) =>
          appendCappedMessage(
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
          appendCappedMessage(prev, {
            id: crypto.randomUUID(),
            role: "assistant",
            text: "Не удалось отменить операцию. Возможно, она уже отменена или изменена.",
            content:
              "Не удалось отменить операцию. Возможно, она уже отменена или изменена.",
            createdAt: new Date().toISOString(),
            kind: "error",
          }),
        );
      } finally {
        await refreshFinanceState();
      }
    },
    [refreshFinanceState],
  );

  const updatePendingAction = useCallback(
    async (actionId: string, parsed: Record<string, unknown>) => {
      if (!actionId) return;
      await pendingActionsApi.update(actionId, parsed);
      await refreshFinanceState();
    },
    [refreshFinanceState],
  );

  const openPending = useCallback(() => setIsPendingOpen(true), []);
  const closePending = useCallback(() => setIsPendingOpen(false), []);
  const openAudit = useCallback(() => setIsAuditOpen(true), []);
  const closeAudit = useCallback(() => setIsAuditOpen(false), []);

  return {
    messages,
    pendingActions,
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
