import { useEffect, useMemo, useState } from 'react';
import type React from 'react';
import { PendingActionsDrawer } from '@/features/pending-actions/ui/PendingActionsDrawer';
import { FinancePreviewCard } from '@/features/chat/ui/FinancePreviewCard';
import { AICoreOrb } from '@/features/ai-core/ui/AICoreOrb';
import { AICoreInput } from '@/features/ai-core/ui/AICoreInput';
import { AICoreBalanceHero } from '@/features/ai-core/ui/AICoreBalanceHero';
import { useAICoreController } from '@/features/ai-core/model/useAICoreController';
import { CommandListSheet } from '@/features/commands/ui/CommandListSheet';
import { TransactionsHistoryDrawer } from '@/features/transactions/ui/TransactionsHistoryDrawer';
import { EditTransactionModal } from '@/features/transactions/ui/EditTransactionModal';
import { useTransactionsStore } from '@/features/transactions/model/transactions.store';
import { formatMoney, formatTransactionDate } from '@/shared/lib/money';
import type { TransactionDto } from '@/features/transactions/api/transactions.api';

type PanelModal = 'summary' | 'latest' | null;

function transactionLabel(transaction: TransactionDto | null) {
  if (!transaction) return 'Нет операций';
  return transaction.description || transaction.category?.name || 'Операция';
}

function transactionAmount(transaction: TransactionDto | null) {
  if (!transaction) return '—';
  const isIncome = transaction.type === 'income';
  const isExpense = transaction.type === 'expense';

  return formatMoney(Number(transaction.amount) || 0, transaction.account?.currency || 'RUB', {
    sign: isIncome ? 'plus' : isExpense ? 'minus' : 'none',
  });
}

