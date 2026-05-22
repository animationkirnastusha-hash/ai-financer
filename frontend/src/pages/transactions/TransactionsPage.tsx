import { useEffect, useMemo, useState } from 'react';

import { useNavigationStore } from '@/features/navigation/model/navigation.store';
import { useTransactionsStore } from '@/features/transactions/model/transactions.store';
import { TransactionEditSheet } from '@/features/transactions/ui/TransactionEditSheet';
import { TransactionCreateSheet } from '@/features/transactions/ui/TransactionCreateSheet';
import { TransactionsTimeline } from '@/features/transactions/ui/TransactionsTimeline';
import { TransactionsSummary } from '@/features/transactions/ui/TransactionsSummary';
import { ScreenTopBar } from '@/shared/ui/ScreenTopBar';
import { EmptyState } from '@/shared/ui/EmptyState';
import { ErrorState } from '@/shared/ui/ErrorState';
import { formatMoney } from '@/shared/lib/money';

type Props = { onBack?: () => void };

function isCurrentMonth(dateValue: string) {
  const date = new Date(dateValue);
  const now = new Date();
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
}

export default function TransactionsPage({ onBack }: Props = {}) {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const navigateTo = useNavigationStore((state) => state.navigateTo);
  const openAIWithCommand = useNavigationStore((state) => state.openAIWithCommand);

  const transactions = useTransactionsStore((state) => state.items);
  const editing = useTransactionsStore((state) => state.editing);
  const isLoading = useTransactionsStore((state) => state.isLoading);
  const isMutating = useTransactionsStore((state) => state.isMutating);
  const error = useTransactionsStore((state) => state.error);
  const loadTransactions = useTransactionsStore((state) => state.loadTransactions);
  const openEdit = useTransactionsStore((state) => state.openEdit);
  const closeEdit = useTransactionsStore((state) => state.closeEdit);
  const saveEdit = useTransactionsStore((state) => state.saveEdit);
  const createItem = useTransactionsStore((state) => state.createItem);
  const deleteItem = useTransactionsStore((state) => state.deleteItem);

  useEffect(() => {
    void loadTransactions();
  }, [loadTransactions]);

  const summary = useMemo(() => {
    return transactions.reduce(
      (acc, item) => {
        if (!isCurrentMonth(item.date)) return acc;
        const amount = Number(item.amount) || 0;
        const currency = item.account?.currency || 'RUB';
        if (currency !== 'RUB') {
          acc.foreignCount += 1;
          return acc;
        }
        if (item.type === 'income') acc.income += amount;
        if (item.type === 'expense') acc.expenses += amount;
        return acc;
      },
      { income: 0, expenses: 0, foreignCount: 0 },
    );
  }, [transactions]);

  return (
    <div className="app-page text-white">
      <div className="app-page__inner space-y-4">
        <ScreenTopBar title="Операции" left={onBack ? 'back' : 'commands'} right={['settings']} />

        <header className="app-card app-card--hero">
          <div className="app-eyebrow">Лента</div>
          <div className="mt-3 flex items-end justify-between gap-4">
            <div>
              <h1 className="text-[32px] font-semibold leading-none tracking-[-0.055em]">Операции</h1>
              <p className="mt-2 text-sm text-white/46">Доходы, расходы и переводы.</p>
            </div>
            <button type="button" onClick={() => setIsCreateOpen(true)} className="app-primary-button shrink-0">Добавить</button>
          </div>
        </header>

        <TransactionsSummary
          expenses={formatMoney(summary.expenses, 'RUB', { sign: 'minus' })}
          income={formatMoney(summary.income, 'RUB', { sign: 'plus' })}
        />

        {summary.foreignCount > 0 ? (
          <div className="rounded-[24px] border border-amber-300/15 bg-amber-300/8 p-4 text-sm leading-6 text-amber-100/75">
            Операции в другой валюте не включены в ₽-итоги.
          </div>
        ) : null}

        {error && transactions.length === 0 ? (
          <ErrorState title="Операции не загрузились" message={error} onRetry={() => void loadTransactions(true)} onOpenAI={() => navigateTo('ai-core')} />
        ) : !isLoading && transactions.length === 0 ? (
          <EmptyState
            eyebrow="Операции"
            title="История пока пустая"
            description="Добавь первую операцию через AI: расход, доход или перевод."
            actionLabel="Открыть AI"
            onAction={() => openAIWithCommand()}
          />
        ) : (
          <TransactionsTimeline transactions={transactions} isLoading={isLoading} error={error} onRefresh={() => void loadTransactions(true)} onOpenTransaction={openEdit} />
        )}
      </div>

      <TransactionCreateSheet
        open={isCreateOpen}
        isSaving={isMutating}
        onClose={() => setIsCreateOpen(false)}
        onSave={async (payload) => {
          await createItem(payload);
          setIsCreateOpen(false);
        }}
      />

      <TransactionEditSheet
        open={Boolean(editing)}
        transaction={editing}
        isSaving={isMutating}
        onClose={closeEdit}
        onSave={saveEdit}
        onDelete={async (transaction) => {
          await deleteItem(transaction);
          closeEdit();
        }}
        onOpenAI={() => {
          closeEdit();
          navigateTo('ai-core');
        }}
      />
    </div>
  );
}
