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
type Filter = 'all' | 'expense' | 'income' | 'transfer';

function isCurrentMonth(dateValue: string) {
  const date = new Date(dateValue);
  const now = new Date();
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
}

function filterLabel(filter: Filter) {
  if (filter === 'expense') return 'Расходы';
  if (filter === 'income') return 'Доходы';
  if (filter === 'transfer') return 'Переводы';
  return 'Все';
}

export default function TransactionsPage({ onBack }: Props = {}) {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');
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
        if (item.type === 'transfer') acc.transfers += 1;
        return acc;
      },
      { income: 0, expenses: 0, transfers: 0, foreignCount: 0 },
    );
  }, [transactions]);

  const filteredTransactions = useMemo(() => {
    if (filter === 'all') return transactions;
    return transactions.filter((transaction) => transaction.type === filter);
  }, [filter, transactions]);

  const balance = summary.income - summary.expenses;
  const insight = transactions.length === 0
    ? 'Добавь первую операцию голосом или вручную — здесь появится лента.'
    : balance >= 0
      ? `За месяц плюс ${formatMoney(balance, 'RUB')}. Следи, чтобы регулярные расходы не съедали запас.`
      : `За месяц минус ${formatMoney(Math.abs(balance), 'RUB')}. Проверь крупные категории расходов.`;

  return (
    <div className="app-page app-operations-page text-white">
      <div className="app-page__inner space-y-4">
        <ScreenTopBar title="Операции" left={onBack ? 'back' : 'menu'} right={['settings']} />

        <header className="app-card app-card--hero">
          <div className="app-eyebrow">Лента</div>
          <div className="app-operations-hero__top mt-3">
            <div className="min-w-0">
              <h1 className="app-hero-title">Операции</h1>
              <p className="app-hero-caption">Доходы, расходы и переводы в одном месте.</p>
            </div>
            <button type="button" onClick={() => setIsCreateOpen(true)} className="app-primary-button shrink-0">Добавить</button>
          </div>
        </header>

        <TransactionsSummary
          expenses={formatMoney(summary.expenses, 'RUB', { sign: 'minus' })}
          income={formatMoney(summary.income, 'RUB', { sign: 'plus' })}
        />

        <section className="app-operations-insight">
          <b>Короткий итог</b>
          <span>{insight}</span>
        </section>

        <div className="app-operations-filters" data-no-swipe="true">
          {(['all', 'expense', 'income', 'transfer'] as Filter[]).map((item) => (
            <button key={item} type="button" onClick={() => setFilter(item)} className={filter === item ? 'app-filter-pill app-filter-pill--active' : 'app-filter-pill'}>
              {filterLabel(item)}
            </button>
          ))}
        </div>

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
            description="Добавь первую операцию через Фину: расход, доход или перевод."
            actionLabel="Открыть Фину"
            onAction={() => openAIWithCommand()}
          />
        ) : (
          <TransactionsTimeline transactions={filteredTransactions} isLoading={isLoading} error={error} onRefresh={() => void loadTransactions(true)} onOpenTransaction={openEdit} />
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
