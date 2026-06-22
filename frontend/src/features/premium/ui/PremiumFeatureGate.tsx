import type { ReactNode } from 'react';
import { useAppModalStore } from '@/features/modals/model/appModal.store';
import { useSubscriptionStore } from '@/features/subscription/model/subscription.store';
import { hasFeatureAccess, hasPaidAccess } from '@/features/subscription/lib/entitlements';
import { useI18n, type I18nKey } from '@/shared/lib/i18n';

type Props = {
  feature: string;
  title: I18nKey;
  caption: I18nKey;
  children?: ReactNode;
  className?: string;
};

export function PremiumFeatureGate({ feature, title, caption, children, className }: Props) {
  const { t } = useI18n();
  const subscription = useSubscriptionStore((state) => state.status);
  const openModal = useAppModalStore((state) => state.openModal);
  const hasAnyPaidAccess = hasPaidAccess(subscription);
  const isAllowed = hasFeatureAccess(subscription, feature);

  if (isAllowed) return <>{children}</>;
  if (!hasAnyPaidAccess) return null;

  return (
    <button
      type="button"
      className={`premium-feature-gate ${className ?? ''}`.trim()}
      onClick={() => openModal({
        type: 'premium-upgrade',
        trigger: {
          kind: 'locked_insight',
          title: t(title),
          description: t(caption),
          cta: t('premium.gate.action'),
        },
      })}
    >
      <span className="premium-feature-gate__badge">{t('premium.gate.badge')}</span>
      <strong>{t(title)}</strong>
      <small>{t(caption)}</small>
      <em>{t('premium.gate.action')}</em>
    </button>
  );
}
