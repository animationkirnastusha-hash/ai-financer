import { useEffect, useMemo, useState } from 'react';
import { PendingActionsDrawer } from '@/features/pending-actions/ui/PendingActionsDrawer';
import { FinancePreviewCard } from '@/features/chat/ui/FinancePreviewCard';
import { AICoreOrb } from '@/features/ai-core/ui/AICoreOrb';
import { AICoreInput } from '@/features/ai-core/ui/AICoreInput';
import { AICoreRecentActivity } from '@/features/ai-core/ui/AICoreRecentActivity';
import { useAICoreController } from '@/features/ai-core/model/useAICoreController';
import { CommandListSheet } from '@/features/commands/ui/CommandListSheet';
import { LastTransactionCard } from '@/features/transactions/ui/LastTransactionCard';
import { TransactionsHistoryDrawer } from '@/features/transactions/ui/TransactionsHistoryDrawer';
import { EditTransactionModal } from '@/features/transactions/ui/EditTransactionModal';
import { useTransactionsStore } from '@/features/transactions/model/transactions.store';
import type { TransactionDto } from '@/features/transactions/api/transactions.api';
import { formatMoney } from '@/shared/lib/money';

type PanelModal = 'summary' | 'alerts' | null;

function CoreInfoModal({
  type,
  onClose,
  count,
  balance,
  pendingCount,
  latest,
}: {
  type: Exclude<PanelModal, null>;
  onClose: () => void;
  count: number;
  balance: number;
  pendingCount: number;
  latest: TransactionDto | null;
}) {
  return (
    <div className="fixed inset-0 z-[120] flex items-end bg-black/65 px-3 pb-3 backdrop-blur-md" data-no-swipe="true">
      <div className="mx-auto w-full max-w-[560px] rounded-[30px] border border-white/10 bg-[#0b1016] p-4 text-white shadow-2xl">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <div className="text-[11px] uppercase tracking-[0.16em] text-white/35">
              {type === 'summary' ? 'Сводка' : 'События'}
            </div>
            <div className="mt-1 text-lg font-semibold">
              {type === 'summary' ? 'Коротко по финансам' : 'Что требует внимания'}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="grid h-11 w-11 place-items-center rounded-2xl border border-white/10 bg-white/[0.05] text-xl text-white/75"
            aria-label="Закрыть"
          >
            ×
          </button>
        </div>

        {type === 'summary' ? (
          <div className="grid gap-3">
            <div className="rounded-2xl border border-white/8 bg-white/[0.04] px-4 py-3">
              <div className="text-sm text-white/50">Операций за месяц</div>
              <div className="mt-1 text-2xl font-semibold">{count}</div>
            </div>

            <div className="rounded-2xl border border-white/8 bg-white/[0.04] px-4 py-3">
              <div className="text-sm text-white/50">Баланс месяца</div>
              <div className={balance >= 0 ? 'mt-1 text-2xl font-semibold text-emerald-300' : 'mt-1 text-2xl font-semibold text-white'}>
                {formatMoney(balance, 'RUB', { sign: 'auto' })}
              </div>
            </div>
          </div>
        ) : (
          <div className="grid gap-3">
            <div className="rounded-2xl border border-white/8 bg-white/[0.04] px-4 py-3">
              <div className="text-sm text-white/50">Ожидают подтверждения</div>
              <div className="mt-1 text-2xl font-semibold">{pendingCount}</div>
            </div>

            <div className="rounded-2xl border border-white/8 bg-white/[0.04] px-4 py-3">
              <div className="text-sm text-white/50">Последняя операция</div>
              <div className="mt-1 truncate text-base font-medium">
                {latest?.description || latest?.category?.name || 'Пока нет операций'}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function AICoreScreen() {
  const [historyOpen, setHistoryOpen] = useState(false);
  const [panelModal, setPanelModal] = useState<PanelModal>(null);

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

  const pendingCount = pendingActions.length;
  const operationCount = monthlyStats?.count ?? items.length;
  const monthBalance = monthlyStats?.balance ?? 0;
  const activeLatest = latest ?? items[0] ?? null;

  const liveText = useMemo(() => {
    if (voiceState === 'recording') {
      if (isVoiceLocked) return voiceTranscript || 'Запись закреплена';
      return voiceTranscript || 'Слушаю...';
    }

    if (voiceState === 'uploading') return 'Обрабатываю голос...';
    if (voiceState === 'speaking') return 'AI отвечает...';
    if (isSending) return 'AI думает...';
    return 'AI активен';
  }, [isSending, isVoiceLocked, voiceState, voiceTranscript]);

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
        <header className="shrink-0 px-4 pb-2 pt-5">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={openCommandList}
              className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.04]"
              aria-label="Открыть возможности AI"
            >
              <span className="text-xl text-emerald-200">⌘</span>
            </button>

            <div className="text-center">
              <div className="text-[32px] font-semibold leading-none tracking-tight">
                ai finance
              </div>
              <div className="mt-1 text-xs text-white/38">ваш финансовый ai</div>
            </div>

            <div className="h-11 w-11" aria-hidden="true" />
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-4 pb-40 no-scrollbar">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setPanelModal('summary')}
                className="relative overflow-hidden rounded-[24px] border border-white/8 bg-white/[0.045] p-4 text-left shadow-xl shadow-black/15 active:scale-[0.99]"
              >
                <div className="text-[10px] uppercase tracking-[0.16em] text-white/35">Месяц</div>
                <div className="mt-2 text-sm font-medium text-white">{operationCount} операций</div>
                <div className={monthBalance >= 0 ? 'mt-1 text-base font-semibold text-emerald-300' : 'mt-1 text-base font-semibold text-white'}>
                  {formatMoney(monthBalance, 'RUB', { sign: 'auto' })}
                </div>
              </button>

              <button
                type="button"
                onClick={() => setPanelModal('alerts')}
                className="relative overflow-hidden rounded-[24px] border border-white/8 bg-white/[0.045] p-4 text-left shadow-xl shadow-black/15 active:scale-[0.99]"
              >
                {pendingCount > 0 ? (
                  <span className="absolute right-3 top-3 h-2.5 w-2.5 rounded-full bg-amber-300 shadow-[0_0_14px_rgba(252,211,77,0.55)]" />
                ) : null}
                <div className="text-[10px] uppercase tracking-[0.16em] text-white/35">События</div>
                <div className="mt-2 text-sm font-medium text-white">
                  {pendingCount > 0 ? `${pendingCount} ждёт` : 'Всё спокойно'}
                </div>
                <div className="mt-1 truncate text-xs text-white/45">
                  {activeLatest?.description || activeLatest?.category?.name || 'Нет новых операций'}
                </div>
              </button>
            </div>

            <div className="flex items-center justify-between rounded-2xl border border-white/8 bg-white/[0.035] px-4 py-3">
              <div className="flex min-w-0 items-center gap-2">
                <div className="h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-emerald-400" />
                <span className="truncate text-sm text-white/72">{liveText}</span>
              </div>

              {pendingCount > 0 ? (
                <button
                  onClick={openPending}
                  className="shrink-0 rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1 text-xs text-amber-100"
                >
                  Проверить
                </button>
              ) : (
                <span className="shrink-0 text-xs text-emerald-200/80">Active</span>
              )}
            </div>

            <section className="relative flex flex-col items-center justify-center pb-1 pt-4">
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
            </section>

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
                <div className="text-[10px] uppercase tracking-[0.18em] text-white/35">
                  AI
                </div>
                <div className="mt-2 text-sm leading-6 text-white">
                  {latestAssistantMessage.text}
                </div>
              </section>
            ) : null}

            {voiceError ? (
              <section className="rounded-2xl border border-amber-300/15 bg-amber-300/10 px-4 py-3 text-sm leading-6 text-amber-50">
                Микрофон не подключился. Зажми сферу ещё раз или проверь разрешение микрофона в Telegram/браузере.
              </section>
            ) : null}

            {!isVoiceSupported ? (
              <section className="rounded-2xl border border-white/8 bg-white/5 px-4 py-3 text-sm text-white/55">
                На этом устройстве голосовой ввод может быть недоступен.
              </section>
            ) : null}

            <LastTransactionCard
              transaction={activeLatest}
              isMutating={isMutating}
              onOpenHistory={() => setHistoryOpen(true)}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />

            <AICoreRecentActivity />
          </div>
        </div>
      </div>

      {isCommandPanelOpen ? (
        <AICoreInput
          value={inputValue}
          onChange={setInputValue}
          onSubmit={submit}
          disabled={isSending}
        />
      ) : null}

      {panelModal ? (
        <CoreInfoModal
          type={panelModal}
          onClose={() => setPanelModal(null)}
          count={operationCount}
          balance={monthBalance}
          pendingCount={pendingCount}
          latest={activeLatest}
        />
      ) : null}

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
