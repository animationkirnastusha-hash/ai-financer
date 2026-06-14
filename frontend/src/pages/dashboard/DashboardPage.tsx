import { useEffect, useMemo, useState } from 'react';
import { useAccountsStore } from '@/features/accounts/model/accounts.store';
import { HomeBalanceCarousel } from '@/features/dashboard/ui/HomeBalanceCarousel';
import { HomeCashflowChart } from '@/features/dashboard/ui/HomeCashflowChart';
import { HomeFinanceInsight } from '@/features/dashboard/ui/HomeFinanceInsight';
import { HomeObligationsWidget } from '@/features/obligations/ui/HomeObligationsWidget';
import { FinaCommandBar } from '@/features/fina/ui/FinaCommandBar';
import { ReceiptQuickAction } from '@/features/receipt-scans/ui/ReceiptQuickAction';
import { useSubscriptionStore } from '@/features/subscription/model/subscription.store';
import { useI18n } from '@/shared/lib/i18n';
import type { HomeCashflowMode, HomeCashflowPeriod } from '@/features/dashboard/lib/homeFinanceAnalytics';
import { useNavigationStore } from '@/features/navigation/model/navigation.store';
import { useAppModalStore } from '@/features/modals/model/appModal.store';
import { useFinaPullGesture } from '@/features/chat/lib/useFinaPullGesture';
import { useSettingsStore } from '@/features/settings/model/settings.store';
import type { AppCurrency } from '@/features/settings/model/settings.types';
import { useTransactionsStore } from '@/features/transactions/model/transactions.store';
import { convertCurrency } from '@/features/currency/lib/currency';
import { ScreenTopBar } from '@/shared/ui/ScreenTopBar';

function isCurrentMonth(dateValue: string) {
  const date = new Date(dateValue);
  const now = new Date();
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
}

function toRub(amount: number, currency: string, rates: { usd: number; eur: number }) {
  return convertCurrency(amount, currency, 'RUB', { USD: rates.usd, EUR: rates.eur });
}

function fromRub(amount: number, currency: AppCurrency, rates: { usd: number; eur: number }) {
  return convertCurrency(amount, 'RUB', currency, { USD: rates.usd, EUR: rates.eur });
}

