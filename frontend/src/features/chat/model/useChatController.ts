import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { pendingActionsApi } from '@/features/pending-actions/api/pendingActions.api';
import { auditLogApi } from '@/features/audit-log/api/auditLog.api';
import { chatApi } from '@/features/chat/api/chat.api';
import { useAccountsStore } from '@/features/accounts/model/accounts.store';
import { useTransactionsStore } from '@/features/transactions/model/transactions.store';
import type { ChatMessage, SendChatMessageOptions, SendChatMessagePayload } from '@/features/chat/model/chat.types';

const MAX_LOCAL_MESSAGES = 50;


function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isClarificationPending(item: any) {
  const parsed = isRecord(item?.parsed) ? item.parsed : isRecord(item?.payload) ? item.payload : null;
  return Boolean(parsed && isRecord(parsed.clarification));
}

function isConfirmationPending(item: any) {
  if (!item || item.status && item.status !== 'pending') return false;
  return !isClarificationPending(item);
}

function appendLocalMessages(prev: ChatMessage[], next: ChatMessage | ChatMessage[]) {
  const additions = Array.isArray(next) ? next : [next];
  return [...prev, ...additions].slice(-MAX_LOCAL_MESSAGES);
}

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function isTransientNetworkError(error: unknown) {
  if (!navigator.onLine) return true;
  if (error instanceof TypeError) return true;
  const status = typeof error === 'object' && error !== null && 'status' in error ? Number((error as { status?: unknown }).status) : 0;
  return status === 408 || status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
}

function emitPendingSync() {
  window.dispatchEvent(new CustomEvent('ai-financer:pending-sync'));
}

