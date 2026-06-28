type Props = {
  title: string;
  value: string | number;
  caption?: string;
};

export function MetricCard({ title, value, caption }: Props) {
  return (
    <div className="app-stat-card admin-stat-card">
      <div className="app-stat-card__label">{title}</div>
      <div className="admin-stat-card__value">{value}</div>
      {caption ? <div className="admin-stat-card__caption">{caption}</div> : null}
    </div>
  );
}
