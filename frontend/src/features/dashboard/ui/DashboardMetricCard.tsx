type Props = {
  label: string;
  value: string;
  hint?: string;
};

export function DashboardMetricCard({ label, value, hint }: Props) {
  return (
    <div className="rounded-[28px] border border-white/8 bg-white/[0.04] p-4 backdrop-blur-xl">
      <div className="text-[11px] uppercase tracking-[0.16em] text-white/35">
        {label}
      </div>

      <div className="mt-3 text-2xl font-semibold text-white">{value}</div>

      {hint ? (
        <div className="mt-2 text-sm text-white/55">{hint}</div>
      ) : null}
    </div>
  );
}