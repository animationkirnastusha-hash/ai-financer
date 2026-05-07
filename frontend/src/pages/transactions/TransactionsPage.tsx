import { useEffect, useMemo } from 'react';

import { useNavigationStore } from '@/features/navigation/model/navigation.store';
import { useTransactionsStore } from '@/features/transactions/model/transactions.store';
import { TransactionsTimeline } from '@/features/transactions/ui/TransactionsTimeline';
import { TransactionsSummary } from '@/features/transactions/ui/TransactionsSummary';
import { PageHeader } from '@/shared/ui/PageHeader';
import { formatMoney } from '@/shared/lib/money';
import { PremiumInlineCard } from '@/features/premium/ui/PremiumInlineCard';
import { usePremiumStore } from '@/features/premium/model/premium.store';
type Props = {
  onBack: () => void;
};

function isCurrentMonth(dateValue: string) {
  const date = new Date(dateValue);
  const now = new Date();

  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth()
  );
}

export default function TransactionsPage({ onBack }: Props) {
  const navigateTo = useNavigationStore((s) => s.navigateTo);

  const transactions = useTransactionsStore((state) => state.items);
  const isLoading = useTransactionsStore((state) => state.isLoading);
  const error = useTransactionsStore((state) => state.error);
  const loadTransactions = useTransactionsStore((state) => state.loadTransactions);
  const openEdit = useTransactionsStore((state) => state.openEdit);
  const openPremium = usePremiumStore((state) => state.openPremium);
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
      <PageHeader title="Transactions" onBack={onBack} />

      <div className="flex-1 overflow-y-auto px-4 pb-28">
        <div className="mx-auto max-w-[560px] space-y-4">
          <TransactionsSummary
            expenses={formatMoney(summary.expenses, 'RUB', { sign: 'minus' })}
            income={formatMoney(summary.income, 'RUB', { sign: 'plus' })}
          />  
            <PremiumInlineCard
  onOpen={openPremium}
  trigger={{
    kind: 'locked_insight',
    title: 'AI может найти, где ты теряешь деньги',
    description:
      'Free показывает операции и базовые суммы. Premium разберёт повторяющиеся траты, лишние подписки и категории риска.',
    cta: 'Показать скрытые расходы',
    value:
      summary.expenses > 0
        ? `Расходы месяца: ${formatMoney(summary.expenses, 'RUB', {
            sign: 'minus',
          })}`
        : 'Добавь операции — AI начнёт анализ',
  }}
/>
          {summary.foreignCount > 0 ? (
            <div className="rounded-[24px] border border-amber-300/15 bg-amber-300/8 p-4 text-sm leading-6 text-amber-100/75">
              Операции в USD/EUR не смешиваются с ₽-статистикой без курса.
              Они отображаются в списке ниже отдельно.
            </div>
          ) : null}

          <section className="rounded-[28px] border border-white/8 bg-white/[0.04] p-4">
            <div className="text-[11px] uppercase tracking-[0.16em] text-white/35">
              AI Actions
            </div>

            <div className="mt-3 text-sm leading-6 text-white/60">
              AI может быстро показать траты за период, найти категорию или помочь добавить операцию.
            </div>

            <button
              type="button"
              onClick={() => navigateTo('ai-core')}
              className="mt-4 rounded-2xl border border-white/10 bg-white/10 px-4 py-2 text-sm transition hover:bg-white/15"
            >
              Открыть AI
            </button>
          </section>

          <TransactionsTimeline
            transactions={transactions}
            isLoading={isLoading}
            error={error}
            onRefresh={() => void loadTransactions(true)}
            onOpenTransaction={openEdit}
          />
        </div>
      </div>
    </div>
  );
}