import { useEffect, useMemo, useState } from 'react';
import { PendingActionsDrawer } from '@/features/pending-actions/ui/PendingActionsDrawer';
import { FinancePreviewCard } from '@/features/chat/ui/FinancePreviewCard';
import { AICoreOrb } from '@/features/ai-core/ui/AICoreOrb';
import { AICoreInput } from '@/features/ai-core/ui/AICoreInput';
import { AICoreBalanceHero } from '@/features/ai-core/ui/AICoreBalanceHero';
import { AICoreQuickPrompts } from '@/features/ai-core/ui/AICoreQuickPrompts';
import { AICoreRecentActivity } from '@/features/ai-core/ui/AICoreRecentActivity';
import { useAICoreController } from '@/features/ai-core/model/useAICoreController';
import { CommandListSheet } from '@/features/commands/ui/CommandListSheet';
import { LastTransactionCard } from '@/features/transactions/ui/LastTransactionCard';
import { TransactionsHistoryDrawer } from '@/features/transactions/ui/TransactionsHistoryDrawer';
import { EditTransactionModal } from '@/features/transactions/ui/EditTransactionModal';
import { useTransactionsStore } from '@/features/transactions/model/transactions.store';
import type { TransactionDto } from '@/features/transactions/api/transactions.api';
import { formatMoney, formatTransactionDate } from '@/shared/lib/money';

function getTransactionTitle(transaction: TransactionDto | null) {
  if (!transaction) return 'Пока пусто';

  if (transaction.type === 'transfer') {
    return `${transaction.account?.name ?? 'Счёт'} → ${transaction.toAccount?.name ?? 'Счёт'}`;
  }

  return transaction.category?.name || transaction.description || 'Операция';
}

