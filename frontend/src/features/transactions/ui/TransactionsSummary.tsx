type Props = {
  expenses: string;
  income: string;
};

export function TransactionsSummary({ expenses, income }: Props) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="app-stat-card app-stat-card--large">
        <div className="app-stat-card__label">Доходы</div>
        <div className="app-stat-card__money app-stat-card__money--positive">{income}</div>
        <div className="mt-2 text-xs text-white/42">За месяц</div>
      </div>

      <div className="app-stat-card app-stat-card--large">
        <div className="app-stat-card__label">Расходы</div>
        <div className="app-stat-card__money">{expenses}</div>
        <div className="mt-2 text-xs text-white/42">За месяц</div>
      </div>
    </div>
  );
}
