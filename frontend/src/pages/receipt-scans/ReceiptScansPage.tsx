import { useEffect } from 'react';
import { useNavigationStore } from '@/features/navigation/model/navigation.store';
import { PremiumFeatureGate } from '@/features/premium/ui/PremiumFeatureGate';
import { useReceiptScansStore } from '@/features/receipt-scans/model/receiptScans.store';
import { ReceiptScanList } from '@/features/receipt-scans/ui/ReceiptScanList';
import { ReceiptUploadCard } from '@/features/receipt-scans/ui/ReceiptUploadCard';
import { useSubscriptionStore } from '@/features/subscription/model/subscription.store';
import { useI18n } from '@/shared/lib/i18n';
import { ScreenTopBar } from '@/shared/ui/ScreenTopBar';

export default function ReceiptScansPage() {
  const { t } = useI18n();
  const navigateTo = useNavigationStore((state) => state.navigateTo);
  const items = useReceiptScansStore((state) => state.items);
  const isLoading = useReceiptScansStore((state) => state.isLoading);
  const isUploading = useReceiptScansStore((state) => state.isUploading);
  const error = useReceiptScansStore((state) => state.error);
  const load = useReceiptScansStore((state) => state.load);
  const upload = useReceiptScansStore((state) => state.upload);
  const subscription = useSubscriptionStore((state) => state.status);
  const loadSubscription = useSubscriptionStore((state) => state.load);

  useEffect(() => {
    void loadSubscription();
    void load();
  }, [load, loadSubscription]);

  const remaining = subscription?.usage?.receiptScansThisMonth.remaining ?? 0;
  const hasPremium = Boolean(subscription?.access.hasPremium || subscription?.access.hasBusiness);

  return (
    <div className="app-page receipt-scans-page text-white">
      <div className="app-page__inner space-y-4">
        <ScreenTopBar title={t('screen.receipts')} left="back" right={['home', 'settings']} />

        <header className="receipt-hero app-card">
          <div className="app-eyebrow">{t('receipts.hero.eyebrow')}</div>
          <h1>{t('receipts.hero.title')}</h1>
          <p>{t('receipts.hero.caption')}</p>
          <button type="button" className="app-secondary-button" onClick={() => navigateTo('store')}>
            {t('receipts.hero.store')}
          </button>
        </header>

        <PremiumFeatureGate
          feature="receiptScan"
          title="receipts.gate.title"
          caption="receipts.gate.caption"
        >
          <ReceiptUploadCard
            remaining={remaining}
            disabled={!hasPremium || remaining <= 0}
            isUploading={isUploading}
            onUpload={async (file) => { await upload(file); }}
          />
        </PremiumFeatureGate>

        {error ? <div className="receipt-inline-error">{error}</div> : null}

        <section className="app-card receipt-note-card">
          <strong>{t('receipts.note.title')}</strong>
          <span>{t('receipts.note.caption')}</span>
        </section>

        <ReceiptScanList items={items} isLoading={isLoading} />
      </div>
    </div>
  );
}
