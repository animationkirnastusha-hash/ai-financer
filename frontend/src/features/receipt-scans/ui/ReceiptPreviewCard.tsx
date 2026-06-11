import { useEffect, useMemo, useState } from 'react';
import type { AccountDto } from '@/features/accounts/api/accounts.api';
import type { ReceiptScanDto, ReviewReceiptScanPayload } from '@/features/receipt-scans/api/receiptScans.api';
import { useI18n } from '@/shared/lib/i18n';
import { formatMoney } from '@/shared/lib/money';

type Props = {
  scan: ReceiptScanDto;
  accounts?: AccountDto[];
  isSaving?: boolean;
  onReview?: (receiptScanId: string, payload: ReviewReceiptScanPayload) => Promise<ReceiptScanDto | null>;
  onCreateExpense?: (receiptScanId: string, payload: { accountId: string; amount?: number | null; title?: string | null; date?: string | null }) => Promise<ReceiptScanDto | null>;
};

function formatSize(sizeBytes: number, unitLabel: string) {
  return `${Math.max(1, Math.round(sizeBytes / 1024))} ${unitLabel}`;
}

function formatDate(value: string | null | undefined, language: string) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  const locale = language === 'en' ? 'en-US' : 'ru-RU';
  return new Intl.DateTimeFormat(locale, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(date);
}

function toInputDate(value: string | null | undefined) {
  if (!value) return new Date().toISOString().slice(0, 10);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return new Date().toISOString().slice(0, 10);
  return date.toISOString().slice(0, 10);
}

export function ReceiptPreviewCard({ scan, accounts = [], isSaving = false, onReview, onCreateExpense }: Props) {
  const { t, language } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const [merchant, setMerchant] = useState(scan.merchant ?? '');
  const [amount, setAmount] = useState(scan.totalAmount ? String(scan.totalAmount) : '');
  const [date, setDate] = useState(toInputDate(scan.purchasedAt));
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? '');

  useEffect(() => {
    if (!accountId && accounts[0]?.id) setAccountId(accounts[0].id);
  }, [accountId, accounts]);

  const fields = scan.preview?.fields ?? [
    { label: t('receipts.preview.file'), value: scan.fileName },
    { label: t('receipts.preview.size'), value: formatSize(scan.sizeBytes, t('receipts.preview.kb')) },
  ];

  const amountValue = useMemo(() => {
    const parsed = Number(amount);
    return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : null;
  }, [amount]);

  const canCreateExpense = Boolean(accountId && amountValue && scan.status !== 'expense_created');

  const previewTitle = scan.status === 'expense_created'
    ? t('receipts.preview.title.expenseCreated')
    : scan.status === 'reviewed'
      ? (scan.merchant || t('receipts.preview.title.reviewed'))
      : t('receipts.preview.title.uploaded');

  const previewCaption = scan.status === 'expense_created'
    ? t('receipts.preview.caption.expenseCreated')
    : scan.preview?.groups?.length
      ? t('receipts.preview.caption.grouped')
      : t('receipts.preview.caption.manual');

  const handleReview = async () => {
    if (!onReview) return;
    const updated = await onReview(scan.id, {
      merchant: merchant || null,
      totalAmount: amountValue,
      currency: scan.currency || 'RUB',
      purchasedAt: date ? new Date(date).toISOString() : null,
    });
    if (updated) setIsOpen(false);
  };

  const handleCreateExpense = async () => {
    if (!onCreateExpense || !canCreateExpense) return;
    const updated = await onCreateExpense(scan.id, {
      accountId,
      amount: amountValue,
      title: merchant || scan.merchant || t('receipts.expense.defaultTitle'),
      date: date ? new Date(date).toISOString() : null,
    });
    if (updated) setIsOpen(false);
  };

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
        {fields.map((field) => (
          <div key={`${field.label}-${field.value}`}>
            <span>{field.label}</span>
            <strong>{field.value}</strong>
          </div>
        ))}
      </div>

      {scan.preview?.groups?.length ? (
        <div className="receipt-taxonomy-groups">
          {scan.preview.groups.slice(0, 4).map((group) => (
            <section key={group.sectionName} className="receipt-taxonomy-group">
              <div className="receipt-taxonomy-group__head">
                <i style={{ background: group.sectionColor }}>{group.sectionIcon}</i>
                <span>
                  <b>{group.sectionName}</b>
                  <small>{group.categories.length} кат.</small>
                </span>
                {group.amount > 0 ? <strong>{formatMoney(group.amount, scan.currency || 'RUB')}</strong> : null}
              </div>
              <div className="receipt-taxonomy-group__categories">
                {group.categories.slice(0, 3).map((category) => (
                  <span key={category.categoryName}>
                    {category.categoryIcon} {category.categoryName}
                  </span>
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : null}

      <button type="button" className="receipt-preview-card__toggle" onClick={() => setIsOpen((value) => !value)}>
        {isOpen ? t('common.close') : t('receipts.review.open')}
      </button>

      {isOpen ? (
        <div className="receipt-review-panel">
          <label>
            <span>{t('receipts.review.merchant')}</span>
            <input value={merchant} onChange={(event) => setMerchant(event.target.value)} placeholder={t('receipts.review.merchantPlaceholder')} />
          </label>
          <label>
            <span>{t('receipts.review.amount')}</span>
            <input value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="numeric" placeholder="0" />
          </label>
          <label>
            <span>{t('receipts.review.date')}</span>
            <input value={date} onChange={(event) => setDate(event.target.value)} type="date" />
          </label>
          <label>
            <span>{t('receipts.review.account')}</span>
            <select value={accountId} onChange={(event) => setAccountId(event.target.value)}>
              {accounts.length ? accounts.map((account) => (
                <option key={account.id} value={account.id}>{account.name}</option>
              )) : <option value="">{t('receipts.review.noAccounts')}</option>}
            </select>
          </label>
          <div className="receipt-review-panel__actions">
            <button type="button" disabled={isSaving} onClick={() => void handleReview()}>{t('receipts.review.save')}</button>
            <button type="button" disabled={isSaving || !canCreateExpense} onClick={() => void handleCreateExpense()}>{t('receipts.review.createExpense')}</button>
          </div>
        </div>
      ) : null}
    </article>
  );
}
