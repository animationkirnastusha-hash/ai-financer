import type { TransactionDto } from '@/features/transactions/api/transactions.api';
import { Drawer } from '@/shared/ui/Drawer';
import { Button } from '@/shared/ui/Button';
import { formatMoney, formatTransactionDate } from '@/shared/lib/money';

type Props = {
  open: boolean;
  items: TransactionDto[];
  isMutating?: boolean;
  onClose: () => void;
  onEdit: (transaction: TransactionDto) => void;
  onDelete: (transaction: TransactionDto) => void;
};

function titleOf(transaction: TransactionDto) {
  if (transaction.type === 'transfer') {
    return `${transaction.account?.name ?? 'Счёт'} → ${transaction.toAccount?.name ?? 'Счёт'}`;
  }

  return transaction.category?.name || transaction.description || 'Операция';
}

function iconOf(transaction: TransactionDto) {
  if (transaction.type === 'transfer') return '↔️';
  if (transaction.type === 'income') return transaction.category?.icon ?? '💰';
  return transaction.category?.icon ?? '📝';
}

export function TransactionsHistoryDrawer({
  open,
  items,
  isMutating = false,
  onClose,
  onEdit,
  onDelete,
}: Props) {
  return (
    <Drawer open={open} onClose={onClose} title="История операций" className="max-h-[86dvh] overflow-hidden">
      <div className="max-h-[68dvh] space-y-2 overflow-y-auto pr-1">
        {items.length === 0 ? (
          <div className="rounded-2xl border border-white/8 bg-white/[0.04] p-4 text-sm text-white/60">
            Пока нет операций. Напиши AI: «кофе 300».
          </div>
        ) : null}

        {items.map((transaction) => {
          const currency = transaction.account?.currency ?? 'RUB';
          const sign = transaction.type === 'income' ? 'plus' : transaction.type === 'expense' ? 'minus' : 'none';

          return (
            <div key={transaction.id} className="rounded-2xl border border-white/8 bg-black/20 p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-2xl bg-white/8 text-lg">
                    {iconOf(transaction)}
                  </span>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-white">{titleOf(transaction)}</div>
                    <div className="mt-0.5 truncate text-xs text-white/45">
                      {transaction.account?.name ?? 'Счёт'} · {formatTransactionDate(transaction.date)}
                    </div>
                  </div>
                </div>

                <div className="shrink-0 text-right text-sm font-semibold text-white">
                  {formatMoney(transaction.amount, currency, { sign })}
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <Button className="h-9 text-xs" variant="secondary" onClick={() => onEdit(transaction)}>
                  Изменить
                </Button>
                <Button
                  className="h-9 text-xs"
                  variant="ghost"
                  disabled={isMutating}
                  onClick={() => onDelete(transaction)}
                >
                  {transaction.type === 'income' ? 'Удалить' : 'Отменить'}
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </Drawer>
  );
}
