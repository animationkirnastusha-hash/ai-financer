type Props = {
  expenses: string;
  income: string;
};

export function TransactionsSummary({ expenses, income }: Props) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div className="rounded-[28px] border border-white/8 bg-white/[0.04] p-4">
        <div className="text-[11px] uppercase tracking-[0.16em] text-white/35">
          Income
        </div>
        <div className="mt-3 text-2xl font-semibold text-emerald-300">
          {income}
        </div>
        <div className="mt-2 text-sm text-white/55">За текущий месяц</div>
      </div>

      <div className="rounded-[28px] border border-white/8 bg-white/[0.04] p-4">
        <div className="text-[11px] uppercase tracking-[0.16em] text-white/35">
          Expenses
        </div>
        <div className="mt-3 text-2xl font-semibold text-white">
          {expenses}
        </div>
        <div className="mt-2 text-sm text-white/55">Под контролем AI</div>
      </div>
    </div>
  );
}