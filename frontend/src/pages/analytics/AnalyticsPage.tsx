import { useEffect, useMemo } from 'react';
import { useTransactionsStore } from '@/features/transactions/model/transactions.store';
import { useNavigationStore } from '@/features/navigation/model/navigation.store';
import { ScreenTopBar } from '@/shared/ui/ScreenTopBar';
import { formatMoney } from '@/shared/lib/money';

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
    const total = expenses.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const top = Object.entries(
      expenses.reduce<Record<string, number>>((acc, item) => {
        const key = item.category?.name || 'Без категории';
        acc[key] = (acc[key] || 0) + Number(item.amount || 0);
        return acc;
      }, {}),
    ).sort((a, b) => b[1] - a[1]).slice(0, 5);
    return { total, top };
  }, [transactions]);

  return (
    <div className="app-page text-white">
      <div className="app-page__inner space-y-4">
        <ScreenTopBar title="Аналитика" right={['history', 'settings']} />

        <header className="app-card app-card--hero">
          <div className="app-eyebrow">Аналитика</div>
          <h1 className="mt-3 text-[34px] font-semibold leading-none tracking-[-0.055em]">Расходы</h1>
          <p className="mt-3 text-sm leading-6 text-white/50">Короткие ответы по тратам, категориям и динамике.</p>
        </header>

        <section className="app-card">
          <div className="text-sm text-white/45">Расходы за период</div>
          <div className="mt-2 text-4xl font-semibold tracking-[-0.05em]">{formatMoney(data.total, 'RUB', { sign: 'minus' })}</div>
          <button onClick={() => openAIWithCommand('на что я трачу больше всего?')} className="app-primary-button mt-4">Спросить AI</button>
        </section>

        <section className="app-card">
          <div className="text-lg font-semibold">Категории</div>
          <div className="mt-4 space-y-3">
            {data.top.length === 0 ? (
              <div className="text-sm text-white/45">Добавь первые расходы — здесь появится структура.</div>
            ) : data.top.map(([name, value]) => (
              <div key={name}>
                <div className="flex justify-between gap-3 text-sm"><span className="truncate">{name}</span><span className="shrink-0">{formatMoney(value, 'RUB')}</span></div>
                <div className="mt-2 h-2 rounded-full bg-white/8"><div className="h-2 rounded-full bg-emerald-200/70" style={{ width: `${Math.max(8, Math.min(100, data.total ? (value / data.total) * 100 : 0))}%` }} /></div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-[30px] border border-amber-200/12 bg-amber-200/[0.055] p-5">
          <div className="text-lg font-semibold">Глубокий анализ</div>
          <p className="mt-2 text-sm leading-6 text-white/52">Прогнозы, повторяющиеся траты и месячные отчёты будут в расширенном режиме.</p>
          <button onClick={() => navigateTo('premium')} className="app-secondary-button mt-4">Посмотреть Премиум</button>
        </section>
      </div>
    </div>
  );
}
