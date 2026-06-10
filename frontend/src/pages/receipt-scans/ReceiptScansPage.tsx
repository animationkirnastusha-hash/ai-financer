import { useEffect } from 'react';
import { useAccountsStore } from '@/features/accounts/model/accounts.store';
import { PremiumFeatureGate } from '@/features/premium/ui/PremiumFeatureGate';
import { useReceiptScansStore } from '@/features/receipt-scans/model/receiptScans.store';
import { ReceiptScanList } from '@/features/receipt-scans/ui/ReceiptScanList';
import { ReceiptQuickAction } from '@/features/receipt-scans/ui/ReceiptQuickAction';
import { useSubscriptionStore } from '@/features/subscription/model/subscription.store';
import { useI18n } from '@/shared/lib/i18n';
import { ScreenTopBar } from '@/shared/ui/ScreenTopBar';

export default function ReceiptScansPage() {
  const { t } = useI18n();
  const items = useReceiptScansStore((state) => state.items);
  const isLoading = useReceiptScansStore((state) => state.isLoading);
  const isSaving = useReceiptScansStore((state) => state.isSaving);
  const error = useReceiptScansStore((state) => state.error);
  const load = useReceiptScansStore((state) => state.load);
  const review = useReceiptScansStore((state) => state.review);
  const createExpense = useReceiptScansStore((state) => state.createExpense);
  const accounts = useAccountsStore((state) => state.items);
  const loadAccounts = useAccountsStore((state) => state.loadAccounts);
  const loadSubscription = useSubscriptionStore((state) => state.load);

  useEffect(() => {
    void loadSubscription();
    void load();
    void loadAccounts();
  }, [load, loadAccounts, loadSubscription]);

  return (
    <div className="app-page receipt-scans-page text-white">
      <div className="app-page__inner space-y-4">
        <ScreenTopBar title={t('screen.receipts')} left="back" right={['home', 'settings']} />

        <header className="receipt-hero app-card receipt-hero--compact">
          <div className="app-eyebrow">{t('receipts.hero.eyebrow')}</div>
          <h1>{t('receipts.page.title')}</h1>
          <p>{t('receipts.page.caption')}</p>
        </header>

        <PremiumFeatureGate
          feature="receiptScan"
          title="receipts.gate.title"
          caption="receipts.gate.caption"
        >
          <ReceiptQuickAction variant="card" />
        </PremiumFeatureGate>

        {error ? <div className="receipt-inline-error">{error}</div> : null}

        <section className="app-card receipt-history-card">
          <div className="receipt-history-card__head">
            <div>
              <div className="app-eyebrow">{t('receipts.history.eyebrow')}</div>
              <h2>{t('receipts.history.title')}</h2>
            </div>
            <span>{items.length}</span>
          </div>
          <ReceiptScanList
            items={items}
            accounts={accounts}
            isLoading={isLoading}
            isSaving={isSaving}
            onReview={review}
            onCreateExpense={createExpense}
          />
        </section>
      </div>
    </div>
  );
}
