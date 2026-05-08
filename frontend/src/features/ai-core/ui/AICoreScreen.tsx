import { useEffect, useMemo, useState } from 'react';
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
import type { TransactionDto } from '@/features/transactions/api/transactions.api';
import { useNavigationStore } from '@/features/navigation/model/navigation.store';
import { cn } from '@/shared/lib/cn';
import { formatMoney, formatTransactionDate } from '@/shared/lib/money';

type PanelModal = 'summary' | 'recent' | null;

function getTxTitle(transaction: TransactionDto) {
  if (transaction.type === 'transfer') {
    return `${transaction.account?.name ?? 'Счёт'} → ${transaction.toAccount?.name ?? 'Счёт'}`;
  }

  return transaction.description || transaction.category?.name || 'Операция';
}

function getTxSubtitle(transaction: TransactionDto) {
  const parts = [
    formatTransactionDate(transaction.date),
    transaction.account?.name,
    transaction.section?.name,
  ].filter(Boolean);

  return parts.join(' · ') || 'Финансы';
}

function getTxIcon(transaction: TransactionDto) {
  if (transaction.type === 'income') return transaction.category?.icon ?? '💰';
  if (transaction.type === 'transfer') return '↔️';
  return transaction.category?.icon ?? '📝';
}

function getTxAmount(transaction: TransactionDto) {
  const currency = transaction.account?.currency ?? 'RUB';
  const sign = transaction.type === 'income' ? 'plus' : transaction.type === 'expense' ? 'minus' : 'none';
  return formatMoney(Number(transaction.amount) || 0, currency, { sign });
}

function TransactionRow({
  transaction,
  withActions = false,
  isMutating = false,
  onEdit,
  onDelete,
}: {
  transaction: TransactionDto;
  withActions?: boolean;
  isMutating?: boolean;
  onEdit?: (transaction: TransactionDto) => void;
  onDelete?: (transaction: TransactionDto) => void;
}) {
  const isIncome = transaction.type === 'income';

  return (
    <div className="rounded-[22px] border border-white/8 bg-black/20 p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white/[0.07] text-lg">
            {getTxIcon(transaction)}
          </div>

          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-white">
              {getTxTitle(transaction)}
            </div>
            <div className="mt-0.5 truncate text-xs text-white/42">
              {getTxSubtitle(transaction)}
            </div>
          </div>
        </div>

        <div className={cn('shrink-0 text-sm font-semibold', isIncome ? 'text-emerald-300' : 'text-white')}>
          {getTxAmount(transaction)}
        </div>
      </div>

      {withActions ? (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => onEdit?.(transaction)}
            className="rounded-2xl border border-white/10 bg-white/[0.06] px-3 py-2 text-sm text-white active:scale-[0.99]"
          >
            Исправить
          </button>
          <button
            type="button"
            disabled={isMutating}
            onClick={() => onDelete?.(transaction)}
            className="rounded-2xl border border-rose-300/15 bg-rose-400/10 px-3 py-2 text-sm text-rose-100 active:scale-[0.99] disabled:opacity-40"
          >
            Отменить
          </button>
        </div>
      ) : null}
    </div>
  );
}

