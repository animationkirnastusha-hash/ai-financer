import type { SubscriptionStatusDto } from '@/features/subscription/api/subscription.api';
import { useI18n } from '@/shared/lib/i18n';

function formatAccessDate(value: string | null | undefined, fallback: string) {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: 'long' }).format(date);
}

type Props = {
  subscription: SubscriptionStatusDto | null;
  isLoading: boolean;
};

export function StoreStatusCard({ subscription, isLoading }: Props) {
  const { t } = useI18n();
  const access = subscription?.access;
  const hasPremium = Boolean(access?.hasPremium);
  const hasBusiness = Boolean(access?.hasBusiness);
  const statusText = hasBusiness
    ? t('store.status.business')
    : hasPremium
      ? t('store.status.premium')
      : t('store.status.free');
  const statusCaption = access?.businessLifetime || access?.premiumLifetime
    ? t('store.status.forever')
    : access?.businessUntil
      ? t('store.status.until', { date: formatAccessDate(access.businessUntil, '—') })
      : access?.premiumUntil
        ? t('store.status.until', { date: formatAccessDate(access.premiumUntil, '—') })
        : access?.trialUntil
          ? t('store.status.trialUntil', { date: formatAccessDate(access.trialUntil, '—') })
          : t('store.status.freeCaption');

  return (
    <section className="app-card monetization-section store-status-card">
      <div className="monetization-section__head">
        <div>
          <div className="app-eyebrow">{t('store.status.eyebrow')}</div>
          <h2>{isLoading ? t('store.status.loading') : statusText}</h2>
        </div>
        <span className={hasBusiness || hasPremium ? 'store-active-badge' : undefined}>
          {hasBusiness || hasPremium ? t('store.status.active') : subscription ? `${subscription.limits.voiceCommandsPerDay} ${t('store.status.voiceLimit')}` : '—'}
        </span>
      </div>
      <p>{statusCaption}</p>
    </section>
  );
}