export function useChatController() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [pendingActions, setPendingActions] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [isPendingOpen, setIsPendingOpen] = useState(false);
  const [isAuditOpen, setIsAuditOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const refreshInFlightRef = useRef(false);
  const refreshQueuedRef = useRef(false);
  const requestAbortRef = useRef<AbortController | null>(null);
  const requestSeqRef = useRef(0);

  const loadAccounts = useAccountsStore((state) => state.loadAccounts);
  const refreshTransactions = useTransactionsStore((state) => state.refreshAll);

  const hasAuthToken = useMemo(() => {
    return !!localStorage.getItem('auth-token');
  }, []);

  const loadPendingActions = useCallback(async () => {
    if (!hasAuthToken) return;

    try {
      const items = await pendingActionsApi.list();
      setPendingActions(Array.isArray(items) ? items.filter(isConfirmationPending) : []);
    } catch (error) {
      console.error('Failed to load pending actions', error);
      setPendingActions([]);
    }
  }, [hasAuthToken]);

  const loadAuditLogs = useCallback(async () => {
    if (!hasAuthToken) return;

    try {
      const items = await auditLogApi.list();
      setAuditLogs(Array.isArray(items) ? items : []);
    } catch (error) {
      console.error('Failed to load audit logs', error);
      setAuditLogs([]);
    }
  }, [hasAuthToken]);

  const refreshFinanceState = useCallback(async () => {
    if (refreshInFlightRef.current) {
      refreshQueuedRef.current = true;
      return;
    }

    refreshInFlightRef.current = true;

    try {
      do {
        refreshQueuedRef.current = false;
        await Promise.allSettled([
          loadPendingActions(),
          loadAuditLogs(),
          loadAccounts(true),
          refreshTransactions(),
        ]);
      } while (refreshQueuedRef.current);
    } finally {
      refreshInFlightRef.current = false;
    }
  }, [loadAccounts, loadAuditLogs, loadPendingActions, refreshTransactions]);

  useEffect(() => {
    void refreshFinanceState();
  }, [refreshFinanceState]);

  useEffect(() => {
    const handler = () => {
      void refreshFinanceState();
    };
    window.addEventListener('ai-financer:pending-sync', handler);
    return () => window.removeEventListener('ai-financer:pending-sync', handler);
  }, [refreshFinanceState]);

  const sendMessage = useCallback(
    async (input: string | SendChatMessagePayload, options: SendChatMessageOptions = {}) => {
      const payload: SendChatMessagePayload = typeof input === 'string' ? { text: input, source: 'text' } : input;
      const text = payload.text.trim();
      if (!text) return;

      if (isSending && !options.supersedeInFlight) return;
      if (options.supersedeInFlight && requestAbortRef.current) {
        requestAbortRef.current.abort();
      }

      const requestSeq = requestSeqRef.current + 1;
      requestSeqRef.current = requestSeq;
      const controller = new AbortController();
      requestAbortRef.current = controller;
      setIsSending(true);

      const userMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        text,
        content: text,
        createdAt: new Date().toISOString(),
        kind: 'text',
      };

      setMessages((prev) => appendLocalMessages(prev, userMessage));

      try {
        let response;
        try {
          response = await chatApi.sendMessage({ ...payload, text }, controller.signal);
        } catch (error) {
          if (controller.signal.aborted) return;
          if (!isTransientNetworkError(error)) throw error;
          await sleep(navigator.onLine ? 1400 : 2400);
          if (controller.signal.aborted) return;
          response = await chatApi.sendMessage({ ...payload, text }, controller.signal);
        }

        if (requestSeqRef.current !== requestSeq || controller.signal.aborted) return;

        const assistantText = response.message || 'Готово';

        const assistantMessage: ChatMessage = {
          id: crypto.randomUUID(),
          role: 'assistant',
          text: assistantText,
          content: assistantText,
          createdAt: new Date().toISOString(),
          kind: 'text',
          actionType: response.intent,
          actionId: response.meta?.pendingActionId || response.meta?.auditLogId,
          auditLogId: response.meta?.auditLogId,
          canUndo: Boolean(response.meta?.undo?.available && response.meta?.auditLogId),
          data:
            response.parsed && typeof response.parsed === 'object'
              ? (response.parsed as Record<string, unknown>)
              : undefined,
        };

        setMessages((prev) => appendLocalMessages(prev, assistantMessage));
        await refreshFinanceState();
        if (response.requiresConfirmation && response.meta?.pendingActionId) {
          setIsPendingOpen(true);
          emitPendingSync();
        }
      } catch (error) {
        if (controller.signal.aborted) return;
        console.error('Send message failed', error);

        setMessages((prev) => appendLocalMessages(prev, {
          id: crypto.randomUUID(),
          role: 'assistant',
          text: 'Связь нестабильна. Команда не выполнена, повтори позже или отправь текстом ещё раз.',
          content: 'Связь нестабильна. Команда не выполнена, повтори позже или отправь текстом ещё раз.',
          createdAt: new Date().toISOString(),
          kind: 'error',
        }));
      } finally {
        if (requestAbortRef.current === controller) requestAbortRef.current = null;
        if (requestSeqRef.current === requestSeq) setIsSending(false);
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
        const assistantText = response?.message || '✅ Действие подтверждено.';

        setMessages((prev) => appendLocalMessages(prev, {
          id: crypto.randomUUID(),
          role: 'assistant',
          text: assistantText,
          content: assistantText,
          createdAt: new Date().toISOString(),
          kind: 'text',
          actionType: response?.intent,
          actionId: response?.meta?.auditLogId,
          data: response?.data && typeof response.data === 'object' ? response.data : undefined,
        }));
      } catch (error) {
        console.error('Confirm action failed', error);

        setMessages((prev) => appendLocalMessages(prev, {
          id: crypto.randomUUID(),
          role: 'assistant',
          text: 'Не удалось подтвердить действие. Возможно, оно уже выполнено, отменено или истекло.',
          content: 'Не удалось подтвердить действие. Возможно, оно уже выполнено, отменено или истекло.',
          createdAt: new Date().toISOString(),
          kind: 'error',
        }));
      } finally {
        setIsPendingOpen(false);
        await refreshFinanceState();
        emitPendingSync();
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
        const assistantText = response?.message || 'Действие отменено.';

        setMessages((prev) => appendLocalMessages(prev, {
          id: crypto.randomUUID(),
          role: 'assistant',
          text: assistantText,
          content: assistantText,
          createdAt: new Date().toISOString(),
          kind: 'text',
          actionType: response?.intent,
          actionId: response?.meta?.auditLogId,
        }));
      } catch (error) {
        console.error('Cancel action failed', error);
      } finally {
        setIsPendingOpen(false);
        await refreshFinanceState();
        emitPendingSync();
      }
    },
    [refreshFinanceState],
  );

  const undoMessageAction = useCallback(
    async (auditLogId: string) => {
      if (!auditLogId) return;

      try {
        const response = await chatApi.undoByAuditLog(auditLogId);
        const assistantText = response?.message || '↩️ Операция отменена.';

        setMessages((prev) => appendLocalMessages(
          prev.map((message) =>
            message.auditLogId === auditLogId
              ? { ...message, canUndo: false }
              : message,
          ),
          {
            id: crypto.randomUUID(),
            role: 'assistant',
            text: assistantText,
            content: assistantText,
            createdAt: new Date().toISOString(),
            kind: 'text',
          },
        ));
      } catch (error) {
        console.error('Undo failed', error);

        setMessages((prev) => appendLocalMessages(prev, {
          id: crypto.randomUUID(),
          role: 'assistant',
          text: 'Не удалось отменить операцию. Возможно, она уже отменена или изменена.',
          content: 'Не удалось отменить операцию. Возможно, она уже отменена или изменена.',
          createdAt: new Date().toISOString(),
          kind: 'error',
        }));
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

  const openPending = useCallback(() => {
    setIsPendingOpen(true);
    emitPendingSync();
  }, []);
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
