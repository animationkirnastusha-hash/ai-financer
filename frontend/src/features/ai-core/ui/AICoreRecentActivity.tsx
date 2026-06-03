import { useTransactionsStore } from '@/features/transactions/model/transactions.store';
import { useNavigationStore } from '@/features/navigation/model/navigation.store';
import { formatMoney, formatTransactionDate } from '@/shared/lib/money';

export function AICoreRecentActivity() {
  const transactions = useTransactionsStore((state) => state.items);
  const navigateTo = useNavigationStore((state) => state.navigateTo);

  const recent = transactions.slice(0, 3);

  return (
    <section className="rounded-[26px] border border-white/10 bg-white/[0.04] p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-[11px] uppercase tracking-[0.18em] text-white/38">
          Последние действия
        </div>

        <button
          type="button"
          onClick={() => navigateTo('analytics')}
          className="text-xs text-emerald-200/80"
        >
          Все ›
        </button>
      </div>

      {recent.length === 0 ? (
        <div className="rounded-2xl border border-white/8 bg-black/20 p-4 text-sm text-white/50">
          Пока нет операций. Попробуй: “кофе 350” или “+50000 зарплата”.
        </div>
      ) : (
        <div className="space-y-2">
          {recent.map((item) => {
            const isIncome = item.type === 'income';
            const isExpense = item.type === 'expense';
            const currency = item.account?.currency || 'RUB';

            return (
              <div
                key={item.id}
                className="flex items-center justify-between gap-3 rounded-2xl border border-white/8 bg-black/20 px-3 py-3"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-white">
                    {item.description || item.category?.name || 'Операция'}
                  </div>

                  <div className="mt-1 text-xs text-white/42">
                    {formatTransactionDate(item.date)} ·{' '}
                    {item.account?.name || 'Счёт'}
                  </div>
                </div>

                <div
                  className={`shrink-0 text-sm font-medium ${
                    isIncome ? 'text-emerald-300' : 'text-white'
                  }`}
                >
                  {formatMoney(Number(item.amount) || 0, currency, {
                    sign: isIncome ? 'plus' : isExpense ? 'minus' : 'none',
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}