function AICorePanelModal({
  type,
  items,
  monthlyStats,
  isMutating,
  onClose,
  onEdit,
  onDelete,
  onOpenAll,
}: {
  type: Exclude<PanelModal, null>;
  items: TransactionDto[];
  monthlyStats: ReturnType<typeof useTransactionsStore.getState>['monthlyStats'];
  isMutating: boolean;
  onClose: () => void;
  onEdit: (transaction: TransactionDto) => void;
  onDelete: (transaction: TransactionDto) => void;
  onOpenAll: () => void;
}) {
  const [touchStartY, setTouchStartY] = useState<number | null>(null);

  useEffect(() => {
    document.body.classList.add('ai-core-modal-open');
    return () => document.body.classList.remove('ai-core-modal-open');
  }, []);

  const isSummary = type === 'summary';
  const recent = items.slice(0, 6);

  return (
    <div
      className="fixed inset-0 z-[120] flex items-end bg-black/65 px-3 pb-3 pt-16 text-white"
      data-no-swipe="true"
      data-ai-core-modal="true"
      onClick={onClose}
      onTouchStart={(event) => setTouchStartY(event.touches[0]?.clientY ?? null)}
      onTouchEnd={(event) => {
        const endY = event.changedTouches[0]?.clientY;
        if (touchStartY !== null && endY && endY - touchStartY > 80) onClose();
      }}
    >
      <div
        className="mx-auto max-h-[82dvh] w-full max-w-[560px] overflow-y-auto rounded-[30px] border border-white/10 bg-[#0b1016] p-4 shadow-2xl no-scrollbar"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mx-auto mb-4 h-1.5 w-14 rounded-full bg-white/15" />

        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-[11px] uppercase tracking-[0.18em] text-white/35">
              {isSummary ? 'Операции' : 'Последние операции'}
            </div>
            <div className="mt-1 text-xl font-semibold text-white">
              {isSummary ? 'Структура месяца' : 'Быстрые действия'}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-white/10 bg-white/[0.05] text-xl text-white/75"
            aria-label="Закрыть"
          >
            ×
          </button>
        </div>

        {isSummary ? (
          <div className="mt-5 space-y-4">
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-2xl border border-white/8 bg-white/[0.04] p-3">
                <div className="text-[10px] uppercase tracking-[0.14em] text-white/32">Всего</div>
                <div className="mt-1 text-lg font-semibold text-white">{monthlyStats?.count ?? items.length}</div>
              </div>
              <div className="rounded-2xl border border-emerald-300/10 bg-emerald-400/8 p-3">
                <div className="text-[10px] uppercase tracking-[0.14em] text-white/32">Доход</div>
                <div className="mt-1 text-lg font-semibold text-emerald-300">
                  {formatMoney(monthlyStats?.income ?? 0, 'RUB', { sign: 'plus' })}
                </div>
              </div>
              <div className="rounded-2xl border border-white/8 bg-white/[0.04] p-3">
                <div className="text-[10px] uppercase tracking-[0.14em] text-white/32">Расход</div>
                <div className="mt-1 text-lg font-semibold text-white">
                  {formatMoney(monthlyStats?.expenses ?? 0, 'RUB', { sign: 'minus' })}
                </div>
              </div>
            </div>

            {monthlyStats?.topCategories?.length ? (
              <section className="rounded-[24px] border border-white/8 bg-black/18 p-3">
                <div className="text-[10px] uppercase tracking-[0.16em] text-white/35">По категориям</div>
                <div className="mt-3 space-y-2">
                  {monthlyStats.topCategories.slice(0, 6).map((category) => (
                    <div key={category.name} className="flex items-center justify-between gap-3 rounded-2xl bg-white/[0.035] px-3 py-2">
                      <div className="min-w-0 truncate text-sm text-white/82">
                        {category.icon ? `${category.icon} ` : ''}{category.name}
                      </div>
                      <div className="shrink-0 text-sm font-medium text-white">
                        {formatMoney(category.amount, 'RUB')}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            <section className="space-y-2">
              <div className="text-[10px] uppercase tracking-[0.16em] text-white/35">Последние записи</div>
              {recent.length ? recent.map((item) => <TransactionRow key={item.id} transaction={item} />) : (
                <div className="rounded-2xl border border-white/8 bg-white/[0.04] p-4 text-sm text-white/50">
                  Операций пока нет.
                </div>
              )}
            </section>
          </div>
        ) : (
          <div className="mt-5 space-y-3">
            {recent.length ? recent.map((item) => (
              <TransactionRow
                key={item.id}
                transaction={item}
                withActions
                isMutating={isMutating}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            )) : (
              <div className="rounded-2xl border border-white/8 bg-white/[0.04] p-4 text-sm text-white/50">
                Последних операций пока нет.
              </div>
            )}
          </div>
        )}

        <button
          type="button"
          onClick={onOpenAll}
          className="mt-5 w-full rounded-2xl border border-emerald-300/16 bg-emerald-400/10 px-4 py-3 text-sm font-medium text-emerald-100 active:scale-[0.99]"
        >
          Вся история
        </button>
      </div>
    </div>
  );
}

export function AICoreScreen() {
  const [historyOpen, setHistoryOpen] = useState(false);
  const [activePanelModal, setActivePanelModal] = useState<PanelModal>(null);
  const navigateTo = useNavigationStore((state) => state.navigateTo);

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

  const recentItems = useMemo(() => items.slice(0, 6), [items]);
  const latestTx = latest ?? items[0] ?? null;

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
    setActivePanelModal(null);
    openEdit(transaction);
  };

  const handleAfterConfirm = async (actionId: string) => {
    await confirmAction(actionId);
    await refreshDashboard();
  };

  const openAllHistory = () => {
    setActivePanelModal(null);
    navigateTo('transactions');
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
              aria-label="Открыть меню AI"
            >
              <span className="text-emerald-200 text-xl">⌘</span>
            </button>

            <div className="text-center">
              <div className="text-[32px] font-semibold tracking-tight leading-none">ai finance</div>
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
                onClick={() => setActivePanelModal('summary')}
                className="rounded-[26px] border border-white/10 bg-white/[0.045] p-4 text-left shadow-[0_0_40px_rgba(0,0,0,0.18)] active:scale-[0.99]"
              >
                <div className="text-[10px] uppercase tracking-[0.18em] text-white/35">Операции</div>
                <div className="mt-3 text-xl font-semibold text-white">{monthlyStats?.count ?? items.length}</div>
                <div className="mt-1 text-sm text-emerald-300">
                  {formatMoney(monthlyStats?.balance ?? 0, 'RUB', { sign: 'plus' })}
                </div>
              </button>

              <button
                type="button"
                onClick={() => setActivePanelModal('recent')}
                className="relative rounded-[26px] border border-white/10 bg-white/[0.045] p-4 text-left shadow-[0_0_40px_rgba(0,0,0,0.18)] active:scale-[0.99]"
              >
                {recentItems.length > 0 ? (
                  <span className="absolute right-3 top-3 grid h-5 min-w-5 place-items-center rounded-full bg-emerald-400 px-1 text-[11px] font-semibold text-black">
                    {Math.min(recentItems.length, 6)}
                  </span>
                ) : null}
                <div className="text-[10px] uppercase tracking-[0.18em] text-white/35">Последнее</div>
                <div className="mt-3 truncate text-lg font-semibold text-white">
                  {latestTx ? getTxTitle(latestTx) : 'Нет операций'}
                </div>
                <div className="mt-1 truncate text-sm text-white/45">
                  {latestTx ? `${getTxAmount(latestTx)} · ${formatTransactionDate(latestTx.date)}` : 'История пуста'}
                </div>
              </button>
            </div>

            <div className="flex items-center justify-between rounded-2xl border border-white/8 bg-white/[0.035] px-4 py-3">
              <div className="flex min-w-0 items-center gap-2">
                <div className="h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-400 animate-pulse" />
                <span className="truncate text-sm text-white/72">{liveText}</span>
              </div>

              {pendingActions.length > 0 ? (
                <button
                  type="button"
                  onClick={openPending}
                  className="shrink-0 rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1 text-xs text-amber-100"
                >
                  Ждёт: {pendingActions.length}
                </button>
              ) : (
                <span className="shrink-0 text-xs text-emerald-200/80">Active</span>
              )}
            </div>

            <section className="relative flex flex-col items-center justify-center py-8">
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

              <div className="mt-6 text-center">
                <div className="text-lg font-medium text-white">Зажми и говори</div>
                <div className="mt-1 text-sm text-white/38">вверх — замок, влево — отмена</div>
              </div>
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
                <div className="text-[10px] uppercase tracking-[0.18em] text-white/35">AI Response</div>
                <div className="mt-2 text-sm leading-6 text-white">{latestAssistantMessage.text}</div>
              </section>
            ) : null}

            {voiceError ? (
              <section className="rounded-2xl border border-rose-400/15 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
                Не удалось получить доступ к микрофону. Зажми сферу снова и разреши микрофон, либо используй текст.
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

      {isCommandPanelOpen && !activePanelModal ? (
        <AICoreInput value={inputValue} onChange={setInputValue} onSubmit={submit} disabled={isSending} />
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

      <CommandListSheet open={isCommandListOpen} onClose={closeCommandList} onRunCommand={runQuickCommand} />

      {activePanelModal ? (
        <AICorePanelModal
          type={activePanelModal}
          items={items}
          monthlyStats={monthlyStats}
          isMutating={isMutating}
          onClose={() => setActivePanelModal(null)}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onOpenAll={openAllHistory}
        />
      ) : null}
    </div>
  );
}
