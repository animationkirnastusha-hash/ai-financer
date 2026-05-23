import { useEffect, useState } from 'react';
import { ScreenTopBar } from '@/shared/ui/ScreenTopBar';
import { PendingActionsDrawer } from '@/features/pending-actions/ui/PendingActionsDrawer';
import { FinancePreviewCard } from '@/features/chat/ui/FinancePreviewCard';
import { AICoreInput } from '@/features/ai-core/ui/AICoreInput';
import { AICoreBalanceHero } from '@/features/ai-core/ui/AICoreBalanceHero';
import { useAICoreController } from '@/features/ai-core/model/useAICoreController';
import { CommandListSheet } from '@/features/commands/ui/CommandListSheet';
import { LastTransactionCard } from '@/features/transactions/ui/LastTransactionCard';
import { TransactionsHistoryDrawer } from '@/features/transactions/ui/TransactionsHistoryDrawer';
import { EditTransactionModal } from '@/features/transactions/ui/EditTransactionModal';
import { MonthlyStatsCard } from '@/features/transactions/ui/MonthlyStatsCard';
import { useTransactionsStore } from '@/features/transactions/model/transactions.store';
import type { TransactionDto } from '@/features/transactions/api/transactions.api';
import { useSettingsStore } from '@/features/settings/model/settings.store';

export function AICoreScreen() {
  const [historyOpen, setHistoryOpen] = useState(false);
  const textInputEnabled = useSettingsStore((state) => state.textInputEnabled);

  const {
    items,
    latest,
    monthlyStats,
    editing,
    isMutating,
    refreshDashboard,
    deleteTx,
    openEdit,
    closeEdit,
    saveEdit,
  } = useTransactionsStore();

  const {
    inputValue,
    setInputValue,
    submit,
    closeCommandPanel,
    latestAssistantMessage,
    pendingActions,
    confirmAction,
    cancelAction,
    updatePendingAction,
    isPendingOpen,
    openPending,
    closePending,
    isSending,
    isCommandListOpen,
    openCommandList,
    closeCommandList,
    runQuickCommand,
  } = useAICoreController();

  useEffect(() => {
    void refreshDashboard();
  }, [refreshDashboard]);

  const pendingCount = pendingActions.length;

  const handleDelete = async (transaction: TransactionDto) => {
    await deleteTx(transaction);
  };

  const handleEdit = (transaction: TransactionDto) => {
    openEdit(transaction);
  };

  const handleAfterConfirm = async (actionId: string) => {
    await confirmAction(actionId);
    await refreshDashboard();
  };

  return (
    <div className="app-page ai-core-orb-hidden text-white">
      <div className="app-page__inner space-y-4">
        <ScreenTopBar title="Текстовый ввод" left="back" right={['home']} />

        <AICoreBalanceHero />

        <div className="grid grid-cols-2 gap-2" data-no-swipe="true">
          <button type="button" onClick={openCommandList} className="app-secondary-button h-11">Команды</button>
          <button type="button" onClick={() => setHistoryOpen(true)} className="app-secondary-button h-11">История</button>
        </div>

        <section className="app-card">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="app-section-title">Запрос к Фине</div>
              <p className="mt-2 text-sm leading-6 text-white/48">Запасной способ ввода, если сейчас неудобно говорить.</p>
            </div>
            {pendingCount > 0 ? (
              <button onClick={openPending} className="rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-2 text-xs text-amber-100">
                Ждёт: {pendingCount}
              </button>
            ) : null}
          </div>

          {textInputEnabled ? (
            <div className="mt-4">
              <AICoreInput value={inputValue} onChange={setInputValue} onSubmit={submit} onClose={closeCommandPanel} disabled={isSending} />
            </div>
          ) : (
            <div className="mt-4 rounded-[22px] border border-white/10 bg-white/[0.04] px-4 py-4 text-sm leading-6 text-white/52">
              Текстовый ввод выключен в настройках.
            </div>
          )}
        </section>

        <div className="grid grid-cols-2 gap-3">
          <LastTransactionCard compact transaction={latest ?? items[0] ?? null} isMutating={isMutating} onOpenHistory={() => setHistoryOpen(true)} onEdit={handleEdit} onDelete={handleDelete} />
          <MonthlyStatsCard compact stats={monthlyStats} />
        </div>

        {latestAssistantMessage?.kind === 'preview' ? (
          <FinancePreviewCard title={latestAssistantMessage.text} intent={latestAssistantMessage.actionType} actionId={latestAssistantMessage.actionId} data={latestAssistantMessage.data} onConfirm={handleAfterConfirm} onCancel={cancelAction} />
        ) : null}

        {latestAssistantMessage && latestAssistantMessage.kind !== 'preview' ? (
          <section className="app-card">
            <div className="app-eyebrow">Ответ</div>
            <div className="mt-2 text-sm leading-6 text-white">{latestAssistantMessage.text}</div>
          </section>
        ) : null}
      </div>

      <PendingActionsDrawer open={isPendingOpen} items={pendingActions} onClose={closePending} onConfirm={handleAfterConfirm} onCancel={cancelAction} onUpdate={updatePendingAction} />
      <TransactionsHistoryDrawer open={historyOpen} items={items} isMutating={isMutating} onClose={() => setHistoryOpen(false)} onEdit={handleEdit} onDelete={handleDelete} />
      <EditTransactionModal open={Boolean(editing)} transaction={editing} isSaving={isMutating} onClose={closeEdit} onSave={saveEdit} />
      <CommandListSheet open={isCommandListOpen} onClose={closeCommandList} onRunCommand={runQuickCommand} />
    </div>
  );
}
