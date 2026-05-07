import { useEffect, useMemo } from 'react';

import { useAccountsStore } from '@/features/accounts/model/accounts.store';
import { useNavigationStore } from '@/features/navigation/model/navigation.store';
import { useTransactionsStore } from '@/features/transactions/model/transactions.store';
import { DashboardMetricCard } from '@/features/dashboard/ui/DashboardMetricCard';
import { DashboardSection } from '@/features/dashboard/ui/DashboardSection';
import { InsightPill } from '@/features/dashboard/ui/InsightPill';
import { RecentActivityCard } from '@/features/dashboard/ui/RecentActivityCard';
import { QuickActionCard } from '@/features/dashboard/ui/QuickActionCard';
import { formatMoney, formatTransactionDate } from '@/shared/lib/money';
import { PremiumInlineCard } from '@/features/premium/ui/PremiumInlineCard';
import { usePremiumStore } from '@/features/premium/model/premium.store';
const quickActions = [
  {
    title: 'Добавить расход',
    description: 'Например: “такси 780”',
  },
  {
    title: 'Добавить доход',
    description: 'Например: “+50000 зарплата”',
  },
  {
    title: 'Показать расходы',
    description: 'Например: “расходы за месяц”',
  },
];

function isCurrentMonth(dateValue: string) {
  const date = new Date(dateValue);
  const now = new Date();

  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth()
  );
}

