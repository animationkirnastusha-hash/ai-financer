type Props = {
  title: string;
  category: string;
  amount: string;
  time: string;
  type?: 'income' | 'expense' | 'transfer';
};

export function TransactionRow({
  title,
  category,
  amount,
  time,
  type,
}: Props) {
  const isPositive = type === 'income' || amount.trim().startsWith('+');
  const isTransfer = type === 'transfer';

  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-white/8 bg-black/20 px-4 py-3">
      <div className="min-w-0">
        <div className="truncate text-sm font-medium text-white">{title}</div>
        <div className="mt-1 truncate text-xs text-white/48">{category}</div>
      </div>

      <div className="shrink-0 text-right">
        <div
          className={`text-sm font-medium ${
            isPositive
              ? 'text-emerald-300'
              : isTransfer
                ? 'text-sky-300'
                : 'text-white'
          }`}
        >
          {amount}
        </div>

        <div className="mt-1 text-xs text-white/42">{time}</div>
      </div>
    </div>
  );
}