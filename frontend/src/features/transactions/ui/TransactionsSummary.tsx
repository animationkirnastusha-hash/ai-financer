type Props = {
  expenses: string;
  income: string;
};

export function TransactionsSummary({ expenses, income }: Props) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="rounded-[24px] border border-white/8 bg-white/[0.04] p-4">
        <div className="text-[10px] uppercase tracking-[0.16em] text-white/35">
          Доходы
        </div>
        <div className="mt-3 text-xl font-semibold text-emerald-300">
          {income}
        </div>
        <div className="mt-2 text-xs text-white/50">За месяц</div>
      </div>

      <div className="rounded-[24px] border border-white/8 bg-white/[0.04] p-4">
        <div className="text-[10px] uppercase tracking-[0.16em] text-white/35">
          Расходы
        </div>
        <div className="mt-3 text-xl font-semibold text-white">
          {expenses}
        </div>
        <div className="mt-2 text-xs text-white/50">За месяц</div>
      </div>
    </div>
  );
}
