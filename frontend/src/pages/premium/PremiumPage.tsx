import { useEffect, useMemo, useState } from 'react';
import { useNavigationStore } from '@/features/navigation/model/navigation.store';
import { usePremiumStore } from '@/features/premium/model/premium.store';
import { useAppModalStore } from '@/features/modals/model/appModal.store';
import { storeFeatures, storeProductCards, type StoreCard } from '@/features/store/model/storeCatalog';
import { StoreLimitsSheet } from '@/features/store/ui/StoreLimitsSheet';
import { StorePaymentSheet } from '@/features/store/ui/StorePaymentSheet';
import { StoreProductDetail } from '@/features/store/ui/StoreProductDetail';
import { StoreFoldoutSection } from '@/features/store/ui/StoreFoldoutSection';
import { StoreProductGrid } from '@/features/store/ui/StoreProductGrid';
import { StoreStatusCard } from '@/features/store/ui/StoreStatusCard';
import { StoreTrialCard } from '@/features/store/ui/StoreTrialCard';
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
  const openModal = useAppModalStore((state) => state.openModal);
  const [selectedProductId, setSelectedProductId] = useState<string>('premium');
  const [paymentProduct, setPaymentProduct] = useState<StoreCard | null>(null);
  const [limitsOpen, setLimitsOpen] = useState(false);
  const hasPremium = hasRealPremiumAccess(subscription);
  const hasBusiness = hasRealBusinessAccess(subscription);

  useEffect(() => {
    void loadSubscription();
  }, [loadSubscription]);

  const selectedCard = useMemo(
    () => storeProductCards.find((card) => card.id === selectedProductId) ?? storeProductCards[0],
    [selectedProductId],
  );

  const handleStartTrial = async () => {
    openModal({ type: 'trial-offer', source: 'store' });
  };

  const handleOpenPayment = (card: StoreCard) => {
    if (card.product) setPaymentProduct(card);
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

        <StoreProductGrid
          cards={storeProductCards}
          activeProductId={selectedProductId}
          hasPremium={hasPremium}
          hasBusiness={hasBusiness}
          onSelect={(card) => setSelectedProductId(card.id)}
        />

        {selectedCard ? (
          <StoreProductDetail card={selectedCard} hasPremium={hasPremium} hasBusiness={hasBusiness} onBuy={handleOpenPayment} />
        ) : null}

        <section className="store-foldout-stack" aria-label={t('store.foldouts.aria')}>
          <StoreFoldoutSection
            eyebrowKey="store.foldouts.access.eyebrow"
            titleKey="store.foldouts.access.title"
            captionKey="store.foldouts.access.caption"
            defaultOpen
          >
            <div className="store-minimal-grid store-minimal-grid--status">
              <StoreStatusCard subscription={subscription} isLoading={isLoading} />
              <button type="button" className="app-card monetization-section store-limits-button" onClick={() => setLimitsOpen(true)}>
                <span className="app-eyebrow">{t('store.limits.eyebrow')}</span>
                <strong>{t('store.limits.title')}</strong>
                <small>{t('store.limits.caption')}</small>
              </button>
            </div>
          </StoreFoldoutSection>

          <StoreFoldoutSection
            eyebrowKey="store.foldouts.trial.eyebrow"
            titleKey="store.foldouts.trial.title"
            captionKey="store.foldouts.trial.caption"
          >
            <StoreTrialCard subscription={subscription} isLoading={isLoading} onStartTrial={handleStartTrial} />
          </StoreFoldoutSection>

          <StoreFoldoutSection
            eyebrowKey="store.foldouts.bonus.eyebrow"
            titleKey="store.foldouts.bonus.title"
            captionKey="store.foldouts.bonus.caption"
          >
            <StoreCompactExtras onOpenReferral={handleOpenReferral} onOpenPremium={handleOpenPremiumSheet} />
          </StoreFoldoutSection>
        </section>
      </div>

      <StoreLimitsSheet open={limitsOpen} subscription={subscription} onClose={() => setLimitsOpen(false)} />
      <StorePaymentSheet open={Boolean(paymentProduct)} product={paymentProduct} onClose={() => setPaymentProduct(null)} />
    </div>
  );
}
