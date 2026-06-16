import { useEffect } from 'react';
import { PREMIUM_PLAN } from '../model/premium.catalog';
import { usePremiumStore } from '../model/premium.store';
import { useSubscriptionStore } from '@/features/subscription/model/subscription.store';
import { useNavigationStore } from '@/features/navigation/model/navigation.store';
import { StorePaymentActions } from '@/features/payments/ui/StorePaymentActions';
import { useAppModalStore } from '@/features/modals/model/appModal.store';
import { useI18n, type I18nKey } from '@/shared/lib/i18n';
import { hasPaidAccess, hasRealPremiumAccess } from '@/features/subscription/lib/entitlements';

const sheetFeatures: I18nKey[] = [
  'premium.sheet.feature.forecast',
  'premium.sheet.feature.reports',
  'premium.sheet.feature.receipts',
  'premium.sheet.feature.voice',
];

export function PremiumUpgradeSheet() {
  const { t } = useI18n();
  const open = usePremiumStore((state) => state.isPremiumOpen);
  const trigger = usePremiumStore((state) => state.activeTrigger);
  const close = usePremiumStore((state) => state.closePremium);
  const navigateTo = useNavigationStore((state) => state.navigateTo);
  const subscription = useSubscriptionStore((state) => state.status);
  const isLoading = useSubscriptionStore((state) => state.isLoading);
  const loadSubscription = useSubscriptionStore((state) => state.load);
  const openModal = useAppModalStore((state) => state.openModal);

  useEffect(() => {
    if (open) void loadSubscription();
  }, [loadSubscription, open]);

  useEffect(() => {
    document.body.classList.toggle('ai-modal-open', open);
    return () => document.body.classList.remove('ai-modal-open');
  }, [open]);

  const hasVisibleAccess = hasPaidAccess(subscription);

  if (!open || !trigger || !hasVisibleAccess) return null;

  const hasPremium = hasRealPremiumAccess(subscription);
  const trialUsed = Boolean(subscription?.access.trialUsed);

  const handleStartTrial = async () => {
    close();
    window.setTimeout(() => openModal({ type: 'trial-offer', source: 'premium' }), 80);
  };

  const handleOpenStore = () => {
    close();
    navigateTo('store');
  };

  return (
    <div data-no-swipe="true" data-ai-core-modal="true" className="fixed inset-0 z-[120] flex items-end bg-black/65 backdrop-blur-sm">
      <div className="premium-upgrade-sheet max-h-[92dvh] w-full overflow-y-auto rounded-t-[32px] border border-white/10 bg-[#0b1016] px-4 pb-[calc(env(safe-area-inset-bottom)+24px)] pt-4 text-white shadow-2xl">
        <div className="mx-auto mb-4 h-1.5 w-14 rounded-full bg-white/15" />

        <div className="mx-auto max-w-[560px]">
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

          {!hasPremium ? (
            <StorePaymentActions product="premium" compact />
          ) : null}

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

            <button type="button" onClick={close} className="premium-upgrade-later">
              {t('premium.sheet.later')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
