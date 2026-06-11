import { useCallback, useEffect } from "react";

import { useAccountsStore } from "@/features/accounts/model/accounts.store";
import { auditLogApi } from "@/features/audit-log/api/auditLog.api";
import { useAuthStore } from "@/features/auth/model/auth.store";
import { useChatControllerStore } from "@/features/chat/model/chatController.store";
import { emitPendingSync } from "@/features/chat/model/chatController.utils";
import { pendingActionsApi } from "@/features/pending-actions/api/pendingActions.api";
import { useTransactionsStore } from "@/features/transactions/model/transactions.store";

let refreshInFlight = false;
let refreshQueued = false;

export function useChatControllerSync() {
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
    return () => window.removeEventListener("ai-financer:pending-sync", handler);
  }, [refreshFinanceState]);

  const openPending = useCallback(() => {
    setIsPendingOpen(true);
    emitPendingSync();
  }, []);

  const closePending = useCallback(() => setIsPendingOpen(false), []);
  const openAudit = useCallback(() => setIsAuditOpen(true), []);
  const closeAudit = useCallback(() => setIsAuditOpen(false), []);

  return {
    pendingActions,
    setPendingActions,
    auditLogs,
    isPendingOpen,
    setIsPendingOpen,
    isAuditOpen,
    isSending,
    setIsSending,
    refreshFinanceState,
    openPending,
    closePending,
    openAudit,
    closeAudit,
  };
}
