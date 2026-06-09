import { useEffect, useMemo, useState } from 'react';
import { useNavigationStore } from '@/features/navigation/model/navigation.store';
import { usePremiumStore } from '@/features/premium/model/premium.store';
import { storeCards, storeFeatures, type StoreCard } from '@/features/store/model/storeCatalog';
import { StoreFeatureSection } from '@/features/store/ui/StoreFeatureSection';
import { StoreHero } from '@/features/store/ui/StoreHero';
import { StoreStatusCard } from '@/features/store/ui/StoreStatusCard';
import { StoreTrialCard } from '@/features/store/ui/StoreTrialCard';
import { StorePaymentActions } from '@/features/payments/ui/StorePaymentActions';
import { StoreUsageCard } from '@/features/store/ui/StoreUsageCard';
import { useSubscriptionStore } from '@/features/subscription/model/subscription.store';
import { hasRealPremiumAccess, hasRealBusinessAccess } from '@/features/subscription/lib/entitlements';
import { useI18n } from '@/shared/lib/i18n';
import { ScreenTopBar } from '@/shared/ui/ScreenTopBar';

function StoreProductShowcase({ selected, cards, hasPremium, hasBusiness, onSelect, onOpen }: {
  selected: StoreCard;
  cards: StoreCard[];
  hasPremium: boolean;
  hasBusiness: boolean;
  onSelect: (card: StoreCard) => void;
  onOpen: (card: StoreCard) => void;
}) {
  const { t } = useI18n();
  const selectedActive = selected.tone === 'premium' ? hasPremium : selected.tone === 'business' ? hasBusiness : false;

  return (
    <section className="store-showcase app-card">
      <div className="store-showcase__head">
        <div>
          <div className="app-eyebrow">{t('store.showcase.eyebrow')}</div>
          <h2>{t('store.showcase.title')}</h2>
        </div>
      </div>

      <div className="store-product-tabs" role="tablist" aria-label={t('store.showcase.tabs')}>
        {cards.map((card) => (
          <button key={card.title} type="button" className={card.title === selected.title ? 'is-active' : undefined} onClick={() => onSelect(card)}>
            <span>{t(card.eyebrow)}</span>
            {(card.tone === 'premium' && hasPremium) || (card.tone === 'business' && hasBusiness) ? <small>{t('store.status.active')}</small> : null}
          </button>
        ))}
      </div>

      <article className={`store-product-detail store-product-detail--${selected.tone}`}>
        <div className="store-product-detail__copy">
          <div className="app-eyebrow">{t(selected.eyebrow)}</div>
          <h3>{t(selected.title)}</h3>
          <p>{t(selected.caption)}</p>
          <ul>
            {selected.items.map((item) => <li key={item}>{t(item)}</li>)}
          </ul>
        </div>
        <div className="store-product-detail__side">
          <span>{selectedActive ? t('store.status.active') : t('store.showcase.price')}</span>
          <strong>{selected.tone === 'business' ? t('store.showcase.businessPrice') : selected.tone === 'premium' ? t('store.showcase.premiumPrice') : t('store.showcase.referralPrice')}</strong>
          {selected.tone === 'premium' || selected.tone === 'business' ? (
            <StorePaymentActions product={selected.tone} compact />
          ) : (
            <button type="button" className="app-primary-button" onClick={() => onOpen(selected)}>{t(selected.action)}</button>
          )}
        </div>
      </article>
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
  const hasPremium = hasRealPremiumAccess(subscription);
  const hasBusiness = hasRealBusinessAccess(subscription);

  useEffect(() => {
    void loadSubscription();
  }, [loadSubscription]);

  const visibleCards = useMemo(() => storeCards.filter((card) => {
    if (card.tone === 'business') return true;
    if (card.tone === 'premium') return true;
    if (card.tone === 'referral') return true;
    return true;
  }), []);

  const selectedCard = useMemo(
    () => visibleCards.find((card) => card.tone === selectedTone) ?? visibleCards[0] ?? storeCards[0],
    [selectedTone, visibleCards],
  );

  const handleStartTrial = async () => {
    await startTrial();
  };

  const handlePremiumOpen = (card: StoreCard) => {
    if (card.tone === 'referral') {
      navigateTo('referral');
      return;
    }

    if (card.tone === 'business') {
      navigateTo('business-accountant');
      return;
    }

    openPremium({
      kind: 'deep_analysis',
      title: t(card.title),
      description: t(card.caption),
      cta: t(card.action),
    });
  };

  return (
    <div className="app-page monetization-page text-white">
      <div className="app-page__inner space-y-4">
        <ScreenTopBar title={t('screen.store')} left="back" right={['home', 'settings']} />
        {visibleCards[0] ? <StoreHero premiumCard={visibleCards[0]} onPremiumOpen={handlePremiumOpen} /> : null}
        {visibleCards.length > 0 ? <StoreProductShowcase
          cards={visibleCards}
          selected={selectedCard}
          hasPremium={hasPremium}
          hasBusiness={hasBusiness}
          onSelect={(card) => setSelectedTone(card.tone)}
          onOpen={handlePremiumOpen}
        /> : null}
        <StoreStatusCard subscription={subscription} isLoading={isLoading} />
        <StoreUsageCard subscription={subscription} />
        <StoreFeatureSection features={storeFeatures} />
        <StoreTrialCard subscription={subscription} isLoading={isLoading} onStartTrial={handleStartTrial} />
      </div>
    </div>
  );
}
