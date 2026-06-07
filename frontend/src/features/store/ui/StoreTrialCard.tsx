import type { SubscriptionStatusDto } from '@/features/subscription/api/subscription.api';
import { useI18n } from '@/shared/lib/i18n';

type Props = {
  subscription: SubscriptionStatusDto | null;
  isLoading: boolean;
  onStartTrial: () => Promise<void>;
};

export function StoreTrialCard({ subscription, isLoading, onStartTrial }: Props) {
  const { t } = useI18n();
  const trialUsed = Boolean(subscription?.access.trialUsed);

  return (
    <section className="app-card premium-admin-section store-trial-card">
      <div className="premium-admin-section__head">
        <div>
          <div className="app-eyebrow">{t('store.trial.eyebrow')}</div>
          <h2>{t('store.trial.title')}</h2>
        </div>
        <span>{t('store.trial.badge')}</span>
      </div>
      <p>{t('store.trial.caption')}</p>
      <button type="button" className="app-primary-button mt-4 w-full" disabled={isLoading || trialUsed} onClick={onStartTrial}>
        {trialUsed ? t('store.trial.used') : isLoading ? t('store.trial.starting') : t('store.trial.action')}
      </button>
    </section>
  );
}
