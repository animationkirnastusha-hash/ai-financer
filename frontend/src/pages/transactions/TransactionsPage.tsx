import { useEffect, useMemo } from 'react';

import { useNavigationStore } from '@/features/navigation/model/navigation.store';
import { useTransactionsStore } from '@/features/transactions/model/transactions.store';
import { TransactionEditSheet } from '@/features/transactions/ui/TransactionEditSheet';
import { TransactionsTimeline } from '@/features/transactions/ui/TransactionsTimeline';
import { TransactionsSummary } from '@/features/transactions/ui/TransactionsSummary';
import { PageHeader } from '@/shared/ui/PageHeader';
import { EmptyState } from '@/shared/ui/EmptyState';
import { ErrorState } from '@/shared/ui/ErrorState';
import { formatMoney } from '@/shared/lib/money';

type Props = {
  onBack?: () => void;
};

function isCurrentMonth(dateValue: string) {
  const date = new Date(dateValue);
  const now = new Date();

  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth()
  );
}

export default function TransactionsPage({ onBack }: Props = {}) {
  const navigateTo = useNavigationStore((state) => state.navigateTo);

  const transactions = useTransactionsStore((state) => state.items);
  const editing = useTransactionsStore((state) => state.editing);
  const isLoading = useTransactionsStore((state) => state.isLoading);
  const isMutating = useTransactionsStore((state) => state.isMutating);
  const error = useTransactionsStore((state) => state.error);
  const loadTransactions = useTransactionsStore((state) => state.loadTransactions);
  const openEdit = useTransactionsStore((state) => state.openEdit);
  const closeEdit = useTransactionsStore((state) => state.closeEdit);
  const saveEdit = useTransactionsStore((state) => state.saveEdit);
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
      {
        income: 0,
        expenses: 0,
        foreignCount: 0,
      },
    );
  }, [transactions]);

  return (
    <div className="flex h-dvh flex-col bg-[linear-gradient(180deg,#0b1016_0%,#090d13_100%)] text-white">
      <PageHeader title="Операции" onBack={onBack} />

      <div className="flex-1 overflow-y-auto px-4 pb-28">
        <div className="mx-auto max-w-[560px] space-y-4">
          <TransactionsSummary
            expenses={formatMoney(summary.expenses, 'RUB', { sign: 'minus' })}
            income={formatMoney(summary.income, 'RUB', { sign: 'plus' })}
          />


          {summary.foreignCount > 0 ? (
            <div className="rounded-[24px] border border-amber-300/15 bg-amber-300/8 p-4 text-sm leading-6 text-amber-100/75">
              Операции в USD/EUR не смешиваются с ₽-статистикой без курса.
              Они отображаются в списке ниже отдельно.
            </div>
          ) : null}


          {error && transactions.length === 0 ? (
            <ErrorState
              title="Операции не загрузились"
              message={error}
              onRetry={() => void loadTransactions(true)}
              onOpenAI={() => navigateTo('ai-core')}
            />
          ) : !isLoading && transactions.length === 0 ? (
            <EmptyState
              eyebrow="Операции"
              title="История пока пустая"
              description="Добавь первую операцию через AI: расход, доход или перевод между счетами."
              actionLabel="Открыть AI"
              onAction={() => navigateTo('ai-core')}
            />
          ) : (
            <TransactionsTimeline
              transactions={transactions}
              isLoading={isLoading}
              error={error}
              onRefresh={() => void loadTransactions(true)}
              onOpenTransaction={openEdit}
            />
          )}
        </div>
      </div>

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
