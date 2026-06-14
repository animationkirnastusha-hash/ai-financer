import type { TransactionDto } from '@/features/transactions/api/transactions.api';
import { useI18n } from '@/shared/lib/i18n';
import { formatMoney } from '@/shared/lib/money';
import {
  formatJournalShortDate,
  journalTransactionAmountPrefix,
  journalTransactionIcon,
  journalTransactionTags,
  journalTransactionTitle,
} from '@/pages/journal/lib/journalHelpers';

type Props = {
  items: TransactionDto[];
  currency: string;
  isMutating: boolean;
  onEdit: (item: TransactionDto) => void;
  onDuplicate: (item: TransactionDto) => void;
  onDelete: (item: TransactionDto) => void;
};

export function JournalTransactionList({ items, currency, isMutating, onEdit, onDuplicate, onDelete }: Props) {
  const { t, language } = useI18n();

  return (
    <section className="journal-list-card app-card">
      {items.map((item) => {
        const itemCurrency = item.account?.currency || currency;
        const tags = journalTransactionTags(item).slice(0, 3);
        return (
          <article key={item.id} className="journal-row">
            <button type="button" className="journal-row__main" onClick={() => onEdit(item)}>
              <span className="journal-row__avatar">{journalTransactionIcon(item)}</span>
              <span className="journal-row__content">
                <b>{journalTransactionTitle(item, t('journal.item.fallback'))}</b>
                <small>{item.category?.name || item.section?.name || t('journal.item.noCategory')} · {item.account?.name || t('journal.item.noAccount')}</small>
                {tags.length ? (
                  <span className="journal-row__tags">
                    {tags.map((tag) => <em key={tag.value}>{tag.label}</em>)}
                  </span>
                ) : null}
              </span>
              <span className="journal-row__meta">
                <b data-type={item.type}>{journalTransactionAmountPrefix(item)}{formatMoney(Number(item.amount) || 0, itemCurrency)}</b>
                <small>{formatJournalShortDate(item.date, language)}</small>
              </span>
            </button>
            <div className="journal-row__actions">
              <button type="button" onClick={() => onEdit(item)}>{t('common.edit')}</button>
              <button type="button" disabled={isMutating} onClick={() => onDuplicate(item)}>{t('journal.action.duplicate')}</button>
              <button type="button" className="journal-row__delete" disabled={isMutating} onClick={() => onDelete(item)}>{t('common.delete')}</button>
            </div>
          </article>
        );
      })}
    </section>
  );
}