function CorePanelModal({
  open,
  type,
  items,
  monthlyTotal,
  onClose,
  onOpenHistory,
  onEdit,
  onDelete,
}: {
  open: boolean;
  type: PanelModal;
  items: TransactionDto[];
  monthlyTotal: number;
  onClose: () => void;
  onOpenHistory: () => void;
  onEdit: (transaction: TransactionDto) => void;
  onDelete: (transaction: TransactionDto) => Promise<void>;
}) {
  useEffect(() => {
    document.body.classList.toggle('ai-modal-open', open);
    return () => document.body.classList.remove('ai-modal-open');
  }, [open]);

  if (!open || !type) return null;

  const recent = items.slice(0, type === 'latest' ? 6 : 12);
  const title = type === 'summary' ? 'Операции' : 'Последние операции';
  const subtitle = type === 'summary'
    ? `${items.length} операций · ${formatMoney(monthlyTotal, 'RUB', { sign: 'plus' })}`
    : 'Можно исправить или удалить последние действия';

  const handleBackdropPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (target.dataset.modalBackdrop === 'true') onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[120] flex items-end bg-black/55 backdrop-blur-md"
      data-modal-backdrop="true"
      data-no-swipe="true"
      onPointerDown={handleBackdropPointerDown}
    >
      <div className="mx-auto max-h-[82dvh] w-full max-w-[560px] overflow-hidden rounded-t-[34px] border border-white/10 bg-[#08111b] shadow-[0_-24px_80px_rgba(0,0,0,0.55)]">
        <div className="flex items-start justify-between gap-3 border-b border-white/8 px-5 py-4">
          <div>
            <div className="text-[11px] uppercase tracking-[0.2em] text-white/38">
              {title}
            </div>
            <div className="mt-1 text-sm text-white/64">{subtitle}</div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-xl text-white/70"
            aria-label="Закрыть"
          >
            ×
          </button>
        </div>

        <div className="max-h-[62dvh] space-y-2 overflow-y-auto px-4 py-4 no-scrollbar">
          {recent.length === 0 ? (
            <div className="rounded-2xl border border-white/8 bg-white/[0.035] p-4 text-sm text-white/55">
              Пока нет операций.
            </div>
          ) : (
            recent.map((item) => {
              const isIncome = item.type === 'income';
              return (
                <div
                  key={item.id}
                  className="rounded-2xl border border-white/8 bg-white/[0.035] p-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-white">
                        {transactionLabel(item)}
                      </div>
                      <div className="mt-1 text-xs text-white/42">
                        {formatTransactionDate(item.date)} · {item.account?.name || 'Счёт'}
                      </div>
                    </div>

                    <div className={`shrink-0 text-sm font-semibold ${isIncome ? 'text-emerald-300' : 'text-white'}`}>
                      {transactionAmount(item)}
                    </div>
                  </div>

                  {type === 'latest' ? (
                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        onClick={() => onEdit(item)}
                        className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-xs text-white/78"
                      >
                        Исправить
                      </button>
                      <button
                        type="button"
                        onClick={() => void onDelete(item)}
                        className="rounded-full border border-rose-300/15 bg-rose-400/10 px-3 py-1.5 text-xs text-rose-100"
                      >
                        Отменить
                      </button>
                    </div>
                  ) : null}
                </div>
              );
            })
          )}
        </div>

        <div className="border-t border-white/8 px-4 pb-[calc(env(safe-area-inset-bottom)+16px)] pt-3">
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenHistory();
            }}
            className="w-full rounded-2xl border border-emerald-300/20 bg-emerald-400/12 px-4 py-3 text-sm font-medium text-emerald-100"
          >
            Вся история
          </button>
        </div>
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

  const latestTransaction = latest ?? items[0] ?? null;
  const modalOpen = panelModal !== null || isPendingOpen || historyOpen || Boolean(editing) || isCommandListOpen;

  useEffect(() => {
    document.body.classList.toggle('ai-modal-open', modalOpen);
    return () => document.body.classList.remove('ai-modal-open');
  }, [modalOpen]);

  const monthTotal = useMemo(() => {
    if (monthlyStats && typeof monthlyStats.balance === 'number') return monthlyStats.balance;

    return items.reduce((sum, item) => {
      const value = Number(item.amount) || 0;
      if (item.type === 'income') return sum + value;
      if (item.type === 'expense') return sum - value;
      return sum;
    }, 0);
  }, [items, monthlyStats]);

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

  const handleDelete = async (transaction: TransactionDto) => {
    await deleteTx(transaction);
  };

  const handleEdit = (transaction: TransactionDto) => {
    setPanelModal(null);
    openEdit(transaction);
  };

  const handleAfterConfirm = async (actionId: string) => {
    await confirmAction(actionId);
    await refreshDashboard();
  };

  const showComposer = isCommandPanelOpen && !modalOpen;

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.10),transparent_28%),linear-gradient(180deg,#040811_0%,#07111b_100%)] text-white">
      <div className="mx-auto flex h-full w-full max-w-[560px] flex-col overflow-hidden">
        <header className="shrink-0 px-4 pt-5 pb-2">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={openCommandList}
              className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.04]"
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

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setPanelModal('summary')}
                className="rounded-[24px] border border-white/10 bg-white/[0.045] p-4 text-left transition active:scale-[0.99]"
              >
                <div className="text-[10px] uppercase tracking-[0.2em] text-white/38">Операции</div>
                <div className="mt-3 text-2xl font-semibold text-white">{items.length}</div>
                <div className="mt-1 text-sm font-medium text-emerald-300">
                  {formatMoney(monthTotal, 'RUB', { sign: monthTotal >= 0 ? 'plus' : 'minus' })}
                </div>
              </button>

              <button
                type="button"
                onClick={() => setPanelModal('latest')}
                className="relative rounded-[24px] border border-white/10 bg-white/[0.045] p-4 text-left transition active:scale-[0.99]"
              >
                {latestTransaction ? (
                  <span className="absolute right-4 top-4 h-2.5 w-2.5 rounded-full bg-emerald-300 shadow-[0_0_14px_rgba(110,231,183,0.45)]" />
                ) : null}
                <div className="text-[10px] uppercase tracking-[0.2em] text-white/38">Последнее</div>
                <div className="mt-3 truncate text-lg font-semibold text-white">
                  {transactionLabel(latestTransaction)}
                </div>
                <div className="mt-1 text-sm text-white/45">
                  {latestTransaction ? transactionAmount(latestTransaction) : 'пока пусто'}
                </div>
              </button>
            </div>

            <div className="flex items-center justify-between rounded-2xl border border-white/8 bg-white/[0.035] px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-sm text-white/72">{liveText}</span>
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

            <section className="relative flex flex-col items-center justify-center py-5">
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

            {showComposer ? (
              <AICoreInput
                value={inputValue}
                onChange={setInputValue}
                onSubmit={submit}
                disabled={isSending}
              />
            ) : null}

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
                Голос временно недоступен. Нажми и удерживай сферу ещё раз, чтобы повторить запрос доступа к микрофону.
              </section>
            ) : null}

            {!isVoiceSupported ? (
              <section className="rounded-2xl border border-white/8 bg-white/5 px-4 py-3 text-sm text-white/55">
                Голос не поддерживается устройством.
              </section>
            ) : null}
          </div>
        </div>
      </div>

      <CorePanelModal
        open={panelModal !== null}
        type={panelModal}
        items={items}
        monthlyTotal={monthTotal}
        onClose={() => setPanelModal(null)}
        onOpenHistory={() => setHistoryOpen(true)}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />

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
