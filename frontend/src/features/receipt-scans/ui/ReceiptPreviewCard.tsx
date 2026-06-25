import type { ReceiptScanDto } from '@/features/receipt-scans/api/receiptScans.api';
import { useAppModalStore } from '@/features/modals/model/appModal.store';
import { useI18n } from '@/shared/lib/i18n';
import { formatMoney } from '@/shared/lib/money';

type Props = {
  scan: ReceiptScanDto;
};

function formatDate(value: string | null | undefined, language: string) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  const locale = language === 'en' ? 'en-US' : 'ru-RU';
  return new Intl.DateTimeFormat(locale, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(date);
}

export function ReceiptPreviewCard({ scan }: Props) {
  const { t, language } = useI18n();
  const openModal = useAppModalStore((state) => state.openModal);
  const groups = scan.preview?.groups ?? [];
  const previewTitle = scan.status === 'expense_created'
    ? t('receipts.preview.title.expenseCreated')
    : scan.merchant || scan.preview?.title || t('receipts.preview.title.uploaded');
  const previewCaption = scan.status === 'expense_created'
    ? t('receipts.preview.caption.expenseCreated')
    : groups.length
      ? t('receipts.preview.caption.grouped')
      : t('receipts.preview.caption.manual');

  return (
    <article className="receipt-preview-card">
      <div className="receipt-preview-card__head">
        <div>
          <strong>{previewTitle}</strong>
          <span>{formatDate(scan.createdAt, language)}</span>
        </div>
        <em>{t(`receipts.status.${scan.status}` as never)}</em>
      </div>
      <p>{previewCaption}</p>

      <div className="receipt-preview-card__fields">
        <div>
          <span>{t('receipts.review.amount')}</span>
          <strong>{scan.totalAmount ? formatMoney(scan.totalAmount, scan.currency || 'RUB') : '—'}</strong>
        </div>
        <div>
          <span>{t('receipts.preview.file')}</span>
          <strong>{scan.fileName}</strong>
        </div>
      </div>

      {groups.length ? (
        <div className="receipt-taxonomy-groups">
          {groups.slice(0, 3).map((group) => (
            <section key={group.sectionName} className="receipt-taxonomy-group">
              <div className="receipt-taxonomy-group__head">
                <i style={{ background: group.sectionColor }}>{group.sectionIcon}</i>
                <span>
                  <b>{group.sectionName}</b>
                  <small>{t('receipts.preview.itemsShort', { count: group.categories[0]?.items.length ?? 0 })}</small>
                </span>
                {group.amount > 0 ? <strong>{formatMoney(group.amount, scan.currency || 'RUB')}</strong> : null}
              </div>
              <div className="receipt-taxonomy-group__categories">
                {group.categories[0]?.items.slice(0, 4).map((item) => (
                  <span key={`${group.sectionName}-${item.title}`}>{item.title}</span>
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : null}

      <button
        type="button"
        className="receipt-preview-card__toggle"
        onClick={() => openModal({ type: 'receipt-review', scanId: scan.id, initialScan: scan })}
      >
        {scan.status === 'expense_created' ? t('receipts.review.open') : t('receipts.overlay.open')}
      </button>
    </article>
  );
}
