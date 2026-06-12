import { useCallback } from "react";

import { chatApi } from "@/features/chat/api/chat.api";
import type { ChatMessage } from "@/features/chat/model/chat.types";
import { useChatControllerStore } from "@/features/chat/model/chatController.store";
import { appendLocalMessages, emitPendingSync } from "@/features/chat/model/chatController.utils";
import { pendingActionsApi } from "@/features/pending-actions/api/pendingActions.api";

type TranslateFn = (key: string, params?: Record<string, string | number>) => string;
type SetMessagesFn = (value: ChatMessage[] | ((messages: ChatMessage[]) => ChatMessage[])) => void;

const handlingPendingActionIds = new Set<string>();

export function useChatPendingActionHandlers({
  refreshFinanceState,
  setMessages,
  t,
}: {
  refreshFinanceState: () => Promise<void>;
  setMessages: SetMessagesFn;
  t: TranslateFn;
}) {
  const setPendingActions = useChatControllerStore((state) => state.setPendingActions);
  const setIsPendingOpen = useChatControllerStore((state) => state.setIsPendingOpen);

  const confirmAction = useCallback(
    async (actionId: string) => {
      if (!actionId || handlingPendingActionIds.has(actionId)) return;
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
        handlingPendingActionIds.delete(actionId);
        setIsPendingOpen(false);
        await refreshFinanceState();
        emitPendingSync();
      }
    },
    [refreshFinanceState, setMessages, t],
  );

  const cancelAction = useCallback(
    async (actionId: string) => {
      if (!actionId || handlingPendingActionIds.has(actionId)) return;
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
        handlingPendingActionIds.delete(actionId);
        setIsPendingOpen(false);
        await refreshFinanceState();
        emitPendingSync();
      }
    },
    [refreshFinanceState, setMessages, t],
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
    [refreshFinanceState, setMessages, t],
  );

  const updatePendingAction = useCallback(
    async (actionId: string, parsed: Record<string, unknown>) => {
      if (!actionId) return;
      await pendingActionsApi.update(actionId, parsed);
      await refreshFinanceState();
    },
    [refreshFinanceState],
  );

  return {
    confirmAction,
    cancelAction,
    undoMessageAction,
    updatePendingAction,
  };
}
