import { PREMIUM_PLAN } from '../model/premium.catalog';
import type { PremiumTrigger } from '../model/premium.types';
import { useSubscriptionStore } from '@/features/subscription/model/subscription.store';
import { useNavigationStore } from '@/features/navigation/model/navigation.store';
import { StorePaymentActions } from '@/features/payments/ui/StorePaymentActions';
import { useAppModalStore } from '@/features/modals/model/appModal.store';
import { useI18n, type I18nKey } from '@/shared/lib/i18n';
import { hasRealPremiumAccess } from '@/features/subscription/lib/entitlements';
import { Drawer } from '@/shared/ui/Drawer';

const sheetFeatures: I18nKey[] = [
  'premium.sheet.feature.forecast',
  'premium.sheet.feature.reports',
  'premium.sheet.feature.receipts',
  'premium.sheet.feature.voice',
];

type Props = {
  open: boolean;
  trigger: PremiumTrigger | null;
  layer?: number;
  onClose: () => void;
};

export function PremiumUpgradeSheet({ open, trigger, layer, onClose }: Props) {
  const { t } = useI18n();
  const navigateTo = useNavigationStore((state) => state.navigateTo);
  const subscription = useSubscriptionStore((state) => state.status);
  const isLoading = useSubscriptionStore((state) => state.isLoading);
  const openModal = useAppModalStore((state) => state.openModal);

  if (!open || !trigger) return null;

  const hasPremium = hasRealPremiumAccess(subscription);
  const trialUsed = Boolean(subscription?.access.trialUsed);

  const handleStartTrial = async () => {
    onClose();
    window.setTimeout(() => openModal({ type: 'trial-offer', source: 'premium' }), 80);
  };

  const handleOpenStore = () => {
    onClose();
    navigateTo('store');
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      layer={layer}
      className="premium-upgrade-sheet"
      bodyClassName="premium-upgrade-sheet__body"
    >
      <div className="premium-upgrade-hero">
        <div className="premium-upgrade-hero__top">
          <div className="premium-upgrade-kicker">{t('premium.sheet.eyebrow')}</div>
          <div className="premium-upgrade-badge">{hasPremium ? t('premium.sheet.active') : PREMIUM_PLAN.badge}</div>
        </div>

        <h2>{t('premium.sheet.title')}</h2>
        <p>{t('premium.sheet.caption')}</p>

        <div className="premium-upgrade-trigger">
          <div>{trigger.title}</div>
          <p>{trigger.description}</p>
        </div>
      </div>

      <div className="premium-upgrade-feature-grid">
        {sheetFeatures.map((feature) => (
          <div key={feature} className="premium-upgrade-feature">
            <div>{t(feature)}</div>
            <p>{t('premium.sheet.featureCaption')}</p>
          </div>
        ))}
      </div>

      <div className="premium-upgrade-price">
        <div>{PREMIUM_PLAN.price}</div>
        <p>{t('premium.sheet.priceCaption')}</p>
      </div>

      {!hasPremium ? <StorePaymentActions product="premium" compact /> : null}

      <div className="premium-upgrade-actions">
        {hasPremium ? (
          <button type="button" className="app-primary-button" onClick={handleOpenStore}>{t('premium.sheet.openStore')}</button>
        ) : (
          <button
            type="button"
            className="app-primary-button"
            disabled={isLoading || trialUsed}
            onClick={handleStartTrial}
          >
            {trialUsed ? t('premium.sheet.trialUsed') : isLoading ? t('premium.sheet.starting') : t('premium.sheet.tryTrial')}
          </button>
        )}

        <button type="button" onClick={handleOpenStore} className="app-secondary-button">
          {t('premium.sheet.more')}
        </button>

        <button type="button" onClick={onClose} className="premium-upgrade-later">
          {t('premium.sheet.later')}
        </button>
      </div>
    </Drawer>
  );
}
