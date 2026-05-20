import { useEffect, useMemo } from 'react';
import { useAccountsStore } from '@/features/accounts/model/accounts.store';
import { useNavigationStore } from '@/features/navigation/model/navigation.store';
import { useTransactionsStore } from '@/features/transactions/model/transactions.store';
import { CompanionPresence } from '@/features/companion/ui/CompanionPresence';
import { formatMoney } from '@/shared/lib/money';

const quickActions = [
  { label: 'Расход', prompt: 'кофе 300' },
  { label: 'Доход', prompt: 'доход 50000' },
  { label: 'Перевод', prompt: 'переведи 1000 на карту' },
  { label: 'Спросить AI', prompt: 'куда ушли деньги?' },
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

  const isEmptyState = accounts.length === 0 && transactions.length === 0;

  return (
    <div className="h-full overflow-y-auto px-4 pb-28 pt-[calc(env(safe-area-inset-top)+126px)] text-white">
      <div className="mx-auto w-full max-w-[620px] space-y-4">
        <header className="rounded-[34px] border border-white/10 bg-white/[0.045] p-5 shadow-2xl">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-[11px] uppercase tracking-[0.2em] text-emerald-200/60">AI-Financer</div>
              <h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em]">Главная</h1>
              <p className="mt-2 max-w-[430px] text-sm leading-6 text-white/55">
                Баланс, последние действия и быстрый доступ к AI.
              </p>
            </div>
            <button onClick={() => navigateTo('premium')} className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-white/60">Премиум</button>
          </div>

          <div className="mt-6 rounded-[28px] border border-emerald-300/12 bg-emerald-300/[0.08] p-5">
            <div className="text-sm text-emerald-100/60">Общий баланс</div>
            <div className="mt-2 text-[38px] font-semibold tracking-[-0.06em]">{formatMoney(data.totalRub, 'RUB')}</div>
            <div className="mt-3 flex flex-wrap gap-2 text-xs text-white/56">
              <span className="rounded-full bg-black/22 px-3 py-1">Доходы: {formatMoney(data.income, 'RUB', { sign: 'plus' })}</span>
              <span className="rounded-full bg-black/22 px-3 py-1">Расходы: {formatMoney(data.expenses, 'RUB', { sign: 'minus' })}</span>
              <span className="rounded-full bg-black/22 px-3 py-1">Итог: {formatMoney(data.delta, 'RUB', { sign: 'auto' })}</span>
            </div>
          </div>
        </header>

        {isEmptyState ? (
          <section className="rounded-[32px] border border-emerald-300/14 bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.16),transparent_52%),rgba(255,255,255,0.04)] p-5 shadow-2xl">
            <div className="text-[11px] uppercase tracking-[0.2em] text-emerald-200/62">Первый запуск</div>
            <h2 className="mt-3 text-2xl font-semibold tracking-[-0.03em]">Начни с одного действия</h2>
            <p className="mt-2 text-sm leading-6 text-white/56">
              AI подготовит предварительный результат. Ты подтвердишь действие перед сохранением.
            </p>

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
                  <span className="text-white/28">→</span>
                </button>
              ))}
            </div>
          </section>
        ) : null}

        <CompanionPresence />

        <section className="grid grid-cols-2 gap-3">
          {quickActions.map((action) => (
            <button key={action.label} onClick={() => openAIWithCommand(action.prompt)} className="rounded-[26px] border border-white/10 bg-white/[0.045] p-4 text-left transition active:scale-[0.98]">
              <div className="text-base font-semibold">{action.label}</div>
              <div className="mt-2 text-xs leading-5 text-white/45">“{action.prompt}”</div>
            </button>
          ))}
        </section>

      </div>
    </div>
  );
}
