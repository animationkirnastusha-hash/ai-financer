import { useEffect, useMemo, useState } from 'react';
import { useAccountsStore } from '@/features/accounts/model/accounts.store';
import { HomeBalanceCarousel } from '@/features/dashboard/ui/HomeBalanceCarousel';
import { HomeCashflowChart } from '@/features/dashboard/ui/HomeCashflowChart';
import { HomeFinanceInsight } from '@/features/dashboard/ui/HomeFinanceInsight';
import { HomeObligationsWidget } from '@/features/obligations/ui/HomeObligationsWidget';
import { FinaCommandBar } from '@/features/fina/ui/FinaCommandBar';
import { ProductLearningCard } from '@/features/onboarding/ui/ProductLearningCard';
import { useI18n } from '@/shared/lib/i18n';
import type { HomeCashflowMode, HomeCashflowPeriod } from '@/features/dashboard/lib/homeFinanceAnalytics';
import { useNavigationStore } from '@/features/navigation/model/navigation.store';
import { useSettingsStore } from '@/features/settings/model/settings.store';
import { useTransactionsStore } from '@/features/transactions/model/transactions.store';
import { ScreenTopBar } from '@/shared/ui/ScreenTopBar';

export default function DashboardPage() {
  const { t } = useI18n();
  const navigateTo = useNavigationStore((state) => state.navigateTo);
  const accounts = useAccountsStore((state) => state.items);
  const accountsLoading = useAccountsStore((state) => state.isLoading);
  const accountsError = useAccountsStore((state) => state.error);
  const loadAccounts = useAccountsStore((state) => state.loadAccounts);
  const transactions = useTransactionsStore((state) => state.items);
  const transactionsLoading = useTransactionsStore((state) => state.isLoading);
  const transactionsError = useTransactionsStore((state) => state.error);
  const loadTransactions = useTransactionsStore((state) => state.loadTransactions);

  const [cashflowMode, setCashflowMode] = useState<HomeCashflowMode>('expense');
  const [cashflowPeriod, setCashflowPeriod] = useState<HomeCashflowPeriod>('month');

  const mainCurrency = useSettingsStore((state) => state.mainCurrency);
  const secondaryCurrencyEnabled = useSettingsStore((state) => state.secondaryCurrencyEnabled);
  const secondaryCurrency = useSettingsStore((state) => state.secondaryCurrency);
  const rubToUsdRate = useSettingsStore((state) => state.rubToUsdRate);
  const rubToEurRate = useSettingsStore((state) => state.rubToEurRate);

  useEffect(() => {
    void Promise.allSettled([loadAccounts(), loadTransactions()]);
  }, [loadAccounts, loadTransactions]);

  const rates = useMemo(() => ({ usd: rubToUsdRate || 90, eur: rubToEurRate || 100 }), [rubToEurRate, rubToUsdRate]);
  const financeIsInitiallyLoading = (accountsLoading || transactionsLoading) && accounts.length === 0 && transactions.length === 0;
  const financeLoadError = accounts.length === 0 && transactions.length === 0 ? accountsError || transactionsError : null;

  const retryFinanceLoad = () => {
    void Promise.allSettled([loadAccounts(true), loadTransactions(true)]);
  };


  return (
    <div className="app-page app-dashboard-page text-white">
      <div className="app-page__inner app-home-layout">
        <ScreenTopBar title={t('screen.dashboard')} right={['notifications', 'settings']} />


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

        <div>
          <ProductLearningCard />
        </div>

        <HomeObligationsWidget />

        <div>
          <HomeCashflowChart
            transactions={transactions}
            mode={cashflowMode}
            period={cashflowPeriod}
            rates={rates}
            balanceSlot={
              <HomeBalanceCarousel
                accounts={accounts}
                mainCurrency={mainCurrency}
                secondaryCurrency={secondaryCurrency}
                secondaryCurrencyEnabled={secondaryCurrencyEnabled}
                rates={rates}
              />
            }
            onModeChange={setCashflowMode}
            onPeriodChange={setCashflowPeriod}
            onOpenDetails={() => navigateTo('analytics')}
            onCreate={() => window.dispatchEvent(new CustomEvent('ai-financer:open-text-chat', { detail: { command: cashflowMode === 'income' ? 'Добавь доход' : 'Добавь расход' } }))}
          />
        </div>

        <div>
          <HomeFinanceInsight
            transactions={transactions}
            mode={cashflowMode}
            period={cashflowPeriod}
            rates={rates}
          />
        </div>

        <div className="app-home-fina-bottom">
          <FinaCommandBar
            compact
            showTextAction={false}
            titleKey="dashboard.fina.title"
            captionKey="dashboard.fina.caption"
            placeholderKey="dashboard.fina.placeholder"
            suggestions={[]}
          />
        </div>
      </div>

    </div>
  );
}