function getTransactionMeta(transaction: TransactionDto | null) {
  if (!transaction) return 'AI ждёт первую команду';

  const source = transaction.description || transaction.account?.name || 'операция';
  return `${source} · ${formatTransactionDate(transaction.date)}`;
}

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
    coreState,
    inputValue,
    setInputValue,
    submit,
    handleOrbTap,
    handleOrbHoldStart,
    handleOrbHoldEnd,
    handleOrbHoldCancel,
    handleOrbHoldLock,
    finishLockedVoice,
    cancelLockedVoice,

    latestAssistantMessage,

    pendingActions,
    confirmAction,
    cancelAction,

    isPendingOpen,
    openPending,
    closePending,

    isSending,

    voiceTranscript,
    voiceState,
    voiceError,
    isVoiceSupported,
    isVoiceLocked,

    isCommandPanelOpen,
    isCommandListOpen,
    openCommandList,
    closeCommandList,
    runQuickCommand,
  } = useAICoreController();

  useEffect(() => {
    void refreshDashboard();
  }, [refreshDashboard]);

  const lastTransaction = latest ?? items[0] ?? null;

  const liveText =
    voiceState === 'recording'
      ? isVoiceLocked
        ? voiceTranscript || 'Запись закреплена'
        : voiceTranscript || 'Слушаю...'
      : voiceState === 'uploading'
        ? 'Обрабатываю голос...'
        : voiceState === 'speaking'
          ? 'AI отвечает...'
          : isSending
            ? 'AI думает...'
            : 'AI активен';

  const monthPanel = useMemo(() => {
    const count = monthlyStats?.count ?? items.length;
    const balance = monthlyStats?.balance ?? 0;

    return {
      count,
      balance,
      label: count === 1 ? 'операция' : count > 1 && count < 5 ? 'операции' : 'операций',
    };
  }, [items.length, monthlyStats]);

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
    <div className="flex h-dvh flex-col overflow-hidden bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.10),transparent_28%),linear-gradient(180deg,#040811_0%,#07111b_100%)] text-white">
      <div className="mx-auto flex h-full w-full max-w-[560px] flex-col overflow-hidden">
        <header className="shrink-0 px-4 pt-5 pb-2">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={openCommandList}
              className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.04]"
              aria-label="Команды"
            >
              <span className="text-xl text-emerald-200">⌘</span>
            </button>

            <div className="text-center">
              <div className="text-[32px] font-semibold leading-none tracking-tight">ai finance</div>
              <div className="mt-1 text-xs text-white/38">ваш финансовый ai</div>
            </div>

            <div className="h-11 w-24" aria-hidden="true" />
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-4 pb-44 no-scrollbar">
          <div className="space-y-4">
            <AICoreBalanceHero />

            <section className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setHistoryOpen(true)}
                className="min-h-[112px] rounded-[26px] border border-white/10 bg-white/[0.04] p-4 text-left shadow-[0_0_36px_rgba(0,0,0,0.16)]"
              >
                <div className="text-[11px] uppercase tracking-[0.22em] text-white/35">Месяц</div>
                <div className="mt-3 text-lg font-semibold text-white">
                  {monthPanel.count} {monthPanel.label}
                </div>
                <div className="mt-2 text-xl font-semibold text-emerald-300">
                  {formatMoney(monthPanel.balance, 'RUB', { sign: 'auto' })}
                </div>
              </button>

              <button
                type="button"
                onClick={() => setHistoryOpen(true)}
                className="relative min-h-[112px] rounded-[26px] border border-white/10 bg-white/[0.04] p-4 text-left shadow-[0_0_36px_rgba(0,0,0,0.16)]"
              >
                {lastTransaction ? (
                  <span className="absolute right-3 top-3 h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_16px_rgba(52,211,153,0.55)]" />
                ) : null}
                <div className="text-[11px] uppercase tracking-[0.22em] text-white/35">Последнее</div>
                <div className="mt-3 truncate text-lg font-semibold text-white">
                  {getTransactionTitle(lastTransaction)}
                </div>
                <div className="mt-2 line-clamp-2 text-sm leading-5 text-white/45">
                  {getTransactionMeta(lastTransaction)}
                </div>
              </button>
            </section>

            <div className="flex items-center justify-between rounded-2xl border border-white/8 bg-white/[0.035] px-4 py-3">
              <div className="flex min-w-0 items-center gap-2">
                <div className="h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-400 animate-pulse" />
                <span className="truncate text-sm text-white/72">{liveText}</span>
              </div>

              {pendingActions.length > 0 ? (
                <button
                  onClick={openPending}
                  className="rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1 text-xs text-amber-100"
                >
                  Ждёт: {pendingActions.length}
                </button>
              ) : (
                <span className="text-xs text-emerald-200/80">Active</span>
              )}
            </div>

            <section className="relative flex flex-col items-center justify-center py-4">
              <AICoreOrb
                state={coreState}
                isVoiceLocked={isVoiceLocked}
                onTap={handleOrbTap}
                onHoldStart={handleOrbHoldStart}
                onHoldEnd={handleOrbHoldEnd}
                onHoldCancel={handleOrbHoldCancel}
                onHoldLock={handleOrbHoldLock}
                onLockedDone={finishLockedVoice}
                onLockedCancel={cancelLockedVoice}
              />

              <div className="mt-5 text-center">
                <div className="text-lg font-medium text-white">Зажми и говори</div>
                <div className="mt-1 text-sm text-white/38">вверх — замок, влево — отмена</div>
              </div>
            </section>

            <LastTransactionCard
              transaction={lastTransaction}
              isMutating={isMutating}
              onOpenHistory={() => setHistoryOpen(true)}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />

            {isCommandPanelOpen ? (
              <AICoreInput
                value={inputValue}
                onChange={setInputValue}
                onSubmit={submit}
                disabled={isSending}
              />
            ) : null}

            <AICoreQuickPrompts onRunCommand={runQuickCommand} />

            {latestAssistantMessage?.kind === 'preview' ? (
              <FinancePreviewCard
                title={latestAssistantMessage.text}
                intent={latestAssistantMessage.actionType}
                actionId={latestAssistantMessage.actionId}
                data={latestAssistantMessage.data}
                onConfirm={handleAfterConfirm}
                onCancel={cancelAction}
              />
            ) : null}

            {latestAssistantMessage && latestAssistantMessage.kind !== 'preview' ? (
              <section className="rounded-[24px] border border-white/10 bg-white/[0.04] px-4 py-4">
                <div className="text-[10px] uppercase tracking-[0.18em] text-white/35">AI Response</div>
                <div className="mt-2 text-sm leading-6 text-white">{latestAssistantMessage.text}</div>
              </section>
            ) : null}

            {voiceError ? (
              <section className="rounded-2xl border border-rose-400/15 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
                Голос временно недоступен. Используй текстовый ввод.
              </section>
            ) : null}

            {!isVoiceSupported ? (
              <section className="rounded-2xl border border-white/8 bg-white/5 px-4 py-3 text-sm text-white/55">
                Голос не поддерживается устройством.
              </section>
            ) : null}

            <AICoreRecentActivity />
          </div>
        </div>
      </div>

      <PendingActionsDrawer
        open={isPendingOpen}
        items={pendingActions}
        onClose={closePending}
        onConfirm={handleAfterConfirm}
        onCancel={cancelAction}
      />

      <TransactionsHistoryDrawer
        open={historyOpen}
        items={items}
        isMutating={isMutating}
        onClose={() => setHistoryOpen(false)}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />

      <EditTransactionModal
        open={Boolean(editing)}
        transaction={editing}
        isSaving={isMutating}
        onClose={closeEdit}
        onSave={saveEdit}
      />

      <CommandListSheet
        open={isCommandListOpen}
        onClose={closeCommandList}
        onRunCommand={runQuickCommand}
      />
    </div>
  );
}
