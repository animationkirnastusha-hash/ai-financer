type Props = {
  name: string;
  balance: string;
  hint?: string;
  currency?: string;
  isPrimary?: boolean;
  isIncomeDefault?: boolean;
  onClick?: () => void;
};

export function AccountCard({
  name,
  balance,
  hint,
  currency,
  isPrimary,
  isIncomeDefault,
  onClick,
}: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-[28px] border border-white/8 bg-white/[0.04] p-4 text-left transition active:scale-[0.99] hover:bg-white/[0.07]"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <div className="truncate text-sm font-medium text-white">{name}</div>

            {currency ? (
              <span className="rounded-full border border-white/10 bg-white/6 px-2 py-0.5 text-[10px] text-white/50">
                {currency}
              </span>
            ) : null}
          </div>

          {hint ? <div className="mt-1 text-xs text-white/50">{hint}</div> : null}

          <div className="mt-3 flex flex-wrap gap-2">
            {isPrimary ? (
              <span className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-2.5 py-1 text-[11px] text-emerald-100">
                Главный
              </span>
            ) : null}

            {isIncomeDefault ? (
              <span className="rounded-full border border-sky-300/20 bg-sky-300/10 px-2.5 py-1 text-[11px] text-sky-100">
                Доход сюда
              </span>
            ) : null}
          </div>
        </div>

        <div className="shrink-0 text-right text-lg font-semibold text-white">
          {balance}
        </div>
      </div>
    </button>
  );
}