import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { pendingActionsApi } from '@/features/pending-actions/api/pendingActions.api';
import { auditLogApi } from '@/features/audit-log/api/auditLog.api';
import { chatApi } from '@/features/chat/api/chat.api';
import { useAccountsStore } from '@/features/accounts/model/accounts.store';
import { useTransactionsStore } from '@/features/transactions/model/transactions.store';
import type { ChatMessage, SendChatMessageOptions, SendChatMessagePayload } from '@/features/chat/model/chat.types';
import { useAuthStore } from '@/features/auth/model/auth.store';
import { appendLocalMessages, emitPendingSync, isClarificationPending, isConfirmationPending, isTransientNetworkError, sleep } from '@/features/chat/model/chatController.utils';
import { useChatStore } from '@/features/chat/model/chat.store';
import { parseNavigationIntent } from '@/features/navigation/lib/parseNavigationIntent';
import { useNavigationStore, type AppScreen } from '@/features/navigation/model/navigation.store';
import { useI18n } from '@/shared/lib/i18n';


function getScreenLabel(screen: AppScreen) {
  const labels: Record<AppScreen, string> = {
    dashboard: 'главную',
    accounts: 'счета',
    analytics: 'аналитику',
    goals: 'цели',
    obligations: 'обязательства',
    'spending-limits': 'лимиты',
    companion: 'компаньона',
    settings: 'настройки',
    store: 'магазин',
    premium: 'Premium',
    'business-accountant': 'Business',
    'receipt-scans': 'чеки',
    sections: 'категории',
    admin: 'админку',
    referral: 'рефералы',
  };

  return labels[screen] ?? 'раздел';
}

export function useChatController() {
  const { t } = useI18n();
  const messages = useChatStore((state) => state.messages) as ChatMessage[];
  const setMessages = useChatStore((state) => state.setMessages) as (value: ChatMessage[] | ((messages: ChatMessage[]) => ChatMessage[])) => void;
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

  const hasAuthToken = useAuthStore((state) => Boolean(state.token));
  const navigateTo = useNavigationStore((state) => state.navigateTo);
  const goBack = useNavigationStore((state) => state.goBack);

  const loadPendingActions = useCallback(async () => {
    if (!hasAuthToken) return;

    try {
      const items = await pendingActionsApi.list();
      setPendingActions(Array.isArray(items) ? items : []);
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

      const navigationIntent = parseNavigationIntent(text);
      if (navigationIntent.type === 'open_screen') {
        navigateTo(navigationIntent.screen);
        setMessages((prev) => appendLocalMessages(prev, {
          id: crypto.randomUUID(),
          role: 'assistant',
          text: t('textChat.nav.openScreen', { screen: getScreenLabel(navigationIntent.screen) }),
          content: t('textChat.nav.openScreen', { screen: getScreenLabel(navigationIntent.screen) }),
          createdAt: new Date().toISOString(),
          kind: 'success',
          actionType: 'navigation',
        }));
        if (requestAbortRef.current === controller) requestAbortRef.current = null;
        setIsSending(false);
        return;
      }

      if (navigationIntent.type === 'go_back') {
        goBack();
        setMessages((prev) => appendLocalMessages(prev, {
          id: crypto.randomUUID(),
          role: 'assistant',
          text: t('textChat.nav.back'),
          content: t('textChat.nav.back'),
          createdAt: new Date().toISOString(),
          kind: 'success',
          actionType: 'navigation',
        }));
        if (requestAbortRef.current === controller) requestAbortRef.current = null;
        setIsSending(false);
        return;
      }

      if (navigationIntent.type === 'open_text_chat') {
        setMessages((prev) => appendLocalMessages(prev, {
          id: crypto.randomUUID(),
          role: 'assistant',
          text: t('textChat.nav.chatOpen'),
          content: t('textChat.nav.chatOpen'),
          createdAt: new Date().toISOString(),
          kind: 'text',
          actionType: 'navigation',
        }));
        if (requestAbortRef.current === controller) requestAbortRef.current = null;
        setIsSending(false);
        return;
      }

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
        const responseData = response.parsed && typeof response.parsed === 'object'
          ? (response.parsed as Record<string, unknown>)
          : undefined;

        if (response.requiresConfirmation && response.meta?.pendingActionId) {
          const previewMessage: ChatMessage = {
            id: crypto.randomUUID(),
            role: 'assistant',
            text: assistantText,
            content: assistantText,
            createdAt: new Date().toISOString(),
            kind: 'preview',
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
          role: 'assistant',
          text: assistantText,
          content: assistantText,
          createdAt: new Date().toISOString(),
          kind: response.executed ? 'success' : 'text',
          actionType: response.intent,
          actionId: response.meta?.auditLogId,
          auditLogId: response.meta?.auditLogId,
          canUndo: Boolean(response.meta?.undo?.available && response.meta?.auditLogId),
          data: responseData,
        };

        setMessages((prev) => appendLocalMessages(prev, assistantMessage));
        await refreshFinanceState();
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
    [goBack, isSending, navigateTo, refreshFinanceState, t],
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

  const clarificationActions = useMemo(() => pendingActions.filter(isClarificationPending), [pendingActions]);
  const confirmationActions = useMemo(() => pendingActions.filter(isConfirmationPending), [pendingActions]);

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
