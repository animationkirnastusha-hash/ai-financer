import { useEffect, useState } from 'react';

import { AuditLogDrawer } from '@/features/audit-log/ui/AuditLogDrawer';
import { AIStatusBar } from '@/features/chat/ui/AIStatusBar';
import { ChatHeader } from '@/features/chat/ui/ChatHeader';
import { Composer } from '@/features/chat/ui/Composer';
import { MessageList } from '@/features/chat/ui/MessageList';
import { useChatController } from '@/features/chat/model/useChatController';
import { InsightsStrip } from '@/features/insights/ui/InsightsStrip';
import { PendingActionsDrawer } from '@/features/pending-actions/ui/PendingActionsDrawer';
import type { TransactionDto } from '@/features/transactions/api/transactions.api';
import { useTransactionsStore } from '@/features/transactions/model/transactions.store';
import { EditTransactionModal } from '@/features/transactions/ui/EditTransactionModal';
import { LastTransactionCard } from '@/features/transactions/ui/LastTransactionCard';
import { MonthlyStatsCard } from '@/features/transactions/ui/MonthlyStatsCard';
import { TransactionsHistoryDrawer } from '@/features/transactions/ui/TransactionsHistoryDrawer';
import { formatTime } from '@/shared/lib/format';

export function ChatScreen() {
  const {
    messages,
    isSending,
    sendMessage,
    confirmAction,
    cancelAction,
    undoMessageAction,
    updatePendingAction,
    pendingActions,
    auditLogs,
    isPendingOpen,
    isAuditOpen,
    openPending,
    closePending,
    openAudit,
    closeAudit,
  } = useChatController();

  const transactions = useTransactionsStore((state) => state.items);
  const latestTransaction = useTransactionsStore((state) => state.latest);
  const monthlyStats = useTransactionsStore((state) => state.stats);
  const isMutatingTransaction = useTransactionsStore((state) => state.isMutating);
  const refreshTransactions = useTransactionsStore((state) => state.refreshAll);
  const updateTransaction = useTransactionsStore((state) => state.updateItem);
  const deleteTransaction = useTransactionsStore((state) => state.deleteItem);

  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<TransactionDto | null>(null);

  useEffect(() => {
    void refreshTransactions();
  }, [refreshTransactions]);

  const lastAuditTime =
    auditLogs.length > 0
      ? formatTime(auditLogs[0].createdAt || auditLogs[0].created_at)
      : 'нет событий';

  const handleDeleteTransaction = async (transaction: TransactionDto) => {
    await deleteTransaction(transaction.id);
  };

  const handleSaveTransaction = async (payload: { amount: number; description?: string | null }) => {
    if (!editingTransaction) return;

    await updateTransaction(editingTransaction.id, payload);
    setEditingTransaction(null);
  };

  return (
    <div className="flex h-dvh flex-col bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.10),transparent_28%),linear-gradient(180deg,#0b1016_0%,#090d13_100%)] text-white">
      <div className="mx-auto flex h-full w-full max-w-[520px] flex-col">
        <ChatHeader />

        <AIStatusBar
          pendingCount={pendingActions.length}
          auditCount={auditLogs.length}
          lastAuditTimeLabel={lastAuditTime}
          onOpenPending={openPending}
          onOpenAudit={openAudit}
        />

        <InsightsStrip
          pendingActions={pendingActions}
          auditLogs={auditLogs}
          onOpenPending={openPending}
          onOpenAudit={openAudit}
        />

        <LastTransactionCard
          transaction={latestTransaction ?? transactions[0] ?? null}
          isMutating={isMutatingTransaction}
          onOpenHistory={() => setIsHistoryOpen(true)}
          onEdit={setEditingTransaction}
          onDelete={handleDeleteTransaction}
        />

        <MonthlyStatsCard stats={monthlyStats} />

        <MessageList
          messages={messages}
          onConfirm={confirmAction}
          onCancel={cancelAction}
          onUndo={undoMessageAction}
        />

        <Composer onSend={sendMessage} disabled={isSending} />
      </div>

      <PendingActionsDrawer
        open={isPendingOpen}
        items={pendingActions}
        onClose={closePending}
        onConfirm={confirmAction}
        onCancel={cancelAction}
        onUpdate={updatePendingAction}
      />

      <AuditLogDrawer
        open={isAuditOpen}
        items={auditLogs}
        onClose={closeAudit}
      />

      <TransactionsHistoryDrawer
        open={isHistoryOpen}
        items={transactions}
        isMutating={isMutatingTransaction}
        onClose={() => setIsHistoryOpen(false)}
        onEdit={(transaction) => {
          setEditingTransaction(transaction);
          setIsHistoryOpen(false);
        }}
        onDelete={handleDeleteTransaction}
      />

      <EditTransactionModal
        open={!!editingTransaction}
        transaction={editingTransaction}
        isSaving={isMutatingTransaction}
        onClose={() => setEditingTransaction(null)}
        onSave={handleSaveTransaction}
      />
    </div>
  );
}
