import { useEffect, useMemo } from 'react';

import { useNavigationStore } from '@/features/navigation/model/navigation.store';
import { useTransactionsStore } from '@/features/transactions/model/transactions.store';
import { TransactionRow } from '@/features/transactions/ui/TransactionRow';
import { TransactionsSummary } from '@/features/transactions/ui/TransactionsSummary';
import { PageHeader } from '@/shared/ui/PageHeader';
import { formatMoney, formatTransactionDate } from '@/shared/lib/money';
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

          <section className="rounded-[28px] border border-white/8 bg-white/[0.04] p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[11px] uppercase tracking-[0.16em] text-white/35">
                  Recent transactions
                </div>
                <div className="mt-1 text-sm text-white/45">
                  Доходы и расходы из общей базы
                </div>
              </div>

              <button
                type="button"
                onClick={() => void loadTransactions(true)}
                className="rounded-2xl border border-white/10 bg-white/6 px-3 py-2 text-xs text-white/70 transition hover:bg-white/10"
              >
                Обновить
              </button>
            </div>

            <div className="mt-4 space-y-3">
              {isLoading ? (
                <div className="rounded-2xl border border-white/8 bg-black/20 p-4 text-sm text-white/55">
                  Загружаю операции...
                </div>
              ) : error ? (
                <div className="rounded-2xl border border-red-400/15 bg-red-400/10 p-4 text-sm text-red-100/80">
                  {error}
                </div>
              ) : transactions.length === 0 ? (
                <div className="rounded-2xl border border-white/8 bg-black/20 p-4 text-sm text-white/55">
                  Пока нет операций. Напиши в AI: “+50000 зарплата” или “кофе 350”.
                </div>
              ) : (
                transactions.map((item) => {
                  const currency = item.account?.currency || 'RUB';
                  const isIncome = item.type === 'income';
                  const isExpense = item.type === 'expense';

                  const title =
                    item.description?.trim() ||
                    item.category?.name ||
                    (isIncome
                      ? 'Доход'
                      : isExpense
                        ? 'Расход'
                        : 'Перевод');

                  const category =
                    item.type === 'transfer'
                      ? `${item.account?.name || 'Счёт'} → ${
                          item.toAccount?.name || 'Другой счёт'
                        }`
                      : `${item.category?.name || 'Без категории'} · ${
                          item.account?.name || 'Счёт'
                        }`;

                  const sign = isIncome ? 'plus' : isExpense ? 'minus' : 'none';

                  return (
                    <TransactionRow
                      key={item.id}
                      title={title}
                      category={category}
                      amount={formatMoney(Number(item.amount) || 0, currency, {
                        sign,
                      })}
                      time={formatTransactionDate(item.date)}
                      type={item.type}
                    />
                  );
                })
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}