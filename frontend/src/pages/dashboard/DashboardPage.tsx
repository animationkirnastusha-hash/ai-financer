import { useEffect, useMemo } from 'react';
import { useAccountsStore } from '@/features/accounts/model/accounts.store';
import { useNavigationStore } from '@/features/navigation/model/navigation.store';
import { useTransactionsStore } from '@/features/transactions/model/transactions.store';
import { CompanionPresence } from '@/features/companion/ui/CompanionPresence';
import { formatMoney, formatTransactionDate } from '@/shared/lib/money';

const quickActions = [
  { label: 'Расход', prompt: 'кофе 300' },
  { label: 'Доход', prompt: 'доход 50000' },
  { label: 'Перевод', prompt: 'переведи 1000 на карту' },
  { label: 'Спросить AI', prompt: 'куда ушли деньги?' },
];

function isCurrentMonth(dateValue: string) {
  const date = new Date(dateValue);
  const now = new Date();
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
}

export default function DashboardPage() {
  const navigateTo = useNavigationStore((state) => state.navigateTo);
  const accounts = useAccountsStore((state) => state.items);
  const loadAccounts = useAccountsStore((state) => state.loadAccounts);
  const transactions = useTransactionsStore((state) => state.items);
  const loadTransactions = useTransactionsStore((state) => state.loadTransactions);

  useEffect(() => {
    void Promise.allSettled([loadAccounts(), loadTransactions()]);
  }, [loadAccounts, loadTransactions]);

  const data = useMemo(() => {
    const rubAccounts = accounts.filter((account) => account.currency === 'RUB');
    const totalRub = rubAccounts.reduce((sum, account) => sum + (Number(account.balance) || 0), 0);
    const currentMonth = transactions.filter((item) => isCurrentMonth(item.date) && item.account?.currency === 'RUB');
    const income = currentMonth.reduce((sum, item) => (item.type === 'income' ? sum + Number(item.amount || 0) : sum), 0);
    const expenses = currentMonth.reduce((sum, item) => (item.type === 'expense' ? sum + Number(item.amount || 0) : sum), 0);
    const delta = income - expenses;
    return { totalRub, income, expenses, delta };
  }, [accounts, transactions]);

  const recent = transactions.slice(0, 4);

  return (
    <div className="h-full overflow-y-auto px-4 pb-32 pt-[calc(env(safe-area-inset-top)+18px)] text-white">
      <div className="mx-auto w-full max-w-[620px] space-y-4">
        <header className="rounded-[34px] border border-white/10 bg-white/[0.045] p-5 shadow-2xl">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-[11px] uppercase tracking-[0.2em] text-emerald-200/60">AI-Financer</div>
              <h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em]">Финансовая картина</h1>
              <p className="mt-2 max-w-[430px] text-sm leading-6 text-white/55">
                Не dashboard ради графиков. Это спокойный обзор состояния, действий и следующего шага.
              </p>
            </div>
            <button onClick={() => navigateTo('premium')} className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-white/60">Premium</button>
          </div>

          <div className="mt-6 rounded-[28px] border border-emerald-300/12 bg-emerald-300/[0.08] p-5">
            <div className="text-sm text-emerald-100/60">Общий баланс</div>
            <div className="mt-2 text-[38px] font-semibold tracking-[-0.06em]">{formatMoney(data.totalRub, 'RUB')}</div>
            <div className="mt-3 flex flex-wrap gap-2 text-xs text-white/56">
              <span className="rounded-full bg-black/22 px-3 py-1">Доходы: {formatMoney(data.income, 'RUB', { sign: 'plus' })}</span>
              <span className="rounded-full bg-black/22 px-3 py-1">Расходы: {formatMoney(data.expenses, 'RUB', { sign: 'minus' })}</span>
              <span className="rounded-full bg-black/22 px-3 py-1">Дельта: {formatMoney(data.delta, 'RUB', { sign: 'auto' })}</span>
            </div>
          </div>
        </header>

        <CompanionPresence />

        <section className="grid grid-cols-2 gap-3">
          {quickActions.map((action) => (
            <button key={action.label} onClick={() => navigateTo('ai-core')} className="rounded-[26px] border border-white/10 bg-white/[0.045] p-4 text-left transition active:scale-[0.98]">
              <div className="text-base font-semibold">{action.label}</div>
              <div className="mt-2 text-xs leading-5 text-white/45">“{action.prompt}”</div>
            </button>
          ))}
        </section>

        <section className="rounded-[30px] border border-white/10 bg-white/[0.04] p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-lg font-semibold">Последние операции</div>
              <div className="mt-1 text-sm text-white/45">Timeline, не бухгалтерская таблица.</div>
            </div>
            <button onClick={() => navigateTo('transactions')} className="text-sm text-emerald-200/80">Все</button>
          </div>
          <div className="mt-4 space-y-2">
            {recent.length === 0 ? (
              <div className="rounded-[22px] border border-white/8 bg-black/18 p-4 text-sm text-white/45">Пока нет операций. Напиши AI: “кофе 300”.</div>
            ) : (
              recent.map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-3 rounded-[22px] border border-white/8 bg-black/18 p-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{item.description || item.category?.name || 'Операция'}</div>
                    <div className="mt-1 text-xs text-white/42">{item.account?.name || 'Счёт'} · {formatTransactionDate(item.date)}</div>
                  </div>
                  <div className="text-sm font-semibold">{formatMoney(Number(item.amount) || 0, item.account?.currency || 'RUB', { sign: item.type === 'income' ? 'plus' : item.type === 'expense' ? 'minus' : 'none' })}</div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
