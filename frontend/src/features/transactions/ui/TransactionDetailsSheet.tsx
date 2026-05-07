import type { TransactionDto } from '@/features/transactions/api/transactions.api';
import { Button } from '@/shared/ui/Button';
import { Drawer } from '@/shared/ui/Drawer';
import { formatMoney, formatTransactionDate } from '@/shared/lib/money';

type Props = {
  open: boolean;
  transaction: TransactionDto | null;
  isMutating?: boolean;
  onClose: () => void;
  onEdit: (transaction: TransactionDto) => void;
  onDelete: (transaction: TransactionDto) => void;
  onRepeat?: (transaction: TransactionDto) => void;
};

function getTitle(transaction: TransactionDto) {
  if (transaction.type === 'transfer') {
    return `${transaction.account?.name ?? 'Счёт'} → ${transaction.toAccount?.name ?? 'Счёт'}`;
  }

  return transaction.description || transaction.category?.name || 'Операция';
}

function getIcon(transaction: TransactionDto) {
  if (transaction.type === 'income') return transaction.category?.icon ?? '💰';
  if (transaction.type === 'transfer') return '↔️';
  return transaction.category?.icon ?? '📝';
}

export function TransactionDetailsSheet({
  open,
  transaction,
  isMutating = false,
  onClose,
  onEdit,
  onDelete,
  onRepeat,
}: Props) {
  if (!transaction) return null;

  const currency = transaction.account?.currency ?? 'RUB';
  const sign = transaction.type === 'income' ? 'plus' : transaction.type === 'expense' ? 'minus' : 'none';

  return (
    <Drawer open={open} onClose={onClose} title="Детали операции" className="max-h-[86dvh] overflow-y-auto">
      <div className="space-y-4">
        <div className="rounded-[24px] border border-white/8 bg-white/[0.04] p-4">
          <div className="flex items-start gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-white/8 text-xl">
              {getIcon(transaction)}
            </div>

            <div className="min-w-0 flex-1">
              <div className="truncate text-lg font-semibold text-white">{getTitle(transaction)}</div>
              <div className="mt-1 text-sm text-white/45">{formatTransactionDate(transaction.date)}</div>
            </div>

            <div className="text-right text-lg font-semibold text-white">
              {formatMoney(transaction.amount, currency, { sign })}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="rounded-2xl border border-white/8 bg-black/20 p-3">
            <div className="text-white/35">Счёт</div>
            <div className="mt-1 text-white">{transaction.account?.name ?? 'Счёт'}</div>
          </div>

          <div className="rounded-2xl border border-white/8 bg-black/20 p-3">
            <div className="text-white/35">Категория</div>
            <div className="mt-1 text-white">{transaction.category?.name ?? 'Без категории'}</div>
          </div>

          {transaction.type === 'transfer' ? (
            <div className="col-span-2 rounded-2xl border border-white/8 bg-black/20 p-3">
              <div className="text-white/35">Куда</div>
              <div className="mt-1 text-white">{transaction.toAccount?.name ?? 'Другой счёт'}</div>
            </div>
          ) : null}
        </div>

        <div className="grid grid-cols-3 gap-2 pt-1">
          <Button variant="secondary" onClick={() => onEdit(transaction)} disabled={isMutating}>
            Изменить
          </Button>
          <Button variant="ghost" onClick={() => onRepeat?.(transaction)} disabled={isMutating || !onRepeat}>
            Повторить
          </Button>
          <Button variant="ghost" onClick={() => onDelete(transaction)} disabled={isMutating}>
            {transaction.type === 'income' ? 'Удалить' : 'Отменить'}
          </Button>
        </div>
      </div>
    </Drawer>
  );
}
