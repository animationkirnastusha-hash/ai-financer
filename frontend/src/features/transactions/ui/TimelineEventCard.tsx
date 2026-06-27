import type { TransactionDto } from '@/features/transactions/api/transactions.api';
import { formatMoney, formatTransactionDate } from '@/shared/lib/money';

type Props = {
  transaction: TransactionDto;
  onClick?: (transaction: TransactionDto) => void;
};

function getTitle(transaction: TransactionDto) {
  if (transaction.description?.trim()) return transaction.description.trim();
  if (transaction.category?.name) return transaction.category.name;
  if (transaction.type === 'income') return 'Доход';
  if (transaction.type === 'transfer') return 'Перевод';
  return 'Расход';
}

function getTone(transaction: TransactionDto) {
  if (transaction.type === 'income') return 'timeline-event-card__amount--income';
  if (transaction.type === 'transfer') return 'timeline-event-card__amount--transfer';
  return '';
}

function getAmountSign(transaction: TransactionDto): 'plus' | 'minus' | 'none' {
  if (transaction.type === 'income') return 'plus';
  if (transaction.type === 'expense') return 'minus';
  return 'none';
}

export function TimelineEventCard({ transaction, onClick }: Props) {
  const currency = transaction.account?.currency || 'RUB';
  const categoryName = transaction.category?.name || 'Без категории';
  const accountName = transaction.account?.name || 'Счёт';
  const toAccountName = transaction.toAccount?.name;
  const isAiGenerated = Boolean(transaction.isAIGenerated);

  const meta =
    transaction.type === 'transfer'
      ? `${accountName} → ${toAccountName || 'другой счёт'}`
      : `${categoryName} · ${accountName}`;

  return (
    <button
      type="button"
      onClick={() => onClick?.(transaction)}
      className="timeline-event-card group"
    >
      <div className="timeline-event-card__shine" />

      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-white/10 bg-white/8 px-2.5 py-1 text-[11px] font-medium text-white/72">
              {categoryName}
            </span>

            {isAiGenerated ? (
              <span className="rounded-full border border-violet-300/15 bg-violet-300/10 px-2.5 py-1 text-[11px] font-medium text-violet-100/80">
                Фина
              </span>
            ) : null}
          </div>

          <div className="mt-3 truncate text-[15px] font-semibold text-white">
            {getTitle(transaction)}
          </div>

          <div className="mt-1 truncate text-xs text-white/45">{meta}</div>

          <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-white/36">
            <span>{formatTransactionDate(transaction.date)}</span>
            {transaction.type !== 'transfer' ? <span>•</span> : null}
            {transaction.type !== 'transfer' ? <span>{categoryName}</span> : null}
          </div>
        </div>

        <div className="shrink-0 text-right">
          <div className={`timeline-event-card__amount ${getTone(transaction)}`.trim()}>
            {formatMoney(Number(transaction.amount) || 0, currency, {
              sign: getAmountSign(transaction),
            })}
          </div>
        </div>
      </div>
    </button>
  );
}
