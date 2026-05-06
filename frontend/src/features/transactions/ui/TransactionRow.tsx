type Props = {
  title: string;
  category: string;
  amount: string;
  time: string;
  type?: 'income' | 'expense' | 'transfer';
  onClick?: () => void;
  onDelete?: () => void;
};

export function TransactionRow({ title, category, amount, time, type, onClick, onDelete }: Props) {
  const isPositive = type === 'income' || amount.trim().startsWith('+');
  const isTransfer = type === 'transfer';

  return (
    <div className="group relative overflow-hidden rounded-2xl">
      <button
        type="button"
        onClick={onClick}
        className="flex w-full items-center justify-between gap-4 rounded-2xl border border-white/8 bg-black/20 px-4 py-3 text-left transition duration-200 active:scale-[0.985] group-hover:translate-x-[-4px] group-hover:bg-white/[0.04]"
      >
        <div className="min-w-0">
          <div className="truncate text-sm font-medium text-white">{title}</div>
          <div className="mt-1 truncate text-xs text-white/48">{category}</div>
        </div>

        <div className="shrink-0 text-right">
          <div className={`text-sm font-medium ${isPositive ? 'text-emerald-300' : isTransfer ? 'text-sky-300' : 'text-white'}`}>
            {amount}
          </div>
          <div className="mt-1 text-xs text-white/42">{time}</div>
        </div>
      </button>

      {onDelete ? (
        <button
          type="button"
          onClick={onDelete}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-xl border border-red-300/15 bg-red-400/15 px-3 py-2 text-xs text-red-100 opacity-0 transition group-hover:opacity-100"
        >
          Удалить
        </button>
      ) : null}
    </div>
  );
}
