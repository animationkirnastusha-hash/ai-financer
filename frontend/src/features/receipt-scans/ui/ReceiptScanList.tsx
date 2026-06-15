import type { AccountDto } from '@/features/accounts/api/accounts.api';
import type { ReceiptScanDto, ReviewReceiptScanPayload } from '@/features/receipt-scans/api/receiptScans.api';
import { ReceiptPreviewCard } from '@/features/receipt-scans/ui/ReceiptPreviewCard';
import { useI18n } from '@/shared/lib/i18n';
import { EmptyState } from '@/shared/ui/EmptyState';

type Props = {
  items: ReceiptScanDto[];
  accounts?: AccountDto[];
  isLoading?: boolean;
  isSaving?: boolean;
  onReview?: (receiptScanId: string, payload: ReviewReceiptScanPayload) => Promise<ReceiptScanDto | null>;
  onCreateExpense?: (receiptScanId: string, payload: { accountId: string; amount?: number | null; title?: string | null; date?: string | null }) => Promise<ReceiptScanDto | null>;
};

export function ReceiptScanList({ items, accounts = [], isLoading = false, isSaving = false, onReview, onCreateExpense }: Props) {
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
      {items.map((scan) => (
        <ReceiptPreviewCard
          key={scan.id}
          scan={scan}
          accounts={accounts}
          isSaving={isSaving}
          onReview={onReview}
          onCreateExpense={onCreateExpense}
        />
      ))}
    </section>
  );
}
