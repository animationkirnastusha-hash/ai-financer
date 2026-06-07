import { useEffect } from 'react';
import { useNavigationStore } from '@/features/navigation/model/navigation.store';
import { usePremiumStore } from '@/features/premium/model/premium.store';
import { storeCards, storeFeatures, type StoreCard } from '@/features/store/model/storeCatalog';
import { StoreCardGrid } from '@/features/store/ui/StoreCardGrid';
import { StoreFeatureSection } from '@/features/store/ui/StoreFeatureSection';
import { StoreHero } from '@/features/store/ui/StoreHero';
import { StorePaymentSection } from '@/features/store/ui/StorePaymentSection';
import { StoreStatusCard } from '@/features/store/ui/StoreStatusCard';
import { StoreTrialCard } from '@/features/store/ui/StoreTrialCard';
import { StoreUsageCard } from '@/features/store/ui/StoreUsageCard';
import { useSubscriptionStore } from '@/features/subscription/model/subscription.store';
import { useI18n } from '@/shared/lib/i18n';
import { ScreenTopBar } from '@/shared/ui/ScreenTopBar';

export default function PremiumPage() {
  const { t } = useI18n();
  const navigateTo = useNavigationStore((state) => state.navigateTo);
  const openPremium = usePremiumStore((state) => state.openPremium);
  const subscription = useSubscriptionStore((state) => state.status);
  const isLoading = useSubscriptionStore((state) => state.isLoading);
  const loadSubscription = useSubscriptionStore((state) => state.load);
  const startTrial = useSubscriptionStore((state) => state.startTrial);
  const access = subscription?.access;
  const hasPremium = Boolean(access?.hasPremium);
  const hasBusiness = Boolean(access?.hasBusiness);

  useEffect(() => {
    void loadSubscription();
  }, [loadSubscription]);

  const handleStartTrial = async () => {
    await startTrial();
  };

  const handlePremiumOpen = (card: StoreCard) => {
    openPremium({
      kind: 'deep_analysis',
      title: t(card.title),
      description: t(card.caption),
      cta: t(card.action),
    });
  };

  const handleCardClick = (card: StoreCard) => {
    if (card.tone === 'referral') {
      navigateTo('referral');
      return;
    }

    if (card.tone === 'business') {
      navigateTo('business-accountant');
      return;
    }

    handlePremiumOpen(card);
  };

  return (
    <div className="app-page premium-admin-page text-white">
      <div className="app-page__inner space-y-4">
        <ScreenTopBar title={t('screen.store')} left="back" right={['home', 'settings']} />
        <StoreHero premiumCard={storeCards[0]} onPremiumOpen={handlePremiumOpen} />
        <StoreStatusCard subscription={subscription} isLoading={isLoading} />
        <StoreUsageCard subscription={subscription} />
        <StoreCardGrid cards={storeCards} hasPremium={hasPremium} hasBusiness={hasBusiness} onCardClick={handleCardClick} />
        <StoreFeatureSection features={storeFeatures} />
        <StorePaymentSection />
        <StoreTrialCard subscription={subscription} isLoading={isLoading} onStartTrial={handleStartTrial} />
      </div>
    </div>
  );
}
