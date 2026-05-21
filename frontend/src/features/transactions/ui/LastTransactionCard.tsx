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
  if (transaction.type === 'transfer') return `${transaction.account?.name ?? 'Счёт'} → ${transaction.toAccount?.name ?? 'Счёт'}`;
  return transaction.category?.name || transaction.description || 'Операция';
}

function getIcon(transaction: TransactionDto) {
  if (transaction.type === 'income') return transaction.category?.icon ?? '💰';
  if (transaction.type === 'transfer') return '↔️';
  return transaction.category?.icon ?? '📝';
}

export function LastTransactionCard({ transaction, isMutating = false, onOpenHistory, onEdit, onDelete, compact = false }: Props) {
  const shellClass = compact ? 'ai-page-card-compact min-h-[148px]' : 'app-card';

  if (!transaction) {
    return (
      <div className={shellClass}>
        <div className="app-eyebrow">Последняя</div>
        <div className={compact ? 'mt-3 text-xs leading-5 text-white/54' : 'mt-2 text-sm text-white/70'}>Пока нет операций.</div>
        {!compact ? <Button className="mt-3 h-9" variant="secondary" onClick={onOpenHistory}>История</Button> : null}
      </div>
    );
  }

  const currency = transaction.account?.currency ?? 'RUB';
  const amountSign = transaction.type === 'income' ? 'plus' : transaction.type === 'expense' ? 'minus' : 'none';
  const deleteLabel = transaction.type === 'income' ? 'Удалить' : 'Отменить';

  if (compact) {
    return (
      <div className={shellClass}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="app-eyebrow">Последняя</div>
            <div className="mt-3 truncate text-sm font-semibold text-white">{getTitle(transaction)}</div>
            <div className="mt-1 truncate text-xs text-white/42">{transaction.account?.name ?? 'Счёт'} · {formatTransactionDate(transaction.date)}</div>
          </div>
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl bg-white/8 text-base">{getIcon(transaction)}</span>
        </div>

        <div className="mt-3 flex items-end justify-between gap-2">
          <div className="min-w-0 break-words text-[24px] font-semibold leading-none tracking-[-0.06em] text-white">
            {formatMoney(transaction.amount, currency, { sign: amountSign })}
          </div>
          <div className="flex shrink-0 gap-2">
            <button type="button" onClick={() => onEdit(transaction)} className="grid h-9 w-9 place-items-center rounded-full border border-white/8 bg-white/[0.05] text-sm text-white/72" aria-label="Изменить">✎</button>
            <button type="button" disabled={isMutating} onClick={() => onDelete(transaction)} className="grid h-9 w-9 place-items-center rounded-full border border-white/8 bg-white/[0.05] text-lg text-white/72 disabled:opacity-40" aria-label={deleteLabel}>×</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={shellClass}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="app-eyebrow">Последняя операция</div>
          <div className="mt-3 flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-white/8 text-lg">{getIcon(transaction)}</span>
            <div className="min-w-0">
              <div className="truncate text-base font-semibold text-white">{getTitle(transaction)}</div>
              <div className="mt-0.5 truncate text-xs text-white/45">{transaction.account?.name ?? 'Счёт'} · {formatTransactionDate(transaction.date)}</div>
            </div>
          </div>
        </div>
        <div className={transaction.type === 'income' ? 'shrink-0 text-right text-sm font-semibold text-emerald-300' : 'shrink-0 text-right text-sm font-semibold text-white'}>{formatMoney(transaction.amount, currency, { sign: amountSign })}</div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <Button className="h-9 px-2 text-xs" variant="secondary" onClick={() => onEdit(transaction)}>Изменить</Button>
        <Button className="h-9 px-2 text-xs" variant="secondary" disabled={isMutating} onClick={() => onDelete(transaction)}>{deleteLabel}</Button>
        <Button className="h-9 px-2 text-xs" variant="ghost" onClick={onOpenHistory}>История</Button>
      </div>
    </div>
  );
}
