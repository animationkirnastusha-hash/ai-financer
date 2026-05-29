type Props = {
  hasTransactions: boolean;
  expenses: number;
  income: number;
  onOpenAnalytics: () => void;
};

export function HomeFinaInsight({ hasTransactions, expenses, income, onOpenAnalytics }: Props) {
  const text = !hasTransactions
    ? 'Создай первые счета и запиши пару операций. После этого здесь появятся короткие выводы по деньгам.'
    : expenses > income
      ? 'Расходы за месяц выше доходов. Проверь крупные категории и регулярные траты.'
      : 'Баланс месяца выглядит спокойно. Продолжай фиксировать операции, чтобы видеть точную картину.';

  return (
    <section className="app-card app-home-insight-card">
      <div className="app-eyebrow">Совет Фины</div>
      <p>{text}</p>
      <button type="button" onClick={onOpenAnalytics}>Открыть аналитику</button>
    </section>
  );
}
