import { useRef, useState } from 'react';
import { useI18n } from '@/shared/lib/i18n';

type Props = {
  disabled?: boolean;
  isUploading?: boolean;
  remaining: number;
  onUpload: (file: File) => Promise<void>;
};

const MAX_FILE_BYTES = 8 * 1024 * 1024;
const ACCEPTED_TYPES = 'image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf';

export function ReceiptUploadCard({ disabled = false, isUploading = false, remaining, onUpload }: Props) {
  const { t } = useI18n();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleFile = async (file: File | null) => {
    setLocalError(null);
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) {
      setLocalError(t('receipts.upload.tooLarge'));
      return;
    }
    await onUpload(file);
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <section className="app-card receipt-upload-card">
      <div className="receipt-upload-card__head">
        <div>
          <div className="app-eyebrow">{t('receipts.upload.eyebrow')}</div>
          <h2>{t('receipts.upload.title')}</h2>
        </div>
        <span>{t('receipts.upload.limit', { count: remaining })}</span>
      </div>
      <p>{t('receipts.upload.caption')}</p>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_TYPES}
        className="sr-only"
        disabled={disabled || isUploading}
        onChange={(event) => void handleFile(event.target.files?.[0] ?? null)}
      />
      <button
        type="button"
        className="app-primary-button receipt-upload-card__action"
        disabled={disabled || isUploading}
        onClick={() => inputRef.current?.click()}
      >
        {isUploading ? t('receipts.upload.uploading') : t('receipts.upload.action')}
      </button>
      {localError ? <div className="receipt-inline-error">{localError}</div> : null}
    </section>
  );
}
