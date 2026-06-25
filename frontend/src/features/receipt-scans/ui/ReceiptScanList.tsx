import type { ReceiptScanDto } from '@/features/receipt-scans/api/receiptScans.api';
import { ReceiptPreviewCard } from '@/features/receipt-scans/ui/ReceiptPreviewCard';
import { useI18n } from '@/shared/lib/i18n';
import { EmptyState } from '@/shared/ui/EmptyState';

type Props = {
  items: ReceiptScanDto[];
  isLoading?: boolean;
};

export function ReceiptScanList({ items, isLoading = false }: Props) {
  const { t } = useI18n();

  if (isLoading) {
    return <section className="app-card receipt-empty-card">{t('receipts.list.loading')}</section>;
  }

  if (!items.length) {
    return (
      <EmptyState
        eyebrow={t('screen.receipts')}
        title={t('receipts.empty.title')}
        description={t('receipts.empty.caption')}
      />
    );
  }

  return (
    <section className="receipt-list">
      {items.map((scan) => <ReceiptPreviewCard key={scan.id} scan={scan} />)}
    </section>
  );
}
