import type { ReceiptScanDto } from '@/features/receipt-scans/api/receiptScans.api';
import { ReceiptPreviewCard } from '@/features/receipt-scans/ui/ReceiptPreviewCard';
import { useI18n } from '@/shared/lib/i18n';

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
      <section className="app-card receipt-empty-card">
        <strong>{t('receipts.empty.title')}</strong>
        <span>{t('receipts.empty.caption')}</span>
      </section>
    );
  }

  return (
    <section className="receipt-list">
      {items.map((scan) => <ReceiptPreviewCard key={scan.id} scan={scan} />)}
    </section>
  );
}
