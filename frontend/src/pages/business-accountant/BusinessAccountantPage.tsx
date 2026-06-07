import { useEffect } from 'react';
import { BusinessHero } from '@/features/business-workspace/ui/BusinessHero';
import { BusinessModuleList } from '@/features/business-workspace/ui/BusinessModuleList';
import { BusinessSetupCard } from '@/features/business-workspace/ui/BusinessSetupCard';
import { BusinessSummaryCards } from '@/features/business-workspace/ui/BusinessSummaryCards';
import { useBusinessWorkspaceStore } from '@/features/business-workspace/model/businessWorkspace.store';
import { useAuthStore } from '@/features/auth/model/auth.store';
import { useNavigationStore } from '@/features/navigation/model/navigation.store';
import { useSubscriptionStore } from '@/features/subscription/model/subscription.store';
import { StorePaymentActions } from '@/features/payments/ui/StorePaymentActions';
import { useI18n } from '@/shared/lib/i18n';
import { ScreenTopBar } from '@/shared/ui/ScreenTopBar';
import { Spinner } from '@/shared/ui/Spinner';

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
  const isAdmin = Boolean(useAuthStore((state) => state.user?.isAdmin));
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

  const hasBusiness = Boolean(isAdmin || subscription?.access.hasBusiness);

  useEffect(() => {
    if (hasBusiness) void loadWorkspace();
  }, [hasBusiness, loadWorkspace]);

  if (!hasBusiness) return <BusinessLockedFallback />;

  return (
    <div className="app-page business-workspace-page text-white">
      <div className="app-page__inner space-y-4">
        <ScreenTopBar title={t('screen.business')} left="back" right={['home', 'settings']} />
        <BusinessHero />
        {isLoading && !workspace ? <div className="business-loading"><Spinner /></div> : null}
        {error ? <div className="business-error-card">{t('business.error.load')}</div> : null}
        <BusinessSummaryCards summary={summary} />
        <BusinessSetupCard workspace={workspace} accounts={accounts} />
        <BusinessModuleList />
      </div>
    </div>
  );
}
