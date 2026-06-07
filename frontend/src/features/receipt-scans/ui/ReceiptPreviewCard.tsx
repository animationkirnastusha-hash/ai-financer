import type { ReceiptScanDto } from '@/features/receipt-scans/api/receiptScans.api';
import { useI18n } from '@/shared/lib/i18n';

type Props = {
  scan: ReceiptScanDto;
};

function formatSize(sizeBytes: number) {
  return `${Math.max(1, Math.round(sizeBytes / 1024))} КБ`;
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(date);
}

export function ReceiptPreviewCard({ scan }: Props) {
  const { t } = useI18n();
  const fields = scan.preview?.fields ?? [
    { label: t('receipts.preview.file'), value: scan.fileName },
    { label: t('receipts.preview.size'), value: formatSize(scan.sizeBytes) },
  ];

  return (
    <article className="receipt-preview-card">
      <div className="receipt-preview-card__head">
        <div>
          <strong>{scan.preview?.title ?? t('receipts.preview.title')}</strong>
          <span>{formatDate(scan.createdAt)}</span>
        </div>
        <em>{t('receipts.status.uploaded')}</em>
      </div>
      <p>{scan.preview?.caption ?? t('receipts.preview.caption')}</p>
      <div className="receipt-preview-card__fields">
        {fields.map((field) => (
          <div key={`${field.label}-${field.value}`}>
            <span>{field.label}</span>
            <strong>{field.value}</strong>
          </div>
        ))}
      </div>
    </article>
  );
}
