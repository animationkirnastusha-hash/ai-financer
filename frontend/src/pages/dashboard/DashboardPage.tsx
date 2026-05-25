import { useEffect, useMemo, useState } from 'react';
import { useAccountsStore } from '@/features/accounts/model/accounts.store';
import { useNavigationStore } from '@/features/navigation/model/navigation.store';
import { useSettingsStore } from '@/features/settings/model/settings.store';
import { useTransactionsStore } from '@/features/transactions/model/transactions.store';
import { CompanionPresence } from '@/features/companion/ui/CompanionPresence';
import { ProgressionMiniCard } from '@/features/progression/ui/ProgressionMiniCard';
import { ScreenTopBar } from '@/shared/ui/ScreenTopBar';
import { formatMoney, formatTransactionDate } from '@/shared/lib/money';
import type { AppCurrency } from '@/features/settings/model/settings.types';
import { APP_CURRENCIES, convertCurrency, getCurrencyProfile } from '@/features/currency/lib/currency';

const currencyLabels: Record<AppCurrency, string> = Object.fromEntries(APP_CURRENCIES.map((item) => [item.code, item.label])) as Record<AppCurrency, string>;

const menuLinks = [
  { label: 'Операции', caption: 'История и ручное добавление', screen: 'transactions' as const },
  { label: 'Счета', caption: 'Карты, наличные и накопления', screen: 'accounts' as const },
  { label: 'Цели', caption: 'Накопления и планы', screen: 'goals' as const },
  { label: 'Аналитика', caption: 'Расходы, доходы и выводы', screen: 'analytics' as const },
  { label: 'Категории', caption: 'Разделы и правила порядка', screen: 'sections' as const },
  { label: 'Чат с Финой', caption: 'Текст, когда говорить неудобно', screen: 'ai-core' as const },
  { label: 'Рефералы', caption: 'Код и приглашения', screen: 'referral' as const },
  { label: 'Премиум', caption: 'Будущие расширенные возможности', screen: 'premium' as const },
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

function convertRubToCurrency(amount: number, currency: AppCurrency, rates: { usd: number; eur: number }) {
  return convertCurrency(amount, 'RUB', currency, { USD: rates.usd, EUR: rates.eur });
}

function convertCurrencyToRub(amount: number, currency: AppCurrency, rates: { usd: number; eur: number }) {
  return convertCurrency(amount, currency, 'RUB', { USD: rates.usd, EUR: rates.eur });
}

function exchangeHint(currency: AppCurrency, rates: { usd: number; eur: number }) {
  if (currency === 'USD') return `1 USD ≈ ${formatMoney(rates.usd, 'RUB')}`;
  if (currency === 'EUR') return `1 EUR ≈ ${formatMoney(rates.eur, 'RUB')}`;
  return getCurrencyProfile(currency).label;
}

export default function DashboardPage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [currencyIndex, setCurrencyIndex] = useState(0);
  const navigateTo = useNavigationStore((state) => state.navigateTo);
  const openAIWithCommand = useNavigationStore((state) => state.openAIWithCommand);
  const accounts = useAccountsStore((state) => state.items);
  const loadAccounts = useAccountsStore((state) => state.loadAccounts);
  const transactions = useTransactionsStore((state) => state.items);
  const loadTransactions = useTransactionsStore((state) => state.loadTransactions);

  const mainCurrency = useSettingsStore((state) => state.mainCurrency);
  const secondaryCurrencyEnabled = useSettingsStore((state) => state.secondaryCurrencyEnabled);
  const secondaryCurrency = useSettingsStore((state) => state.secondaryCurrency);
  const rubToUsdRate = useSettingsStore((state) => state.rubToUsdRate);
  const rubToEurRate = useSettingsStore((state) => state.rubToEurRate);

  useEffect(() => {
    void Promise.allSettled([loadAccounts(), loadTransactions()]);
  }, [loadAccounts, loadTransactions]);

  const rates = useMemo(() => ({ usd: rubToUsdRate || 90, eur: rubToEurRate || 100 }), [rubToEurRate, rubToUsdRate]);

  const currencies = useMemo<AppCurrency[]>(() => {
    const withAccounts = accounts.map((account) => account.currency as AppCurrency).filter((currency): currency is AppCurrency => ['RUB', 'USD', 'EUR'].includes(currency));
    const list = [mainCurrency, ...(secondaryCurrencyEnabled ? [secondaryCurrency] : []), ...withAccounts];
    return Array.from(new Set(list)).filter(Boolean) as AppCurrency[];
  }, [accounts, mainCurrency, secondaryCurrency, secondaryCurrencyEnabled]);

  const activeCurrency = currencies[currencyIndex % Math.max(1, currencies.length)] || 'RUB';

  const data = useMemo(() => {
    const rubTotal = accounts.reduce((sum, account) => sum + convertCurrencyToRub(Number(account.balance) || 0, account.currency as AppCurrency, rates), 0);
    const activeNative = accounts
      .filter((account) => account.currency === activeCurrency)
      .reduce((sum, account) => sum + (Number(account.balance) || 0), 0);
    const activeTotal = activeNative > 0 || activeCurrency === 'RUB'
      ? accounts.filter((account) => account.currency === activeCurrency).reduce((sum, account) => sum + (Number(account.balance) || 0), 0)
      : convertRubToCurrency(rubTotal, activeCurrency, rates);

    const currentMonth = transactions.filter((item) => isCurrentMonth(item.date));
    const incomeRub = currentMonth.reduce((sum, item) => {
      if (item.type !== 'income') return sum;
      return sum + convertCurrencyToRub(Number(item.amount || 0), (item.account?.currency ?? 'RUB') as AppCurrency, rates);
    }, 0);
    const expensesRub = currentMonth.reduce((sum, item) => {
      if (item.type !== 'expense') return sum;
      return sum + convertCurrencyToRub(Number(item.amount || 0), (item.account?.currency ?? 'RUB') as AppCurrency, rates);
    }, 0);
    const income = convertRubToCurrency(incomeRub, activeCurrency, rates);
    const expenses = convertRubToCurrency(expensesRub, activeCurrency, rates);
    const delta = income - expenses;
    const accountCount = accounts.filter((account) => account.currency === activeCurrency).length;
    return { activeTotal, rubTotal, income, expenses, delta, accountCount };
  }, [accounts, activeCurrency, rates, transactions]);

  const recent = transactions.slice(0, 3);
  const isEmptyState = accounts.length === 0 && transactions.length === 0;

  const nextCurrency = () => setCurrencyIndex((value) => (value + 1) % Math.max(1, currencies.length));
  const prevCurrency = () => setCurrencyIndex((value) => (value - 1 + Math.max(1, currencies.length)) % Math.max(1, currencies.length));

  return (
    <div className="app-page app-dashboard-page text-white">
      <div className="app-page__inner space-y-4">
        <ScreenTopBar title="Главная" right={['referral', 'history', 'settings']} />

        <header className="app-card app-card--hero app-home-hero app-currency-card" data-no-swipe="true">
          <div className="app-currency-card__top">
            <div>
              <div className="app-eyebrow">Баланс</div>
              <div className="app-currency-card__amount">{formatMoney(data.activeTotal, activeCurrency)}</div>
              <p>{currencyLabels[activeCurrency]} · {data.accountCount || 'нет'} сч.</p>
            </div>
            <div className="app-currency-card__nav">
              <button type="button" onClick={prevCurrency} aria-label="Предыдущая валюта">‹</button>
              <span>{activeCurrency}</span>
              <button type="button" onClick={nextCurrency} aria-label="Следующая валюта">›</button>
            </div>
          </div>

          <div className="app-currency-card__rate">{exchangeHint(activeCurrency, rates)}</div>

          <div className="mt-4 grid grid-cols-3 gap-2 app-home-metrics-grid">
            <div className="app-home-metric"><span>Доходы</span><b>{formatMoney(data.income, activeCurrency, { sign: 'plus' })}</b></div>
            <div className="app-home-metric"><span>Расходы</span><b>{formatMoney(data.expenses, activeCurrency, { sign: 'minus' })}</b></div>
            <div className="app-home-metric"><span>Итог</span><b>{formatMoney(data.delta, activeCurrency, { sign: 'auto' })}</b></div>
          </div>

          {currencies.length > 1 ? (
            <div className="app-currency-card__dots" aria-hidden="true">
              {currencies.map((currency, index) => <i key={currency} data-active={index === currencyIndex % currencies.length} />)}
            </div>
          ) : null}
        </header>

        <ProgressionMiniCard />

        <section className="app-card app-fina-primary-card">
          <div>
            <div className="app-eyebrow">Фина</div>
            <h2>Голос — основной способ</h2>
            <p>Скажи «Фина», затем задачу. Если вокруг шумно, открой текстовый ввод.</p>
          </div>
          <div className="app-fina-actions">
            <button type="button" className="app-primary-button" onClick={() => openAIWithCommand()}>Написать Фине</button>
            <button type="button" className="app-secondary-button" onClick={() => setMenuOpen(true)}>Меню</button>
          </div>
        </section>

        {isEmptyState ? (
          <section className="app-card">
            <div className="app-section-title">Быстрый старт</div>
            <div className="mt-4 grid gap-2">
              {['Создай первый счёт', 'Добавь первый доход', 'Запиши расход', 'Спроси аналитику'].map((label) => (
                <button key={label} type="button" onClick={() => openAIWithCommand()} className="app-list-button">
                  <span>{label}</span>
                  <small>Откроется текстовый ввод к Фине.</small>
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
              <button type="button" onClick={() => openAIWithCommand()} className="app-empty-button">Добавь первую операцию через Фину</button>
            ) : (
              recent.map((transaction) => {
                const sign = transaction.type === 'income' ? 'plus' : transaction.type === 'expense' ? 'minus' : 'none';
                return (
                  <button key={transaction.id} type="button" onClick={() => navigateTo('transactions')} className="app-transaction-row">
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

      {menuOpen ? (
        <div className="app-modal-backdrop" data-no-swipe="true" onClick={() => setMenuOpen(false)}>
          <div className="app-modal-sheet app-home-menu-sheet" data-no-swipe="true" onClick={(event) => event.stopPropagation()}>
            <div className="app-modal-handle" />
            <div className="app-modal-body">
              <div className="app-home-menu-head">
                <div><div className="app-eyebrow">Меню</div><h2>Куда перейти</h2></div>
                <button type="button" className="app-icon-button" onClick={() => setMenuOpen(false)}>×</button>
              </div>
              <div className="app-home-menu-grid">
                {menuLinks.map((item) => (
                  <button key={item.screen} type="button" className="app-list-button" onClick={() => { setMenuOpen(false); navigateTo(item.screen); }}>
                    <span>{item.label}</span>
                    <small>{item.caption}</small>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
