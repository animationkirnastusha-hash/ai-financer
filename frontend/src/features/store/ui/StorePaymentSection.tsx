import { StorePaymentActions } from '@/features/payments/ui/StorePaymentActions';
import { useI18n } from '@/shared/lib/i18n';

export function StorePaymentSection() {
  const { t } = useI18n();

  return (
    <section className="app-card monetization-section store-payment-section">
      <div className="monetization-section__head">
        <div>
          <div className="app-eyebrow">{t('store.payment.eyebrow')}</div>
          <h2>{t('store.payment.title')}</h2>
        </div>
        <span>{t('store.payment.badge')}</span>
      </div>
      <p>{t('store.payment.caption')}</p>
      <div className="store-payment-grid">
        <StorePaymentActions product="premium" title={t('store.payment.premiumTitle')} compact />
      </div>
    </section>
  );
}
