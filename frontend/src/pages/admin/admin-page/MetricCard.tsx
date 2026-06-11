type Props = {
  title: string;
  value: string | number;
  caption?: string;
};

export function MetricCard({ title, value, caption }: Props) {
  return (
    <div className="app-stat-card">
      <div className="app-stat-card__label">{title}</div>
      <div className="mt-2 text-2xl font-semibold tracking-[-0.04em]">{value}</div>
      {caption ? <div className="mt-1 text-xs text-white/42">{caption}</div> : null}
    </div>
  );
}
