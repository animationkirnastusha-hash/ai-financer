type Props = {
  total: string;
};

export function AccountsSummary({ total }: Props) {
  return (
    <div className="rounded-[32px] border border-emerald-400/15 bg-emerald-400/10 p-5">
      <div className="text-[11px] uppercase tracking-[0.18em] text-emerald-300/70">
        Total balance
      </div>

      <div className="mt-3 text-3xl font-semibold text-white">
        {total}
      </div>

      <div className="mt-2 text-sm text-white/60">
        Все счета объединены
      </div>
    </div>
  );
}