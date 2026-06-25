import { useCallback, useEffect, useRef, useState } from 'react';
import { useAppModalStore } from '@/features/modals/model/appModal.store';
import { useReceiptScansStore } from '@/features/receipt-scans/model/receiptScans.store';
import { useSubscriptionStore } from '@/features/subscription/model/subscription.store';
import { useI18n } from '@/shared/lib/i18n';

const RECEIPT_MAX_FILE_BYTES = 20 * 1024 * 1024;
const RECEIPT_CAMERA_TYPES = 'image/*';
const RECEIPT_ACCEPTED_TYPES = 'image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf';

type Props = {
  variant?: 'card' | 'compact';
  className?: string;
};

export function ReceiptQuickAction({ variant = 'card', className = '' }: Props) {
  const { t } = useI18n();
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const subscription = useSubscriptionStore((state) => state.status);
  const loadSubscription = useSubscriptionStore((state) => state.load);
  const upload = useReceiptScansStore((state) => state.upload);
  const isUploading = useReceiptScansStore((state) => state.isUploading);
  const openModal = useAppModalStore((state) => state.openModal);

  useEffect(() => {
    if (!subscription) void loadSubscription();
  }, [loadSubscription, subscription]);

  const hasAccess = Boolean(subscription?.access?.hasPremium || subscription?.access?.hasBusiness || subscription?.features?.receiptScan);
  const remaining = subscription?.usage?.receiptScansThisMonth?.remaining;

  const handleReceiptFile = useCallback(async (file: File | null) => {
    if (!file || !hasAccess || isUploading) return;
    if (file.size > RECEIPT_MAX_FILE_BYTES) {
      setHint(t('receipts.upload.tooLarge'));
      return;
    }

    setHint(t('textChat.receipt.uploading'));
    const scan = await upload(file);
    setHint(scan ? t('textChat.receipt.success') : t('textChat.receipt.error'));
    if (scan) openModal({ type: 'receipt-review', scanId: scan.id, initialScan: scan });
    if (cameraInputRef.current) cameraInputRef.current.value = '';
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [hasAccess, isUploading, openModal, t, upload]);

  if (!hasAccess) return null;

  return (
    <section className={`receipt-quick-action receipt-quick-action--${variant} ${className}`}>
      {variant === 'card' ? (
        <div className="receipt-quick-action__copy">
          <div className="app-eyebrow">{t('receipts.quick.eyebrow')}</div>
          <h2>{t('receipts.quick.title')}</h2>
          <p>{t('receipts.quick.caption')}</p>
        </div>
      ) : null}

      <div className="receipt-quick-action__actions">
        <button type="button" className="receipt-quick-action__main" disabled={isUploading} onClick={() => fileInputRef.current?.click()}>
          {isUploading ? t('receipts.upload.uploading') : t('textChat.receipt.action')}
        </button>
        <button type="button" className="receipt-quick-action__mini" disabled={isUploading} onClick={() => cameraInputRef.current?.click()} aria-label={t('textChat.receipt.camera')}>
          ◉
        </button>
        <input ref={cameraInputRef} type="file" accept={RECEIPT_CAMERA_TYPES} capture="environment" className="sr-only" onChange={(event) => void handleReceiptFile(event.target.files?.[0] ?? null)} />
        <input ref={fileInputRef} type="file" accept={RECEIPT_ACCEPTED_TYPES} className="sr-only" onChange={(event) => void handleReceiptFile(event.target.files?.[0] ?? null)} />
      </div>

      {typeof remaining === 'number' ? <span className="receipt-quick-action__limit">{t('receipts.upload.limit', { count: remaining })}</span> : null}
      {hint ? <div className="receipt-quick-action__hint">{hint}</div> : null}
    </section>
  );
}
