import { useEffect, useMemo, useState } from 'react';
import { useNavigationStore } from '@/features/navigation/model/navigation.store';
import { useAppModalStore } from '@/features/modals/model/appModal.store';
import { storeFeatures, storeProductCards, type StoreCard } from '@/features/store/model/storeCatalog';
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


function StoreLaunchHero({ hasPremium, onBuyPremium, onOpenLimits }: {
  hasPremium: boolean;
  onBuyPremium: () => void;
  onOpenLimits: () => void;
}) {
  const { t } = useI18n();

  return (
    <section className="app-card store-launch-hero">
      <div className="store-launch-hero__content">
        <div className="app-eyebrow">{t('store.launch.eyebrow')}</div>
        <h1>{t(hasPremium ? 'store.launch.activeTitle' : 'store.launch.title')}</h1>
        <p>{t(hasPremium ? 'store.launch.activeCaption' : 'store.launch.caption')}</p>
      </div>
      <div className="store-launch-hero__facts" aria-label={t('store.launch.factsAria')}>
        <article>
          <span>{t('store.launch.priceLabel')}</span>
          <strong>{t('store.showcase.premiumPrice')}</strong>
        </article>
        <article>
          <span>{t('store.launch.payLabel')}</span>
          <strong>{t('store.payment.sbp')}</strong>
        </article>
        <article>
          <span>{t('store.launch.businessLabel')}</span>
          <strong>{t('store.status.soon')}</strong>
        </article>
      </div>
      <div className="store-launch-hero__actions">
        <button type="button" className="app-primary-button" disabled={hasPremium} onClick={onBuyPremium}>
          {hasPremium ? t('store.status.active') : t('store.launch.cta')}
        </button>
        <button type="button" className="app-secondary-button" onClick={onOpenLimits}>
          {t('store.launch.secondary')}
        </button>
      </div>
    </section>
  );
}

export default function PremiumPage() {
  const { t } = useI18n();
  const navigateTo = useNavigationStore((state) => state.navigateTo);
  const subscription = useSubscriptionStore((state) => state.status);
  const isLoading = useSubscriptionStore((state) => state.isLoading);
  const loadSubscription = useSubscriptionStore((state) => state.load);
  const openModal = useAppModalStore((state) => state.openModal);
  const [selectedProductId, setSelectedProductId] = useState<string>('premium');
  const hasPremium = hasRealPremiumAccess(subscription);
  const hasBusiness = hasRealBusinessAccess(subscription);

  useEffect(() => {
    void loadSubscription();
  }, [loadSubscription]);

  const selectedCard = useMemo(
    () => storeProductCards.find((card) => card.id === selectedProductId) ?? storeProductCards[0],
    [selectedProductId],
  );
  const premiumCard = useMemo(() => storeProductCards.find((card) => card.id === 'premium') ?? storeProductCards[0], []);

  const handleStartTrial = async () => {
    openModal({ type: 'trial-offer', source: 'store' });
  };

  const handleOpenPayment = (card: StoreCard) => {
    if (card.comingSoon) return;
    if (card.product) openModal({ type: 'store-payment', product: card });
  };

  const handleOpenPremiumPayment = () => {
    setSelectedProductId('premium');
    if (premiumCard?.product && !premiumCard.comingSoon) openModal({ type: 'store-payment', product: premiumCard });
  };

  const handleOpenReferral = () => {
    navigateTo('referral');
  };

  const handleOpenPremiumSheet = () => {
    const card = selectedCard;
    openModal({
      type: 'premium-upgrade',
      trigger: {
        kind: 'deep_analysis',
      title: t(card.title),
      description: t(card.caption),
      cta: t('store.carousel.buy'),
      },
    });
  };

  return (
    <div className="app-page monetization-page text-white">
      <div className="app-page__inner space-y-4">
        <ScreenTopBar title={t('screen.store')} left="back" right={['home', 'settings']} />

        <StoreLaunchHero hasPremium={hasPremium} onBuyPremium={handleOpenPremiumPayment} onOpenLimits={() => openModal({ type: 'store-limits' })} />

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
              <button type="button" className="app-card monetization-section store-limits-button" onClick={() => openModal({ type: 'store-limits' })}>
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
    </div>
  );
}
