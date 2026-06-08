import { useNavigationStore } from '@/features/navigation/model/navigation.store';
import { usePremiumStore } from '@/features/premium/model/premium.store';
import type { StoreFeature } from '@/features/store/model/storeCatalog';
import { useI18n } from '@/shared/lib/i18n';

type Props = {
  features: StoreFeature[];
};

export function StoreFeatureSection({ features }: Props) {
  const { t } = useI18n();
  const navigateTo = useNavigationStore((state) => state.navigateTo);
  const openPremium = usePremiumStore((state) => state.openPremium);

  const handleFeatureClick = (feature: StoreFeature) => {
    if (feature.title === 'store.features.receipts.title') {
      navigateTo('receipt-scans');
      return;
    }

    openPremium({
      kind: 'locked_insight',
      title: t(feature.title),
      description: t(feature.caption),
      cta: t('store.action.premium'),
    });
  };

  return (
    <section className="app-card monetization-section store-feature-section">
      <div className="monetization-section__head">
        <div>
          <div className="app-eyebrow">{t('store.features.eyebrow')}</div>
          <h2>{t('store.features.title')}</h2>
        </div>
        <span>{t('store.features.badge')}</span>
      </div>
      <div className="store-feature-grid">
        {features.map((feature) => (
          <button type="button" key={feature.title} className="store-feature-card" onClick={() => handleFeatureClick(feature)}>
            <strong>{t(feature.title)}</strong>
            <span>{t(feature.caption)}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
