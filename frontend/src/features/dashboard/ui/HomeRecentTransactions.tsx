import type { TransactionDto } from '@/features/transactions/api/transactions.api';
import { formatMoney, formatTransactionDate } from '@/shared/lib/money';

function titleOf(transaction: TransactionDto) {
  if (transaction.type === 'transfer') return `${transaction.account?.name ?? 'Счёт'} → ${transaction.toAccount?.name ?? 'Счёт'}`;
  return transaction.category?.name || transaction.description || 'Операция';
}

type Props = {
  items: TransactionDto[];
  onOpenTransactions: () => void;
  onCreateFirst: () => void;
};

export function HomeRecentTransactions({ items, onOpenTransactions, onCreateFirst }: Props) {
  return (
    <section className="app-card app-home-recent-card">
      <div className="flex items-center justify-between gap-3">
        <div className="app-section-title">Недавнее</div>
        <button type="button" onClick={onOpenTransactions} className="text-sm text-emerald-100/72">Все</button>
      </div>

      <div className="mt-4 space-y-2">
        {items.length === 0 ? (
          <button type="button" onClick={onCreateFirst} className="app-empty-button">Записать первую операцию</button>
        ) : (
          items.map((transaction) => {
            const sign = transaction.type === 'income' ? 'plus' : transaction.type === 'expense' ? 'minus' : 'none';
            return (
              <button key={transaction.id} type="button" onClick={onOpenTransactions} className="app-transaction-row">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-white">{titleOf(transaction)}</div>
                  <div className="mt-1 truncate text-xs text-white/40">{formatTransactionDate(transaction.date)} · {transaction.account?.name ?? 'Счёт'}</div>
                </div>
                <div className="shrink-0 text-sm font-semibold text-white">{formatMoney(transaction.amount, transaction.account?.currency ?? 'RUB', { sign })}</div>
              </button>
            );
          })
        )}
      </div>
    </section>
  );
}
