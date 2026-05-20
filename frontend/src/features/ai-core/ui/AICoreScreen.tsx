import { useEffect, useState } from 'react';
import { useNavigationStore } from '@/features/navigation/model/navigation.store';
import { PendingActionsDrawer } from '@/features/pending-actions/ui/PendingActionsDrawer';
import { FinancePreviewCard } from '@/features/chat/ui/FinancePreviewCard';
import { AICoreOrb } from '@/features/ai-core/ui/AICoreOrb';
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
  const goBack = useNavigationStore((state) => state.goBack);
  const goHome = useNavigationStore((state) => state.goHome);

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
    closeCommandPanel,
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
    updatePendingAction,

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

  const pendingCount = pendingActions.length;

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
            : 'AI готов';

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

        {/* HEADER */}
        <header className="shrink-0 px-4 pt-5 pb-2" data-no-swipe="true">
          <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3">
            <button
              type="button"
              onClick={goBack}
              className="flex h-10 min-w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] px-3 text-sm text-white/72"
            >
              Назад
            </button>

            <div className="min-w-0 text-center">
              <div className="truncate text-[28px] font-semibold leading-none tracking-tight">
                AI-Financer
              </div>

              <div className="mt-1 truncate text-xs text-white/38">
                финансовый помощник
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={openCommandList}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.04]"
                aria-label="Команды"
              >
                <span className="text-lg text-emerald-200">⌘</span>
              </button>
              <button
                type="button"
                onClick={() => setHistoryOpen(true)}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-sm text-white/72"
                aria-label="История операций"
              >
                ◷
              </button>
              <button
                type="button"
                onClick={goHome}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-sm text-white/72"
                aria-label="Домой"
              >
                ⌂
              </button>
            </div>
          </div>
        </header>

        {/* BODY */}
        <div className="flex-1 overflow-y-auto px-4 pb-44 no-scrollbar">

          <div className="space-y-4">

            <AICoreBalanceHero />

            {/* LIVE STATUS */}
            <div className="flex items-center justify-between rounded-2xl border border-white/8 bg-white/[0.035] px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-sm text-white/72">{liveText}</span>
              </div>

              {pendingCount > 0 ? (
                <button
                  onClick={openPending}
                  className="rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1 text-xs text-amber-100"
                >
                  Ждёт: {pendingCount}
                </button>
              ) : (
                <span className="text-xs text-emerald-200/80">Готов</span>
              )}
            </div>

            {/* SUMMARY CARDS */}
            <div className="grid grid-cols-2 gap-3 px-4">
              <LastTransactionCard
                compact
                transaction={latest ?? items[0] ?? null}
                isMutating={isMutating}
                onOpenHistory={() => setHistoryOpen(true)}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />

              <MonthlyStatsCard compact stats={monthlyStats} />
            </div>

            {/* CORE */}
            <section className="relative flex flex-col items-center justify-center py-3">

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

              <div className="mt-4 text-center">
                <div className="text-base font-medium text-white">
                  Зажми и говори
                </div>
              </div>
            </section>

            {/* INPUT */}
            <div className="pb-2">
            {isCommandPanelOpen ? (
               <AICoreInput
                  value={inputValue}
                  onChange={setInputValue}
                  onSubmit={submit}
                  onClose={closeCommandPanel}
                  disabled={isSending}
              />
            ) : null}
            </div>

            {/* PREVIEW */}
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

            {/* RESPONSE */}
            {latestAssistantMessage &&
            latestAssistantMessage.kind !== 'preview' ? (
              <section className="rounded-[24px] border border-white/10 bg-white/[0.04] px-4 py-4">
                <div className="text-[10px] uppercase tracking-[0.18em] text-white/35">
                  Ответ AI
                </div>

                <div className="mt-2 text-sm leading-6 text-white">
                  {latestAssistantMessage.text}
                </div>
              </section>
            ) : null}

            {/* ERRORS */}
            {voiceError ? (
              <section className="rounded-2xl border border-rose-400/15 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
                Голос не прошёл. Проверь доступ к микрофону и серверную расшифровку.
              </section>
            ) : null}

            {!isVoiceSupported ? (
              <section className="rounded-2xl border border-white/8 bg-white/5 px-4 py-3 text-sm text-white/55">
                На этом устройстве голос может работать только через серверную расшифровку.
              </section>
            ) : null}

          </div>
        </div>
      </div>

      {/* DRAWERS */}
      <PendingActionsDrawer
        open={isPendingOpen}
        items={pendingActions}
        onClose={closePending}
        onConfirm={handleAfterConfirm}
        onCancel={cancelAction}
        onUpdate={updatePendingAction}
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
