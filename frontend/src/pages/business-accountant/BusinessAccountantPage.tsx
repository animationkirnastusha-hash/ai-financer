import { useEffect, useState } from 'react';
import { BusinessHero } from '@/features/business-workspace/ui/BusinessHero';
import { BusinessModuleList } from '@/features/business-workspace/ui/BusinessModuleList';
import { BusinessSetupCard } from '@/features/business-workspace/ui/BusinessSetupCard';
import { BusinessSummaryCards } from '@/features/business-workspace/ui/BusinessSummaryCards';
import { useBusinessWorkspaceStore } from '@/features/business-workspace/model/businessWorkspace.store';
import { useNavigationStore } from '@/features/navigation/model/navigation.store';
import { useSubscriptionStore } from '@/features/subscription/model/subscription.store';
import { StorePaymentActions } from '@/features/payments/ui/StorePaymentActions';
import { useI18n } from '@/shared/lib/i18n';
import { ScreenTopBar } from '@/shared/ui/ScreenTopBar';
import { Spinner } from '@/shared/ui/Spinner';
import { formatMoney } from '@/shared/lib/money';

type BusinessTab = 'overview' | 'money' | 'accounts' | 'settings';

function BusinessLockedFallback() {
  const { t } = useI18n();
  const navigateTo = useNavigationStore((state) => state.navigateTo);

  return (
    <div className="app-page text-white">
      <div className="app-page__inner space-y-4">
        <ScreenTopBar title={t('screen.business')} left="back" right={['home', 'store']} />
        <section className="app-card business-locked-card">
          <div className="app-eyebrow">{t('business.locked.eyebrow')}</div>
          <h1 className="app-hero-title">{t('business.locked.title')}</h1>
          <p className="app-hero-caption">{t('business.locked.caption')}</p>
          <div className="business-locked-actions">
            <button type="button" className="app-primary-button" onClick={() => navigateTo('store')}>{t('business.locked.action')}</button>
          </div>
          <StorePaymentActions product="business" compact />
        </section>
      </div>
    </div>
  );
}

export default function BusinessAccountantPage() {
  const { t } = useI18n();
  const [tab, setTab] = useState<BusinessTab>('overview');
  const subscription = useSubscriptionStore((state) => state.status);
  const loadSubscription = useSubscriptionStore((state) => state.load);
  const workspace = useBusinessWorkspaceStore((state) => state.workspace);
  const summary = useBusinessWorkspaceStore((state) => state.summary);
  const accounts = useBusinessWorkspaceStore((state) => state.accounts);
  const isLoading = useBusinessWorkspaceStore((state) => state.isLoading);
  const error = useBusinessWorkspaceStore((state) => state.error);
  const loadWorkspace = useBusinessWorkspaceStore((state) => state.load);

  useEffect(() => {
    void loadSubscription();
  }, [loadSubscription]);

  const hasBusiness = Boolean(subscription?.access.hasBusiness);

  useEffect(() => {
    if (hasBusiness) void loadWorkspace();
  }, [hasBusiness, loadWorkspace]);

  if (!hasBusiness) return <BusinessLockedFallback />;

  const tabs: Array<{ id: BusinessTab; label: string }> = [
    { id: 'overview', label: t('business.tab.overview') },
    { id: 'money', label: t('business.tab.money') },
    { id: 'accounts', label: t('business.tab.accounts') },
    { id: 'settings', label: t('business.tab.settings') },
  ];

  return (
    <div className="app-page business-workspace-page text-white">
      <div className="app-page__inner space-y-4">
        <ScreenTopBar title={t('screen.business')} left="back" right={['home', 'settings']} />
        <div className="business-mini-app-shell">
          <BusinessHero />

          <section className="app-card business-mode-note">
            <div>
              <span>{t('business.mode.eyebrow')}</span>
              <strong>{t('business.mode.title')}</strong>
            </div>
            <p>{t('business.mode.caption')}</p>
          </section>

          <nav className="business-tabbar" aria-label={t('business.tabs.label')}>
            {tabs.map((item) => (
              <button key={item.id} type="button" className={tab === item.id ? 'is-active' : undefined} onClick={() => setTab(item.id)}>
                {item.label}
              </button>
            ))}
          </nav>

          {isLoading && !workspace ? <div className="business-loading"><Spinner /></div> : null}
          {error ? <div className="business-error-card">{t('business.error.load')}</div> : null}

          {tab === 'overview' ? (
            <>
              <BusinessSummaryCards summary={summary} />
              <BusinessModuleList />
            </>
          ) : null}

          {tab === 'money' ? (
            <section className="app-card business-money-card">
              <div className="business-section-head">
                <div>
                  <div className="app-eyebrow">{t('business.money.eyebrow')}</div>
                  <h2>{t('business.money.title')}</h2>
                </div>
              </div>
              <div className="business-money-grid">
                <article><span>{t('business.summary.income')}</span><strong>{formatMoney(summary?.monthIncome ?? 0)}</strong></article>
                <article><span>{t('business.summary.expense')}</span><strong>{formatMoney(summary?.monthExpense ?? 0)}</strong></article>
                <article><span>{t('business.summary.profit')}</span><strong>{formatMoney(summary?.profit ?? 0, 'RUB', { sign: 'auto' })}</strong></article>
              </div>
            </section>
          ) : null}

          {tab === 'accounts' ? (
            <section className="app-card business-accounts-card">
              <div className="business-section-head">
                <div>
                  <div className="app-eyebrow">{t('business.accounts.eyebrow')}</div>
                  <h2>{t('business.accounts.title')}</h2>
                </div>
              </div>
              <div className="business-account-list">
                {accounts.length ? accounts.map((account) => (
                  <article key={account.id}>
                    <span>{account.name}</span>
                    <strong>{formatMoney(account.balance, account.currency)}</strong>
                  </article>
                )) : <p>{t('business.accounts.empty')}</p>}
              </div>
            </section>
          ) : null}

          {tab === 'settings' ? <BusinessSetupCard workspace={workspace} accounts={accounts} /> : null}
        </div>
      </div>
    </div>
  );
}
