export const RECEIPT_MAX_FILE_BYTES = 20 * 1024 * 1024;

export const RECEIPT_CAMERA_ACCEPT_TYPES = 'image/*';

export const RECEIPT_FILE_ACCEPT_TYPES = 'image/jpeg,image/jpg,image/png,image/webp,image/heic,image/heif,application/pdf';

const ACCEPTED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/pjpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'application/pdf',
]);

const ACCEPTED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif', '.pdf'];

export function getReceiptUploadIssueKey(file: File | null): string | null {
  if (!file) return 'receipts.upload.noFile';
  if (file.size <= 0) return 'receipts.upload.empty';
  if (file.size > RECEIPT_MAX_FILE_BYTES) return 'receipts.upload.tooLarge';

  const mimeType = file.type.toLowerCase().trim();
  const fileName = file.name.toLowerCase().trim();
  const hasKnownExtension = ACCEPTED_EXTENSIONS.some((extension) => fileName.endsWith(extension));

  if (mimeType && ACCEPTED_MIME_TYPES.has(mimeType)) return null;
  if (!mimeType && hasKnownExtension) return null;
  if (mimeType === 'application/octet-stream' && hasKnownExtension) return null;

  return 'receipts.upload.unsupported';
}

export function mapReceiptUploadErrorToKey(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error ?? '');
  const normalized = message.toLowerCase();

  if (normalized.includes('too large') || normalized.includes('file_size') || normalized.includes('limit_file_size')) {
    return 'receipts.upload.tooLarge';
  }

  if (normalized.includes('unsupported') || normalized.includes('file type') || normalized.includes('mime')) {
    return 'receipts.upload.unsupported';
  }

  if (normalized.includes('required') || normalized.includes('empty')) {
    return 'receipts.upload.empty';
  }

  if (normalized.includes('limit reached') || normalized.includes('forbidden')) {
    return 'receipts.upload.limitReached';
  }

  if (normalized.includes('failed to fetch') || normalized.includes('network') || normalized.includes('load fail')) {
    return 'receipts.upload.networkFailed';
  }

  return 'receipts.upload.failed';
}
