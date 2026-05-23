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

function isCurrentMonth(value: string) {
  const date = new Date(value);
  const now = new Date();
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
}

export default function AnalyticsPage() {
  const navigateTo = useNavigationStore((state) => state.navigateTo);
  const openAIWithCommand = useNavigationStore((state) => state.openAIWithCommand);
  const transactions = useTransactionsStore((state) => state.items);
  const loadTransactions = useTransactionsStore((state) => state.loadTransactions);

  useEffect(() => { void loadTransactions(); }, [loadTransactions]);

  const data = useMemo(() => {
    const monthTransactions = transactions.filter((item) => isCurrentMonth(item.date));
    const expenses = monthTransactions.filter((item) => item.type === 'expense');
    const income = monthTransactions.filter((item) => item.type === 'income');
    const totalExpenses = expenses.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const totalIncome = income.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const top = Object.entries(
      expenses.reduce<Record<string, number>>((acc, item) => {
        const key = item.category?.name || 'Без категории';
        acc[key] = (acc[key] || 0) + Number(item.amount || 0);
        return acc;
      }, {}),
    ).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const operationsCount = monthTransactions.length;
    const balance = totalIncome - totalExpenses;
    return { totalExpenses, totalIncome, top, operationsCount, balance };
  }, [transactions]);

  const mainInsight = data.operationsCount === 0
    ? 'Когда появятся операции, Фина покажет основные расходы и динамику месяца.'
    : data.balance >= 0
      ? 'Месяц выглядит устойчиво: доходы выше расходов. Следующий шаг — найти регулярные траты.'
      : 'Расходы выше доходов. Стоит проверить верхние категории и повторяющиеся покупки.';

  return (
    <div className="app-page app-analytics-page text-white">
      <div className="app-page__inner space-y-4">
        <ScreenTopBar title="Аналитика" right={['history', 'settings']} />

        <header className="app-card app-card--hero">
          <div className="app-eyebrow">Аналитика</div>
          <div className="app-analytics-hero__top mt-3">
            <div className="min-w-0">
              <h1 className="app-hero-title">Картина месяца</h1>
              <p className="app-hero-caption">Коротко: сколько пришло, сколько ушло и где главный расход.</p>
            </div>
          </div>
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
          <div className="app-analytics-summary">
            <div><strong>{data.operationsCount}</strong><small>операций</small></div>
            <div><strong>{formatMoney(data.balance, 'RUB', { sign: 'auto' })}</strong><small>итог</small></div>
            <div><strong>{data.top[0]?.[0] || '—'}</strong><small>главный расход</small></div>
          </div>
        </header>

        <section className="app-operations-insight">
          <b>Вывод</b>
          <span>{mainInsight}</span>
        </section>

        <section className="app-card">
          <div className="app-section-title">Спросить Фину</div>
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
          <div className="app-analytics-bars mt-4">
            {data.top.length === 0 ? (
              <div className="text-sm text-white/45">Добавь расходы — здесь появится структура.</div>
            ) : data.top.map(([name, value]) => (
              <div key={name} className="app-analytics-row">
                <div className="app-analytics-row__top"><span>{name}</span><span>{formatMoney(value, 'RUB')}</span></div>
                <div className="app-analytics-bar"><span style={{ width: `${Math.max(8, Math.min(100, data.totalExpenses ? (value / data.totalExpenses) * 100 : 0))}%` }} /></div>
              </div>
            ))}
          </div>
        </section>

        <section className="app-card">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="app-section-title">Глубже</div>
              <p className="mt-2 text-sm text-white/46">Прогнозы, месячные отчёты и расширенные выводы подготовим для премиум-режима.</p>
            </div>
            <button type="button" onClick={() => navigateTo('premium')} className="app-secondary-button shrink-0">Премиум</button>
          </div>
        </section>
      </div>
    </div>
  );
}
