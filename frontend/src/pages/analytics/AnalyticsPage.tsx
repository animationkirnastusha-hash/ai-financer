import { useEffect, useMemo } from 'react';
import { useTransactionsStore } from '@/features/transactions/model/transactions.store';
import { useNavigationStore } from '@/features/navigation/model/navigation.store';
import { formatMoney } from '@/shared/lib/money';

export default function AnalyticsPage() {
  const navigateTo = useNavigationStore((state) => state.navigateTo);
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
    <div className="h-full overflow-y-auto px-4 pb-32 pt-[calc(env(safe-area-inset-top)+18px)] text-white">
      <div className="mx-auto max-w-[620px] space-y-4">
        <header className="rounded-[34px] border border-white/10 bg-white/[0.045] p-5">
          <div className="text-[11px] uppercase tracking-[0.2em] text-emerald-200/60">Analytics</div>
          <h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em]">Понятная аналитика</h1>
          <p className="mt-2 text-sm leading-6 text-white/55">Здесь не нужен BI-комбайн. Нужны ответы: куда ушли деньги, что изменилось, что делать дальше.</p>
        </header>

        <section className="rounded-[30px] border border-white/10 bg-white/[0.04] p-5">
          <div className="text-sm text-white/45">Расходы в базе</div>
          <div className="mt-2 text-3xl font-semibold">{formatMoney(data.total, 'RUB', { sign: 'minus' })}</div>
          <button onClick={() => navigateTo('ai-core')} className="mt-4 rounded-full border border-emerald-300/15 bg-emerald-300/10 px-4 py-2 text-sm text-emerald-100">Спросить AI</button>
        </section>

        <section className="rounded-[30px] border border-white/10 bg-white/[0.04] p-5">
          <div className="text-lg font-semibold">Категории</div>
          <div className="mt-4 space-y-3">
            {data.top.length === 0 ? <div className="text-sm text-white/45">Добавь первые расходы — появится структура.</div> : data.top.map(([name, value]) => (
              <div key={name}>
                <div className="flex justify-between text-sm"><span>{name}</span><span>{formatMoney(value, 'RUB')}</span></div>
                <div className="mt-2 h-2 rounded-full bg-white/8"><div className="h-2 rounded-full bg-emerald-200/70" style={{ width: `${Math.max(8, Math.min(100, (value / data.total) * 100))}%` }} /></div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-[30px] border border-amber-200/12 bg-amber-200/[0.06] p-5">
          <div className="text-lg font-semibold">Premium depth</div>
          <p className="mt-2 text-sm leading-6 text-white/52">Прогнозы, deep trends, behavioral analysis и monthly AI reports должны быть gated preview, пока платежка не готова.</p>
          <button onClick={() => navigateTo('premium')} className="mt-4 rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-sm text-white/70">Посмотреть Premium</button>
        </section>
      </div>
    </div>
  );
}
