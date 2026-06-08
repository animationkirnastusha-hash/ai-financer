import type { SubscriptionStatusDto } from '@/features/subscription/api/subscription.api';
import { useI18n } from '@/shared/lib/i18n';

type Props = {
  subscription: SubscriptionStatusDto | null;
};

export function StoreUsageCard({ subscription }: Props) {
  const { t } = useI18n();
  const usage = subscription?.usage;
  if (!usage) return null;

  return (
    <section className="app-card monetization-section store-usage-card">
      <div className="monetization-section__head">
        <div>
          <div className="app-eyebrow">{t('store.usage.eyebrow')}</div>
          <h2>{t('store.usage.title')}</h2>
        </div>
        <span>{t('store.usage.today')}</span>
      </div>
      <div className="store-usage-grid">
        <div>
          <strong>{usage.voiceCommandsToday.remaining}</strong>
          <span>{t('store.usage.voiceLeft', { limit: usage.voiceCommandsToday.limit })}</span>
        </div>
        <div>
          <strong>{usage.receiptScansThisMonth.remaining}</strong>
          <span>{t('store.usage.receiptsLeft', { limit: usage.receiptScansThisMonth.limit })}</span>
        </div>
        <div>
          <strong>{usage.advancedReportsThisMonth.remaining}</strong>
          <span>{t('store.usage.reportsLeft', { limit: usage.advancedReportsThisMonth.limit })}</span>
        </div>
      </div>
    </section>
  );
}