export default function DashboardPage() {
  const { t } = useI18n();
  const navigateTo = useNavigationStore((state) => state.navigateTo);
  const openJournal = useNavigationStore((state) => state.openJournal);
  const openModal = useAppModalStore((state) => state.openModal);
  const modalStackSize = useAppModalStore((state) => state.stack.length);
  const accounts = useAccountsStore((state) => state.items);
  const accountsLoading = useAccountsStore((state) => state.isLoading);
  const accountsError = useAccountsStore((state) => state.error);
  const loadAccounts = useAccountsStore((state) => state.loadAccounts);
  const transactions = useTransactionsStore((state) => state.items);
  const transactionsLoading = useTransactionsStore((state) => state.isLoading);
  const transactionsError = useTransactionsStore((state) => state.error);
  const loadTransactions = useTransactionsStore((state) => state.loadTransactions);
  const subscription = useSubscriptionStore((state) => state.status);
  const loadSubscription = useSubscriptionStore((state) => state.load);

  const [cashflowMode, setCashflowMode] = useState<HomeCashflowMode>('expense');
  const [cashflowPeriod, setCashflowPeriod] = useState<HomeCashflowPeriod>('month');
  const finaPull = useFinaPullGesture({ blocked: modalStackSize > 0, openModal });

  const mainCurrency = useSettingsStore((state) => state.mainCurrency);
  const secondaryCurrencyEnabled = useSettingsStore((state) => state.secondaryCurrencyEnabled);
  const secondaryCurrency = useSettingsStore((state) => state.secondaryCurrency);
  const rubToUsdRate = useSettingsStore((state) => state.rubToUsdRate);
  const rubToEurRate = useSettingsStore((state) => state.rubToEurRate);

  useEffect(() => {
    void Promise.allSettled([loadAccounts(), loadTransactions(), loadSubscription()]);
  }, [loadAccounts, loadSubscription, loadTransactions]);

  const rates = useMemo(() => ({ usd: rubToUsdRate || 90, eur: rubToEurRate || 100 }), [rubToEurRate, rubToUsdRate]);
  const hasBusiness = Boolean(subscription?.access?.hasBusiness);
  const financeIsInitiallyLoading = (accountsLoading || transactionsLoading) && accounts.length === 0 && transactions.length === 0;
  const financeLoadError = accounts.length === 0 && transactions.length === 0 ? accountsError || transactionsError : null;

  const retryFinanceLoad = () => {
    void Promise.allSettled([loadAccounts(true), loadTransactions(true), loadSubscription()]);
  };

  const month = useMemo(() => {
    const currentMonth = transactions.filter((item) => isCurrentMonth(item.date));
    const incomeRub = currentMonth.reduce((sum, item) => item.type === 'income' ? sum + toRub(Number(item.amount || 0), item.account?.currency ?? 'RUB', rates) : sum, 0);
    const expensesRub = currentMonth.reduce((sum, item) => item.type === 'expense' ? sum + toRub(Number(item.amount || 0), item.account?.currency ?? 'RUB', rates) : sum, 0);
    const income = fromRub(incomeRub, mainCurrency, rates);
    const expenses = fromRub(expensesRub, mainCurrency, rates);
    return { income, expenses, delta: income - expenses };
  }, [mainCurrency, rates, transactions]);

  return (
    <div
      ref={finaPull.rootRef}
      className="app-page app-dashboard-page app-dashboard-page--fina-pull text-white"
      {...finaPull.gestureHandlers}
    >
      <div
        className="app-fina-pull-indicator"
        aria-hidden="true"
        data-ready={finaPull.isReadyToOpen ? 'true' : 'false'}
        style={{
          opacity: finaPull.pullOffset ? Math.min(1, finaPull.pullOffset / 72) : 0,
          transform: `translate(-50%, ${Math.min(58, Math.max(0, finaPull.pullOffset - 20))}px)`,
        }}
      >
        <span className="app-fina-pull-indicator__dot" />
        <span>{finaPull.isReadyToOpen ? t('dashboard.finaPull.release') : t('dashboard.finaPull.pull')}</span>
      </div>

      <div className="app-page__inner app-home-layout">
        <ScreenTopBar title={t('screen.dashboard')} right={['notifications', 'analytics', 'settings']} />

        {hasBusiness ? (
          <section className="home-workspace-switch app-card">
            <div>
              <span>{t('dashboard.workspace.label')}</span>
              <strong>{t('dashboard.workspace.personal')}</strong>
            </div>
            <button type="button" onClick={() => navigateTo('business-accountant')}>{t('dashboard.workspace.business')}</button>
          </section>
        ) : null}

        {financeLoadError ? (
          <section className="app-card app-home-load-state app-home-load-state--error">
            <div>
              <span>{t('dashboard.data.errorEyebrow')}</span>
              <strong>{t('dashboard.data.errorTitle')}</strong>
              <p>{t('dashboard.data.errorCaption')}</p>
            </div>
            <button type="button" onClick={retryFinanceLoad}>{t('common.retry')}</button>
          </section>
        ) : financeIsInitiallyLoading ? (
          <section className="app-card app-home-load-state">
            <div>
              <span>{t('dashboard.data.loadingEyebrow')}</span>
              <strong>{t('dashboard.data.loadingTitle')}</strong>
              <p>{t('dashboard.data.loadingCaption')}</p>
            </div>
          </section>
        ) : null}

        <HomeBalanceCarousel
          accounts={accounts}
          mainCurrency={mainCurrency}
          secondaryCurrency={secondaryCurrency}
          secondaryCurrencyEnabled={secondaryCurrencyEnabled}
          rates={rates}
          income={month.income}
          expenses={month.expenses}
          delta={month.delta}
          onOpenAccounts={() => navigateTo('accounts')}
        />

        <FinaCommandBar
          titleKey="dashboard.fina.title"
          captionKey="dashboard.fina.caption"
          placeholderKey="dashboard.fina.placeholder"
          suggestions={[
            { key: 'dashboard.fina.expense', command: 'потратил 450 на кофе' },
            { key: 'dashboard.fina.limit', command: 'сколько осталось до лимита на кафе' },
            { key: 'dashboard.fina.payments', command: 'какие ближайшие платежи на неделю' },
          ]}
        />

        <section className="home-ia-grid" aria-label={t('dashboard.ia.label')}>
          <button type="button" className="app-card home-ia-card" onClick={() => openJournal({ period: 'month' })}>
            <span>{t('dashboard.ia.journal.title')}</span>
            <small>{t('dashboard.ia.journal.caption')}</small>
          </button>
          <button type="button" className="app-card home-ia-card" onClick={() => navigateTo('spending-limits')}>
            <span>{t('dashboard.ia.limits.title')}</span>
            <small>{t('dashboard.ia.limits.caption')}</small>
          </button>
          <button type="button" className="app-card home-ia-card" onClick={() => navigateTo('goals')}>
            <span>{t('dashboard.ia.goals.title')}</span>
            <small>{t('dashboard.ia.goals.caption')}</small>
          </button>
        </section>

        <ReceiptQuickAction />

        <HomeObligationsWidget />

        <HomeCashflowChart
          transactions={transactions}
          mode={cashflowMode}
          period={cashflowPeriod}
          rates={rates}
          onModeChange={setCashflowMode}
          onPeriodChange={setCashflowPeriod}
          onOpenDetails={() => openModal({ type: 'home-chart-details', mode: cashflowMode, period: cashflowPeriod })}
          onCreate={() => openModal({ type: 'transaction-create', initialType: cashflowMode })}
        />

        <HomeFinanceInsight
          transactions={transactions}
          mode={cashflowMode}
          period={cashflowPeriod}
          rates={rates}
        />
      </div>

    </div>
  );
}
