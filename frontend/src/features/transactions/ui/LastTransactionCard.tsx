import type { TransactionDto } from '@/features/transactions/api/transactions.api';
import { Button } from '@/shared/ui/Button';
import { formatMoney, formatTransactionDate } from '@/shared/lib/money';

type Props = {
  transaction: TransactionDto | null;
  isMutating?: boolean;
  onOpenHistory: () => void;
  onEdit: (transaction: TransactionDto) => void;
  onDelete: (transaction: TransactionDto) => void;
  compact?: boolean;
};

function getTitle(transaction: TransactionDto) {
  if (transaction.type === 'transfer') {
    return `${transaction.account?.name ?? 'Счёт'} → ${transaction.toAccount?.name ?? 'Счёт'}`;
  }

  return transaction.category?.name || transaction.description || 'Операция';
}

function getIcon(transaction: TransactionDto) {
  if (transaction.type === 'income') return transaction.category?.icon ?? '💰';
  if (transaction.type === 'transfer') return '↔️';
  return transaction.category?.icon ?? '📝';
}

export function LastTransactionCard({
  transaction,
  isMutating = false,
  onOpenHistory,
  onEdit,
  onDelete,
  compact = false,
}: Props) {
  const shellClass = compact
    ? 'ai-page-card-compact h-full min-h-[148px]'
    : 'mx-4 mb-3 rounded-[24px] border border-white/8 bg-white/[0.045] p-4 shadow-xl shadow-black/20';

  if (!transaction) {
    return (
      <div className={shellClass}>
        <div className="text-[10px] uppercase tracking-[0.16em] text-white/35">Последняя</div>
        <div className="mt-3 text-sm leading-5 text-white/62">Пока пусто</div>
        <button
          type="button"
          className="mt-4 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-white/72"
          onClick={onOpenHistory}
        >
          История
        </button>
      </div>
    );
  }

  const currency = transaction.account?.currency ?? 'RUB';
  const amountSign =
    transaction.type === 'income' ? 'plus' : transaction.type === 'expense' ? 'minus' : 'none';
  const deleteLabel = transaction.type === 'income' ? 'Удалить' : 'Отменить';

  if (compact) {
    return (
      <div className={shellClass}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-[0.16em] text-white/35">Последняя</div>
            <div className="mt-3 truncate text-sm font-semibold text-white">{getTitle(transaction)}</div>
            <div className="mt-1 truncate text-xs text-white/42">
              {transaction.account?.name ?? 'Счёт'} · {formatTransactionDate(transaction.date)}
            </div>
          </div>
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-2xl bg-white/8 text-base">
            {getIcon(transaction)}
          </span>
        </div>

        <div className="mt-4 flex items-end justify-between gap-2">
          <div className="min-w-0 text-xl font-semibold tracking-[-0.04em] text-white">
            {formatMoney(transaction.amount, currency, { sign: amountSign })}
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={() => onEdit(transaction)}
              className="grid h-9 w-9 place-items-center rounded-full border border-white/8 bg-white/[0.05] text-sm text-white/72"
              aria-label="Изменить"
            >
              ✎
            </button>
            <button
              type="button"
              disabled={isMutating}
              onClick={() => onDelete(transaction)}
              className="grid h-9 w-9 place-items-center rounded-full border border-white/8 bg-white/[0.05] text-sm text-white/72 disabled:opacity-40"
              aria-label={deleteLabel}
            >
              ×
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={shellClass}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-[0.16em] text-white/35">
            Последняя операция
          </div>
          <div className="mt-2 flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-2xl bg-white/8 text-lg">
              {getIcon(transaction)}
            </span>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-white">{getTitle(transaction)}</div>
              <div className="mt-0.5 truncate text-xs text-white/45">
                {transaction.account?.name ?? 'Счёт'} · {formatTransactionDate(transaction.date)}
              </div>
            </div>
          </div>
        </div>

        <div className="shrink-0 text-right">
          <div className={transaction.type === 'income' ? 'text-sm font-semibold text-emerald-300' : 'text-sm font-semibold text-white'}>
            {formatMoney(transaction.amount, currency, { sign: amountSign })}
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <Button className="h-9 px-2 text-xs" variant="secondary" onClick={() => onEdit(transaction)}>
          Изменить
        </Button>
        <Button
          className="h-9 px-2 text-xs"
          variant="secondary"
          disabled={isMutating}
          onClick={() => onDelete(transaction)}
        >
          {deleteLabel}
        </Button>
        <Button className="h-9 px-2 text-xs" variant="ghost" onClick={onOpenHistory}>
          История
        </Button>
      </div>
    </div>
  );
}
