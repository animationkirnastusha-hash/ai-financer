import { useEffect, useMemo } from 'react';
import { useTransactionsStore } from '@/features/transactions/model/transactions.store';
import { useNavigationStore } from '@/features/navigation/model/navigation.store';
import { ScreenTopBar } from '@/shared/ui/ScreenTopBar';
import { formatMoney } from '@/shared/lib/money';

const questions = [
  'на что я трачу больше всего?',
  'сравни этот месяц с прошлым',
  'какие траты можно сократить?',
];

export default function AnalyticsPage() {
  const navigateTo = useNavigationStore((state) => state.navigateTo);
  const openAIWithCommand = useNavigationStore((state) => state.openAIWithCommand);
  const transactions = useTransactionsStore((state) => state.items);
  const loadTransactions = useTransactionsStore((state) => state.loadTransactions);

  useEffect(() => {
    void loadTransactions();
  }, [loadTransactions]);

  const data = useMemo(() => {
    const expenses = transactions.filter((item) => item.type === 'expense');
    const income = transactions.filter((item) => item.type === 'income');
    const totalExpenses = expenses.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const totalIncome = income.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const top = Object.entries(
      expenses.reduce<Record<string, number>>((acc, item) => {
        const key = item.category?.name || 'Без категории';
        acc[key] = (acc[key] || 0) + Number(item.amount || 0);
        return acc;
      }, {}),
    ).sort((a, b) => b[1] - a[1]).slice(0, 5);
    return { totalExpenses, totalIncome, top };
  }, [transactions]);

  return (
    <div className="app-page text-white">
      <div className="app-page__inner space-y-4">
        <ScreenTopBar title="Аналитика" right={['history', 'settings']} />

        <header className="app-card app-card--hero">
          <div className="app-eyebrow">Аналитика</div>
          <h1 className="mt-3 text-[32px] font-semibold leading-none tracking-[-0.055em]">Картина месяца</h1>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <div className="app-stat-card">
              <div className="app-stat-card__label">Доходы</div>
              <div className="app-stat-card__money app-stat-card__money--positive">{formatMoney(data.totalIncome, 'RUB', { sign: 'plus' })}</div>
            </div>
            <div className="app-stat-card">
              <div className="app-stat-card__label">Расходы</div>
              <div className="app-stat-card__money">{formatMoney(data.totalExpenses, 'RUB', { sign: 'minus' })}</div>
            </div>
          </div>
        </header>

        <section className="app-card">
          <div className="app-section-title">Спросить AI</div>
          <div className="mt-3 grid gap-2">
            {questions.map((question) => (
              <button key={question} type="button" onClick={() => openAIWithCommand(question)} className="app-list-button">
                <span>{question}</span>
                <small>Открыть разбор</small>
              </button>
            ))}
          </div>
        </section>

        <section className="app-card">
          <div className="app-section-title">Категории</div>
          <div className="mt-4 space-y-3">
            {data.top.length === 0 ? (
              <div className="text-sm text-white/45">Добавь расходы — здесь появится структура.</div>
            ) : data.top.map(([name, value]) => (
              <div key={name}>
                <div className="flex justify-between gap-3 text-sm"><span className="truncate">{name}</span><span className="shrink-0">{formatMoney(value, 'RUB')}</span></div>
                <div className="mt-2 h-2 rounded-full bg-white/8"><div className="h-2 rounded-full bg-emerald-200/70" style={{ width: `${Math.max(8, Math.min(100, data.totalExpenses ? (value / data.totalExpenses) * 100 : 0))}%` }} /></div>
              </div>
            ))}
          </div>
        </section>

        <section className="app-card">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="app-section-title">Глубже</div>
              <p className="mt-2 text-sm text-white/46">Прогнозы и месячные отчёты будут в расширенном режиме.</p>
            </div>
            <button onClick={() => navigateTo('premium')} className="app-secondary-button shrink-0">Премиум</button>
          </div>
        </section>
      </div>
    </div>
  );
}
