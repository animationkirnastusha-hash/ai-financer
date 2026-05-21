import { useEffect, useMemo } from 'react';
import { useAccountsStore } from '@/features/accounts/model/accounts.store';
import { useNavigationStore } from '@/features/navigation/model/navigation.store';
import { useTransactionsStore } from '@/features/transactions/model/transactions.store';
import { CompanionPresence } from '@/features/companion/ui/CompanionPresence';
import { ScreenTopBar } from '@/shared/ui/ScreenTopBar';
import { formatMoney, formatTransactionDate } from '@/shared/lib/money';

const quickActions = [
  { label: 'Расход', prompt: 'кофе 300' },
  { label: 'Доход', prompt: 'доход 50000' },
  { label: 'Перевод', prompt: 'переведи 1000 на карту' },
  { label: 'AI', prompt: 'что изменилось за месяц?' },
];

const onboardingSteps = [
  { label: 'Первый счёт', prompt: 'создай счет основной' },
  { label: 'Добавить деньги', prompt: 'доход 50000 на основной счет' },
  { label: 'Записать расход', prompt: 'кофе 300' },
  { label: 'Спросить аналитику', prompt: 'сколько я потратил за неделю' },
];

function isCurrentMonth(dateValue: string) {
  const date = new Date(dateValue);
  const now = new Date();
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
}

function titleOf(transaction: any) {
  if (!transaction) return '';
  if (transaction.type === 'transfer') return `${transaction.account?.name ?? 'Счёт'} → ${transaction.toAccount?.name ?? 'Счёт'}`;
  return transaction.category?.name || transaction.description || 'Операция';
}

export default function DashboardPage() {
  const navigateTo = useNavigationStore((state) => state.navigateTo);
  const openAIWithCommand = useNavigationStore((state) => state.openAIWithCommand);
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

  const recent = transactions.slice(0, 3);
  const isEmptyState = accounts.length === 0 && transactions.length === 0;

  return (
    <div className="app-page text-white">
      <div className="app-page__inner space-y-4">
        <ScreenTopBar title="Главная" right={['referral', 'history', 'settings']} />

        <header className="app-card app-card--hero">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="app-eyebrow">AI-Financer</div>
              <h1 className="mt-3 text-[34px] font-semibold leading-none tracking-[-0.055em]">Главная</h1>
            </div>
            <button onClick={() => navigateTo('premium')} className="app-secondary-button shrink-0">Премиум</button>
          </div>

          <div className="mt-6 rounded-[28px] border border-emerald-300/12 bg-emerald-300/[0.08] p-5">
            <div className="text-sm text-emerald-100/60">Общий баланс</div>
            <div className="mt-2 text-[40px] font-semibold leading-none tracking-[-0.06em]">{formatMoney(data.totalRub, 'RUB')}</div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-xs text-white/58">
              <span className="app-mini-pill">Доходы {formatMoney(data.income, 'RUB', { sign: 'plus' })}</span>
              <span className="app-mini-pill">Расходы {formatMoney(data.expenses, 'RUB', { sign: 'minus' })}</span>
              <span className="app-mini-pill">Итог {formatMoney(data.delta, 'RUB', { sign: 'auto' })}</span>
            </div>
          </div>
        </header>

        <section className="grid grid-cols-4 gap-2">
          {quickActions.map((action) => (
            <button
              key={action.label}
              type="button"
              onClick={() => openAIWithCommand(action.prompt)}
              className="rounded-[22px] border border-white/10 bg-white/[0.04] px-2 py-3 text-center text-sm text-white/78 active:scale-[0.98]"
            >
              {action.label}
            </button>
          ))}
        </section>

        {isEmptyState ? (
          <section className="app-card">
            <div className="app-eyebrow">Первый запуск</div>
            <h2 className="mt-3 text-2xl font-semibold tracking-[-0.03em]">Начни с одного действия</h2>
            <div className="mt-5 grid gap-2">
              {onboardingSteps.map((step, index) => (
                <button
                  key={step.prompt}
                  type="button"
                  onClick={() => openAIWithCommand(step.prompt)}
                  className="flex items-center justify-between gap-3 rounded-[22px] border border-white/8 bg-black/20 px-4 py-3 text-left transition active:scale-[0.99]"
                >
                  <div>
                    <div className="text-sm font-medium text-white">{index + 1}. {step.label}</div>
                    <div className="mt-1 text-xs text-emerald-100/66">“{step.prompt}”</div>
                  </div>
                  <span className="text-white/30">→</span>
                </button>
              ))}
            </div>
          </section>
        ) : null}

        <CompanionPresence />

        <section className="app-card">
          <div className="flex items-center justify-between gap-3">
            <div className="app-eyebrow">Недавнее</div>
            <button type="button" onClick={() => navigateTo('transactions')} className="text-sm text-emerald-100/72">Все</button>
          </div>

          <div className="mt-4 space-y-2">
            {recent.length === 0 ? (
              <div className="rounded-2xl border border-white/8 bg-black/18 p-4 text-sm text-white/50">Операций пока нет.</div>
            ) : (
              recent.map((transaction) => {
                const sign = transaction.type === 'income' ? 'plus' : transaction.type === 'expense' ? 'minus' : 'none';
                return (
                  <button
                    key={transaction.id}
                    type="button"
                    onClick={() => navigateTo('transactions')}
                    className="flex w-full items-center justify-between gap-3 rounded-2xl border border-white/8 bg-black/18 p-3 text-left"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-white">{titleOf(transaction)}</div>
                      <div className="mt-1 truncate text-xs text-white/40">{formatTransactionDate(transaction.date)} · {transaction.account?.name ?? 'Счёт'}</div>
                    </div>
                    <div className="shrink-0 text-sm font-semibold text-white">{formatMoney(transaction.amount, transaction.account?.currency ?? 'RUB', { sign })}</div>
                  </button>
                );
              })
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
