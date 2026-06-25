import { useEffect, useMemo, useState } from 'react';
import { useAccountsStore } from '@/features/accounts/model/accounts.store';
import type { ReceiptScanDto } from '@/features/receipt-scans/api/receiptScans.api';
import { useReceiptScansStore } from '@/features/receipt-scans/model/receiptScans.store';
import { useSectionsStore } from '@/features/sections/model/sections.store';
import type { CategoryDto } from '@/features/sections/api/sections.api';
import { useTransactionsStore } from '@/features/transactions/model/transactions.store';
import { useI18n } from '@/shared/lib/i18n';
import { formatMoney } from '@/shared/lib/money';
import { Drawer } from '@/shared/ui/Drawer';

type Props = {
  initialScan?: ReceiptScanDto;
  layer?: number;
  onClose: () => void;
  open: boolean;
  scanId: string;
};

function toInputDate(value: string | null | undefined) {
  if (!value) return new Date().toISOString().slice(0, 10);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return new Date().toISOString().slice(0, 10);
  return date.toISOString().slice(0, 10);
}

function parseAmount(value: string) {
  const normalized = value.replace(/\s+/g, '').replace(',', '.').trim();
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : null;
}

function firstExpenseCategoryId(categories: CategoryDto[]) {
  return categories.find((category) => category.type === 'expense' || category.type === 'both')?.id ?? '';
}

