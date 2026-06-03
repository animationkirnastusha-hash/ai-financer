import type { TransactionDto } from '@/features/transactions/api/transactions.api';
import type { HomeFinanceGroup } from '@/features/dashboard/lib/homeFinanceAnalytics';
import { formatMoney, formatTransactionDate } from '@/shared/lib/money';

function operationTitle(transaction: TransactionDto) {
  return transaction.description || transaction.category?.name || 'Операция';
}

type Props = {
  group: HomeFinanceGroup | null;
  onClose: () => void;
  onEdit: (transaction: TransactionDto) => void;
};

export function HomeCategoryOperationsModal({ group, onClose, onEdit }: Props) {
  if (!group) return null;

  const sorted = [...group.transactions].sort((a, b) => Number(b.amount || 0) - Number(a.amount || 0));

  return (
    <div className="app-modal-backdrop app-home-chart-backdrop" data-no-swipe="true" onClick={onClose}>
      <div className="app-modal-sheet app-home-category-modal" data-no-swipe="true" onClick={(event) => event.stopPropagation()}>
        <div className="app-modal-handle" />
        <div className="app-modal-body">
          <div className="app-home-chart-modal__head">
            <div>
              <div className="app-eyebrow">{group.sectionName}</div>
              <h2>{group.name}</h2>
              <p>{group.count} опер. · {formatMoney(group.amount, 'RUB')}</p>
            </div>
            <button type="button" className="app-icon-button" onClick={onClose} aria-label="Закрыть">×</button>
          </div>

          <div className="app-home-category-operation-list">
            {sorted.map((transaction) => {
              const sign = transaction.type === 'income' ? 'plus' : transaction.type === 'expense' ? 'minus' : 'none';
              return (
                <button key={transaction.id} type="button" className="app-transaction-row" onClick={() => onEdit(transaction)}>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-white">{operationTitle(transaction)}</div>
                    <div className="mt-1 truncate text-xs text-white/40">{formatTransactionDate(transaction.date)} · {transaction.account?.name ?? 'Счёт'}</div>
                  </div>
                  <div className="shrink-0 text-sm font-semibold text-white">{formatMoney(transaction.amount, transaction.account?.currency ?? 'RUB', { sign })}</div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