export default function DashboardPage() {
  const navigateTo = useNavigationStore((state) => state.navigateTo);

  const accounts = useAccountsStore((state) => state.items);
  const loadAccounts = useAccountsStore((state) => state.loadAccounts);

  const transactions = useTransactionsStore((state) => state.items);
  const loadTransactions = useTransactionsStore((state) => state.loadTransactions);

  const openPremium = usePremiumStore((state) => state.openPremium);
  useEffect(() => {
    void Promise.allSettled([loadAccounts(), loadTransactions()]);
  }, [loadAccounts, loadTransactions]);

  const dashboard = useMemo(() => {
    const rubAccounts = accounts.filter((account) => account.currency === 'RUB');
    const foreignAccounts = accounts.filter((account) => account.currency !== 'RUB');

    const totalRub = rubAccounts.reduce((sum, account) => {
      return sum + (Number(account.balance) || 0);
    }, 0);

    const monthRubTransactions = transactions.filter((item) => {
      return isCurrentMonth(item.date) && item.account?.currency === 'RUB';
    });

    const income = monthRubTransactions.reduce((sum, item) => {
      return item.type === 'income' ? sum + (Number(item.amount) || 0) : sum;
    }, 0);

    const expenses = monthRubTransactions.reduce((sum, item) => {
      return item.type === 'expense' ? sum + (Number(item.amount) || 0) : sum;
    }, 0);

    const savingsAccounts = rubAccounts.filter((account) => {
      return account.type === 'savings' || account.type === 'investment';
    });

    const savings = savingsAccounts.reduce((sum, account) => {
      return sum + (Number(account.balance) || 0);
    }, 0);

    return {
      totalRub,
      income,
      expenses,
      savings,
      foreignAccountsCount: foreignAccounts.length,
    };
  }, [accounts, transactions]);

  const metrics = [
    {
      label: 'Общий баланс',
      value: formatMoney(dashboard.totalRub, 'RUB'),
      hint:
        dashboard.foreignAccountsCount > 0
          ? `+ ${dashboard.foreignAccountsCount} счёта в других валютах`
          : 'только ₽ счета',
    },
    {
      label: 'Доходы',
      value: formatMoney(dashboard.income, 'RUB', { sign: 'plus' }),
      hint: 'за текущий месяц',
    },
    {
      label: 'Расходы',
      value: formatMoney(dashboard.expenses, 'RUB', { sign: 'minus' }),
      hint: 'за текущий месяц',
    },
    {
      label: 'Накопления',
      value: formatMoney(dashboard.savings, 'RUB'),
      hint: 'savings + investment',
    },
  ];
  const insights =
    accounts.length === 0
      ? ['Создай первый счёт', 'AI начнёт считать баланс', 'Потом добавь доход']
      : transactions.length === 0
        ? ['Счета готовы', 'Добавь первую операцию', 'Например: “+50000 зарплата”']
        : [
            `${transactions.length} операций в истории`,
            dashboard.income > dashboard.expenses
              ? 'Месяц в плюсе'
              : 'Проверь расходы месяца',
            dashboard.foreignAccountsCount > 0
              ? 'Есть счета в других валютах'
              : 'Все данные в ₽',
          ];

  const recentTransactions = transactions.slice(0, 5);

  return (
    <div className="flex h-dvh flex-col bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.10),transparent_24%),linear-gradient(180deg,#0b1016_0%,#090d13_100%)] text-white">
      <div className="flex-1 overflow-y-auto px-4 pb-28 pt-[calc(env(safe-area-inset-top)+78px)]">
        <div className="mx-auto w-full max-w-[560px] space-y-4">
          <section className="rounded-[30px] border border-white/10 bg-white/[0.05] p-5 backdrop-blur-xl">
            <div className="text-[11px] uppercase tracking-[0.18em] text-emerald-300/70">
              AI Overview
            </div>

            <h1 className="mt-3 text-[28px] font-semibold leading-tight text-white">
              {accounts.length === 0
                ? 'Начни с первого счёта'
                : transactions.length === 0
                  ? 'Счета готовы'
                  : 'Финансы обновлены'}
            </h1>

            <p className="mt-2 max-w-[440px] text-sm leading-6 text-white/60">
              {accounts.length === 0
                ? 'Создай счёт, потом запиши доход или расход — AI начнёт собирать финансовую картину.'
                : transactions.length === 0
                  ? 'Теперь добавь первую операцию через AI: доход, расход или перевод.'
                  : 'AI синхронизировал счета, операции и разделы.'}
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              {insights.map((item) => (
                <InsightPill key={item} text={item} />
              ))}
            </div>
          </section>

          <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {metrics.map((metric) => (
              <DashboardMetricCard
                key={metric.label}
                label={metric.label}
                value={metric.value}
                hint={metric.hint}
              />
            ))}
          </section>
<PremiumInlineCard
  onOpen={openPremium}
  trigger={{
    kind: 'deep_analysis',
    title: 'AI нашёл скрытые зоны роста',
    description:
      transactions.length > 0
        ? 'Можно глубже разобрать расходы, найти повторяющиеся траты и построить план на следующий месяц.'
        : 'Когда появятся первые операции, Premium покажет глубокий финансовый разбор.',
    cta: 'Открыть полный AI-анализ',
    value:
      transactions.length > 0
        ? 'Потенциальная экономия может быть выше подписки'
        : 'Готово к анализу после первых операций',
  }}
/>
          <DashboardSection
            title="Быстрые сценарии"
            description="То, с чего пользователь чаще всего начинает действие."
          >
            <div className="grid gap-3">
              {quickActions.map((item) => (
                <QuickActionCard
                  key={item.title}
                  title={item.title}
                  description={item.description}
                  onClick={() => navigateTo('ai-core')}
                />
              ))}
            </div>
          </DashboardSection>

          <DashboardSection
            title="Последняя активность"
            description="Недавние доходы, расходы и переводы."
          >
            <div className="space-y-3">
              {recentTransactions.length === 0 ? (
                <RecentActivityCard
                  title="Пока нет операций"
                  subtitle="Создай первую операцию через AI"
                  amount={formatMoney(0, 'RUB')}
                  time="—"
                />
              ) : (
                recentTransactions.map((item) => {
                  const currency = item.account?.currency || 'RUB';
                  const isIncome = item.type === 'income';
                  const isExpense = item.type === 'expense';

                  return (
                    <RecentActivityCard
                      key={item.id}
                      title={
                        item.description?.trim() ||
                        item.category?.name ||
                        (isIncome
                          ? 'Доход'
                          : isExpense
                            ? 'Расход'
                            : 'Перевод')
                      }
                      subtitle={
                        item.type === 'transfer'
                          ? `${item.account?.name || 'Счёт'} → ${
                              item.toAccount?.name || 'Другой счёт'
                            }`
                          : `${item.category?.name || 'Без категории'} · ${
                              item.account?.name || 'Счёт'
                            }`
                      }
                      amount={formatMoney(Number(item.amount) || 0, currency, {
                        sign: isIncome ? 'plus' : isExpense ? 'minus' : 'none',
                      })}
                      time={formatTransactionDate(item.date)}
                    />
                  );
                })
              )}
            </div>
          </DashboardSection>
        </div>
      </div>
    </div>
  );
}