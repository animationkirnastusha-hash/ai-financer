import { useEffect, useMemo, useState } from 'react';
import { useAccountsStore } from '@/features/accounts/model/accounts.store';
import { HomeBalanceCarousel } from '@/features/dashboard/ui/HomeBalanceCarousel';
import { HomeCashflowChart } from '@/features/dashboard/ui/HomeCashflowChart';
import { HomeFinanceInsight } from '@/features/dashboard/ui/HomeFinanceInsight';
import { HomeObligationsWidget } from '@/features/obligations/ui/HomeObligationsWidget';
import { FinaCommandBar } from '@/features/fina/ui/FinaCommandBar';
import { ReceiptQuickAction } from '@/features/receipt-scans/ui/ReceiptQuickAction';
import { ProductLearningCard } from '@/features/onboarding/ui/ProductLearningCard';
import { useSubscriptionStore } from '@/features/subscription/model/subscription.store';
import { useI18n } from '@/shared/lib/i18n';
import type { HomeCashflowMode, HomeCashflowPeriod } from '@/features/dashboard/lib/homeFinanceAnalytics';
import { useNavigationStore } from '@/features/navigation/model/navigation.store';
import { useAppModalStore } from '@/features/modals/model/appModal.store';
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
  const openModal = useAppModalStore((state) => state.openModal);
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
    <div className="app-page app-dashboard-page text-white">
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

        <div data-product-tour="home-balance">
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
        </div>

        <div data-product-tour="home-fina">
          <FinaCommandBar
            compact
            showTextAction={false}
            titleKey="dashboard.fina.title"
            captionKey="dashboard.fina.caption"
            placeholderKey="dashboard.fina.placeholder"
            suggestions={[
              { key: 'dashboard.fina.expense', command: 'Потратил на кофе' },
              { key: 'dashboard.fina.payments', command: 'какие ближайшие платежи на неделю' },
            ]}
          />
        </div>

        <div data-product-tour="home-learning">
          <ProductLearningCard />
        </div>

        <section className="home-ia-grid" aria-label={t('dashboard.ia.label')} data-product-tour="home-actions">
          <button type="button" className="app-card home-ia-card" onClick={() => navigateTo('accounts')}>
            <span>{t('dashboard.ia.accounts.title')}</span>
            <small>{t('dashboard.ia.accounts.caption')}</small>
          </button>
          <button type="button" className="app-card home-ia-card" onClick={() => navigateTo('analytics')}>
            <span>{t('dashboard.ia.analytics.title')}</span>
            <small>{t('dashboard.ia.analytics.caption')}</small>
          </button>
          <button type="button" className="app-card home-ia-card" onClick={() => navigateTo('obligations')}>
            <span>{t('dashboard.ia.obligations.title')}</span>
            <small>{t('dashboard.ia.obligations.caption')}</small>
          </button>
        </section>

        <div data-product-tour="home-receipt">
          <ReceiptQuickAction />
        </div>

        <HomeObligationsWidget />

        <div data-product-tour="home-chart">
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
        </div>

        <div data-product-tour="home-insight">
          <HomeFinanceInsight
            transactions={transactions}
            mode={cashflowMode}
            period={cashflowPeriod}
            rates={rates}
          />
        </div>
      </div>

    </div>
  );
}
