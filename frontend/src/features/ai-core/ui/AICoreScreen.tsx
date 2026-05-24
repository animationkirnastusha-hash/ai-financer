import { useEffect, useState } from 'react';
import { ScreenTopBar } from '@/shared/ui/ScreenTopBar';
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

export function AICoreScreen() {
  const [historyOpen, setHistoryOpen] = useState(false);

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
    latestAssistantMessage,
    pendingActions,
    openPending,
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


  return (
    <div className="app-page app-ai-text-page text-white">
      <div className="app-page__inner space-y-4">
        <ScreenTopBar title="Текстовый ввод" left="back" right={['home']} />

        <AICoreBalanceHero />

        <section className="app-card app-ai-text-hero">
          <div className="app-eyebrow">Фина</div>
          <h1>Чат, когда говорить неудобно</h1>
          <p>Основной сценарий — голосом через имя Фины. Здесь можно написать команду вручную: операция, вопрос, изменение или уточнение.</p>
          <div className="app-ai-text-actions">
            <button type="button" onClick={openCommandList} className="app-secondary-button">Подсказки</button>
            <button type="button" onClick={() => setHistoryOpen(true)} className="app-secondary-button">История</button>
            {pendingCount > 0 ? <button type="button" onClick={openPending} className="app-primary-button">Ждёт: {pendingCount}</button> : null}
          </div>
        </section>

        {latestAssistantMessage ? (
          <section className="app-card app-ai-text-response">
            <div className="app-eyebrow">Ответ Фины</div>
            <div>{latestAssistantMessage.text}</div>
          </section>
        ) : null}

        <div className="grid grid-cols-2 gap-3">
          <LastTransactionCard compact transaction={latest ?? items[0] ?? null} isMutating={isMutating} onOpenHistory={() => setHistoryOpen(true)} onEdit={handleEdit} onDelete={handleDelete} />
          <MonthlyStatsCard compact stats={monthlyStats} />
        </div>
      </div>

      <AICoreInput value={inputValue} onChange={setInputValue} onSubmit={submit} disabled={isSending} />
      <TransactionsHistoryDrawer open={historyOpen} items={items} isMutating={isMutating} onClose={() => setHistoryOpen(false)} onEdit={handleEdit} onDelete={handleDelete} />
      <EditTransactionModal open={Boolean(editing)} transaction={editing} isSaving={isMutating} onClose={closeEdit} onSave={saveEdit} />
      <CommandListSheet open={isCommandListOpen} onClose={closeCommandList} onRunCommand={runQuickCommand} />
    </div>
  );
}
