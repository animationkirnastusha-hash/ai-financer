import { useEffect, useMemo, useState } from 'react';
import { useNavigationStore } from '@/features/navigation/model/navigation.store';
import { usePremiumStore } from '@/features/premium/model/premium.store';
import { storeCards, storeFeatures, type StoreCard } from '@/features/store/model/storeCatalog';
import { StoreProductCarousel } from '@/features/store/ui/StoreProductCarousel';
import { StorePaymentSheet } from '@/features/store/ui/StorePaymentSheet';
import { StoreStatusCard } from '@/features/store/ui/StoreStatusCard';
import { StoreTrialCard } from '@/features/store/ui/StoreTrialCard';
import { StoreUsageCard } from '@/features/store/ui/StoreUsageCard';
import { useSubscriptionStore } from '@/features/subscription/model/subscription.store';
import { hasRealPremiumAccess, hasRealBusinessAccess } from '@/features/subscription/lib/entitlements';
import { useI18n } from '@/shared/lib/i18n';
import { ScreenTopBar } from '@/shared/ui/ScreenTopBar';

function StoreCompactExtras({ onOpenReferral, onOpenPremium }: {
  onOpenReferral: () => void;
  onOpenPremium: () => void;
}) {
  const { t } = useI18n();
  const compactFeatures = storeFeatures.slice(0, 3);

  return (
    <section className="store-compact-extras">
      <button type="button" className="store-compact-card store-compact-card--referral" onClick={onOpenReferral}>
        <span>{t('store.referral.eyebrow')}</span>
        <strong>{t('store.referral.title')}</strong>
        <small>{t('store.referral.caption')}</small>
      </button>
      <button type="button" className="store-compact-card store-compact-card--features" onClick={onOpenPremium}>
        <span>{t('store.features.eyebrow')}</span>
        <strong>{t('store.carousel.moreTitle')}</strong>
        <small>{t('store.carousel.moreCaption')}</small>
      </button>
      <div className="store-compact-feature-row" aria-label={t('store.features.title')}>
        {compactFeatures.map((feature) => (
          <div key={feature.title}>
            <strong>{t(feature.title)}</strong>
            <span>{t(feature.caption)}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function PremiumPage() {
  const { t } = useI18n();
  const navigateTo = useNavigationStore((state) => state.navigateTo);
  const openPremium = usePremiumStore((state) => state.openPremium);
  const subscription = useSubscriptionStore((state) => state.status);
  const isLoading = useSubscriptionStore((state) => state.isLoading);
  const loadSubscription = useSubscriptionStore((state) => state.load);
  const startTrial = useSubscriptionStore((state) => state.startTrial);
  const [selectedTone, setSelectedTone] = useState<StoreCard['tone']>('premium');
  const [paymentProduct, setPaymentProduct] = useState<StoreCard | null>(null);
  const hasPremium = hasRealPremiumAccess(subscription);
  const hasBusiness = hasRealBusinessAccess(subscription);

  useEffect(() => {
    void loadSubscription();
  }, [loadSubscription]);

  const carouselCards = useMemo(
    () => storeCards.filter((card) => card.tone === 'premium' || card.tone === 'business'),
    [],
  );

  const selectedCard = useMemo(
    () => carouselCards.find((card) => card.tone === selectedTone) ?? carouselCards[0] ?? storeCards[0],
    [carouselCards, selectedTone],
  );

  const handleStartTrial = async () => {
    await startTrial();
  };

  const handleOpenPayment = (card: StoreCard) => {
    if (card.tone === 'premium' || card.tone === 'business') {
      setPaymentProduct(card);
    }
  };

  const handleOpenReferral = () => {
    navigateTo('referral');
  };

  const handleOpenPremiumSheet = () => {
    const card = selectedCard;
    openPremium({
      kind: 'deep_analysis',
      title: t(card.title),
      description: t(card.caption),
      cta: t('store.carousel.buy'),
    });
  };

  return (
    <div className="app-page monetization-page text-white">
      <div className="app-page__inner space-y-4">
        <ScreenTopBar title={t('screen.store')} left="back" right={['home', 'settings']} />

        <StoreProductCarousel
          cards={carouselCards}
          activeTone={selectedTone}
          hasPremium={hasPremium}
          hasBusiness={hasBusiness}
          onSelect={(card) => setSelectedTone(card.tone)}
          onBuy={handleOpenPayment}
        />

        <div className="store-minimal-grid">
          <StoreStatusCard subscription={subscription} isLoading={isLoading} />
          <StoreUsageCard subscription={subscription} />
        </div>

        <StoreTrialCard subscription={subscription} isLoading={isLoading} onStartTrial={handleStartTrial} />
        <StoreCompactExtras onOpenReferral={handleOpenReferral} onOpenPremium={handleOpenPremiumSheet} />
      </div>

      <StorePaymentSheet open={Boolean(paymentProduct)} product={paymentProduct} onClose={() => setPaymentProduct(null)} />
    </div>
  );
}