export function ReceiptReviewSheet({ initialScan, layer, onClose, open, scanId }: Props) {
  const { t } = useI18n();
  const items = useReceiptScansStore((state) => state.items);
  const loadReceipts = useReceiptScansStore((state) => state.load);
  const createExpense = useReceiptScansStore((state) => state.createExpense);
  const review = useReceiptScansStore((state) => state.review);
  const isSaving = useReceiptScansStore((state) => state.isSaving);
  const receiptError = useReceiptScansStore((state) => state.error);
  const accounts = useAccountsStore((state) => state.items);
  const loadAccounts = useAccountsStore((state) => state.loadAccounts);
  const loadTransactions = useTransactionsStore((state) => state.loadTransactions);
  const categories = useSectionsStore((state) => state.categories);
  const loadTaxonomy = useSectionsStore((state) => state.loadAll);
  const scan = items.find((item) => item.id === scanId) ?? initialScan;
  const expenseCategories = useMemo(
    () => categories.filter((category) => category.type === 'expense' || category.type === 'both'),
    [categories],
  );

  const [merchant, setMerchant] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(toInputDate(null));
  const [accountId, setAccountId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    void loadAccounts();
    void loadTaxonomy();
    if (!scan) void loadReceipts();
  }, [loadAccounts, loadReceipts, loadTaxonomy, open, scan]);

  useEffect(() => {
    if (!scan) return;
    setMerchant(scan.merchant ?? '');
    setAmount(scan.totalAmount ? String(scan.totalAmount) : '');
    setDate(toInputDate(scan.purchasedAt));
    setCategoryId(scan.categoryId ?? firstExpenseCategoryId(categories));
    setLocalError(null);
  }, [categories, scan]);

  useEffect(() => {
    if (!accountId && accounts[0]?.id) setAccountId(accounts[0].id);
  }, [accountId, accounts]);

  const amountValue = useMemo(() => parseAmount(amount), [amount]);
  const groups = scan?.preview?.groups ?? [];
  const canConfirm = Boolean(scan && accountId && amountValue && scan.status !== 'expense_created');
  const title = scan?.merchant || scan?.preview?.title || t('receipts.overlay.title');

  const handleSaveReview = async () => {
    if (!scan) return;
    setLocalError(null);
    const updated = await review(scan.id, {
      merchant: merchant || null,
      totalAmount: amountValue,
      currency: scan.currency || 'RUB',
      purchasedAt: date ? new Date(date).toISOString() : null,
      accountId: accountId || null,
      categoryId: categoryId || null,
    });
    if (updated) setIsEditing(false);
  };

  const handleConfirm = async () => {
    if (!scan) return;
    setLocalError(null);
    if (!accountId) {
      setLocalError(t('receipts.overlay.error.account'));
      setIsEditing(true);
      return;
    }
    if (!amountValue) {
      setLocalError(t('receipts.overlay.error.amount'));
      setIsEditing(true);
      return;
    }

    const updated = await createExpense(scan.id, {
      accountId,
      categoryId: categoryId || null,
      amount: amountValue,
      title: merchant || scan.merchant || t('receipts.expense.defaultTitle'),
      merchant: merchant || scan.merchant || null,
      currency: scan.currency || 'RUB',
      date: date ? new Date(date).toISOString() : null,
    });

    if (updated) {
      await Promise.allSettled([loadAccounts(true), loadTransactions(true)]);
      onClose();
    }
  };

  const footer = scan ? (
    <div className="receipt-review-sheet__footer">
      <button type="button" className="receipt-review-sheet__icon-action" onClick={onClose} aria-label={t('common.cancel')}>×</button>
      <button type="button" className="app-secondary-button" onClick={() => setIsEditing((value) => !value)} disabled={isSaving}>
        {isEditing ? t('receipts.overlay.editDone') : t('receipts.overlay.edit')}
      </button>
      <button type="button" className="app-primary-button" onClick={() => void handleConfirm()} disabled={isSaving || !canConfirm}>
        {isSaving ? t('receipts.overlay.confirming') : t('receipts.overlay.confirm')}
      </button>
    </div>
  ) : null;

  return (
    <Drawer
      open={open}
      layer={layer}
      onClose={onClose}
      title={t('receipts.overlay.drawerTitle')}
      subtitle={scan?.preview?.caption ?? t('receipts.overlay.loading')}
      className="receipt-review-sheet"
      bodyClassName="receipt-review-sheet__body"
      footer={footer}
    >
      {!scan ? (
        <div className="receipt-review-sheet__empty">{t('receipts.overlay.loading')}</div>
      ) : (
        <div className="receipt-review-sheet__content">
          <section className="receipt-review-sheet__hero">
            <div>
              <span>{t('receipts.overlay.fina')}</span>
              <h3>{title}</h3>
              <p>{scan.status === 'reviewed' ? t('receipts.overlay.aiReady') : t('receipts.overlay.manualReady')}</p>
            </div>
            <strong>{amountValue ? formatMoney(amountValue, scan.currency || 'RUB') : '—'}</strong>
          </section>

          <section className="receipt-review-sheet__summary">
            <div><span>{t('receipts.review.merchant')}</span><strong>{merchant || scan.merchant || '—'}</strong></div>
            <div><span>{t('receipts.review.date')}</span><strong>{date || '—'}</strong></div>
            <div><span>{t('receipts.review.account')}</span><strong>{accounts.find((account) => account.id === accountId)?.name ?? t('receipts.review.noAccounts')}</strong></div>
            <div><span>{t('receipts.review.category')}</span><strong>{expenseCategories.find((category) => category.id === categoryId)?.name ?? t('receipts.review.noCategory')}</strong></div>
          </section>

          {groups.length ? (
            <section className="receipt-review-sheet__groups">
              <div className="receipt-review-sheet__section-title">{t('receipts.overlay.itemsTitle')}</div>
              {groups.map((group) => (
                <article key={group.sectionName} className="receipt-review-sheet__group">
                  <div className="receipt-review-sheet__group-head">
                    <span>{group.sectionIcon}</span>
                    <strong>{group.sectionName}</strong>
                    {group.amount > 0 ? <em>{formatMoney(group.amount, scan.currency || 'RUB')}</em> : null}
                  </div>
                  <div className="receipt-review-sheet__category">
                    <ul>
                      {group.categories.flatMap((category) => category.items).slice(0, 8).map((item) => (
                        <li key={`${group.sectionName}-${item.title}-${item.amount ?? 'x'}`}>
                          <span>{item.title}</span>
                          <strong>{item.amount ? formatMoney(item.amount, scan.currency || 'RUB') : '—'}</strong>
                        </li>
                      ))}
                    </ul>
                  </div>
                </article>
              ))}
            </section>
          ) : (
            <section className="receipt-review-sheet__empty">{t('receipts.overlay.noItems')}</section>
          )}

          {isEditing ? (
            <section className="receipt-review-sheet__edit">
              <label>
                <span>{t('receipts.review.merchant')}</span>
                <input value={merchant} onChange={(event) => setMerchant(event.target.value)} placeholder={t('receipts.review.merchantPlaceholder')} />
              </label>
              <label>
                <span>{t('receipts.review.amount')}</span>
                <input value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="decimal" placeholder="0" />
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
              <label>
                <span>{t('receipts.review.category')}</span>
                <select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
                  <option value="">{t('receipts.review.noCategory')}</option>
                  {expenseCategories.map((category) => (
                    <option key={category.id} value={category.id}>{category.name}</option>
                  ))}
                </select>
              </label>
              <button type="button" className="app-secondary-button" disabled={isSaving} onClick={() => void handleSaveReview()}>{t('receipts.review.save')}</button>
            </section>
          ) : null}

          {localError || receiptError ? <div className="receipt-inline-error">{localError || receiptError}</div> : null}
        </div>
      )}
    </Drawer>
  );
}
