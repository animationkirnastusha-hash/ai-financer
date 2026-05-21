import { useEffect, useMemo } from 'react';
import { useAccountsStore } from '@/features/accounts/model/accounts.store';
import { useNavigationStore } from '@/features/navigation/model/navigation.store';
import { useTransactionsStore } from '@/features/transactions/model/transactions.store';
import { CompanionPresence } from '@/features/companion/ui/CompanionPresence';
import { ScreenTopBar } from '@/shared/ui/ScreenTopBar';
import { formatMoney, formatTransactionDate } from '@/shared/lib/money';

const quickActions = [
  { label: 'Расход', hint: 'Записать трату', prompt: 'кофе 300' },
  { label: 'Доход', hint: 'Добавить деньги', prompt: 'доход 50000' },
  { label: 'Перевод', hint: 'Между счетами', prompt: 'переведи 1000 на карту' },
  { label: 'Спросить', hint: 'Вопрос к AI', prompt: 'что изменилось за месяц?' },
];

const onboardingSteps = [
  { label: 'Первый счёт', prompt: 'создай счет основной' },
  { label: 'Добавить деньги', prompt: 'доход 50000 на основной счет' },
  { label: 'Записать расход', prompt: 'кофе 300' },
  { label: 'Спросить аналитику', prompt: 'сколько я потратил за неделю' },
];

const secondaryLinks = [
  { label: 'Счета', screen: 'accounts' as const },
  { label: 'Цели', screen: 'goals' as const },
  { label: 'Рефералы', screen: 'referral' as const },
  { label: 'Премиум', screen: 'premium' as const },
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

        <header className="app-card app-card--hero app-home-hero">
          <div className="app-eyebrow">Баланс</div>
          <div className="mt-3 app-money-hero">{formatMoney(data.totalRub, 'RUB')}</div>
          <div className="mt-4 grid grid-cols-3 gap-2">
            <div className="app-home-metric"><span>Доходы</span><b>{formatMoney(data.income, 'RUB', { sign: 'plus' })}</b></div>
            <div className="app-home-metric"><span>Расходы</span><b>{formatMoney(data.expenses, 'RUB', { sign: 'minus' })}</b></div>
            <div className="app-home-metric"><span>Итог</span><b>{formatMoney(data.delta, 'RUB', { sign: 'auto' })}</b></div>
          </div>
        </header>

        <section className="app-section">
          <div className="app-section-title">Что сделать</div>
          <div className="grid grid-cols-2 gap-3">
            {quickActions.map((action) => (
              <button
                key={action.label}
                type="button"
                onClick={() => openAIWithCommand(action.prompt)}
                className="app-action-card"
              >
                <span>{action.label}</span>
                <small>{action.hint}</small>
              </button>
            ))}
          </div>
        </section>

        {isEmptyState ? (
          <section className="app-card">
            <div className="app-section-title">Быстрый старт</div>
            <div className="mt-4 grid gap-2">
              {onboardingSteps.map((step, index) => (
                <button
                  key={step.prompt}
                  type="button"
                  onClick={() => openAIWithCommand(step.prompt)}
                  className="app-list-button"
                >
                  <span>{index + 1}. {step.label}</span>
                  <small>{step.prompt}</small>
                </button>
              ))}
            </div>
          </section>
        ) : null}

        <CompanionPresence />

        <section className="app-card">
          <div className="flex items-center justify-between gap-3">
            <div className="app-section-title">Недавнее</div>
            <button type="button" onClick={() => navigateTo('transactions')} className="text-sm text-emerald-100/72">Все</button>
          </div>

          <div className="mt-4 space-y-2">
            {recent.length === 0 ? (
              <button type="button" onClick={() => openAIWithCommand('кофе 300')} className="app-empty-button">Добавь первую операцию через AI</button>
            ) : (
              recent.map((transaction) => {
                const sign = transaction.type === 'income' ? 'plus' : transaction.type === 'expense' ? 'minus' : 'none';
                return (
                  <button
                    key={transaction.id}
                    type="button"
                    onClick={() => navigateTo('transactions')}
                    className="app-transaction-row"
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

        <section className="grid grid-cols-4 gap-2">
          {secondaryLinks.map((item) => (
            <button key={item.screen} type="button" onClick={() => navigateTo(item.screen)} className="app-small-link">
              {item.label}
            </button>
          ))}
        </section>
      </div>
    </div>
  );
}
