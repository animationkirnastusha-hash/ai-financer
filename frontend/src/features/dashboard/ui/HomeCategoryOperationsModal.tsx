import type { TransactionDto } from '@/features/transactions/api/transactions.api';
import type { HomeCashflowMode, HomeFinanceGroup } from '@/features/dashboard/lib/homeFinanceAnalytics';
import { formatMoney, formatTransactionDate } from '@/shared/lib/money';
import { useI18n } from '@/shared/lib/i18n';
import { useNavigationStore } from '@/features/navigation/model/navigation.store';

function operationTitle(transaction: TransactionDto, fallback: string) {
  return transaction.title || transaction.description || transaction.category?.name || fallback;
}

type Props = {
  group: HomeFinanceGroup | null;
  transactions?: TransactionDto[];
  mode?: HomeCashflowMode;
  onClose: () => void;
  modalLayer?: number;
  onEdit: (transaction: TransactionDto) => void;
};

export function HomeCategoryOperationsModal({ group, transactions = [], mode = 'expense', onClose, modalLayer, onEdit }: Props) {
  const { t } = useI18n();
  const openJournal = useNavigationStore((state) => state.openJournal);
  if (!group) return null;

  const liveTransactionIds = new Set(transactions.map((transaction) => transaction.id));
  const source = group.transactions.filter(
    (transaction) => transaction.type === mode && (liveTransactionIds.size === 0 || liveTransactionIds.has(transaction.id)),
  );
  const sorted = [...source].sort((a, b) => Number(b.amount || 0) - Number(a.amount || 0));
  const total = sorted.reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0);
  const journalCategoryId = sorted.find((transaction) => transaction.categoryId)?.categoryId ?? undefined;

  return (
    <div className="app-modal-backdrop app-home-chart-backdrop" style={{ zIndex: modalLayer }} data-no-swipe="true" onClick={onClose}>
      <div className="app-modal-sheet app-home-category-modal" data-no-swipe="true" onClick={(event) => event.stopPropagation()}>
        <div className="app-modal-handle" />
        <div className="app-modal-body">
          <div className="app-home-chart-modal__head">
            <div>
              <div className="app-eyebrow">{group.sectionName}</div>
              <h2>{group.name}</h2>
              <p>{t('dashboard.categoryModal.summary', { count: sorted.length, amount: formatMoney(total || group.amount, 'RUB') })}</p>
            </div>
            <button type="button" className="app-icon-button" onClick={onClose} aria-label={t('common.close')}>×</button>
          </div>

          <button
            type="button"
            className="app-secondary-button app-home-category-modal__journal"
            onClick={() => {
              onClose();
              openJournal({ categoryId: journalCategoryId, tag: group.name ? group.name.toLowerCase().replaceAll('ё', 'е') : undefined, period: 'month', type: mode });
            }}
          >
            {t('dashboard.categoryModal.openJournal')}
          </button>

          <div className="app-home-category-operation-list">
            {sorted.length === 0 ? (
              <div className="app-empty-button">{t('dashboard.categoryModal.empty')}</div>
            ) : sorted.map((transaction) => {
              const sign = transaction.type === 'income' ? 'plus' : transaction.type === 'expense' ? 'minus' : 'none';
              return (
                <button key={transaction.id} type="button" className="app-transaction-row" onClick={() => onEdit(transaction)}>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-white">{operationTitle(transaction, t('dashboard.categoryModal.operationFallback'))}</div>
                    <div className="mt-1 truncate text-xs text-white/40">{formatTransactionDate(transaction.date)} · {transaction.account?.name ?? t('dashboard.categoryModal.accountFallback')}</div>
                  </div>
                  <div className="shrink-0 text-sm font-semibold text-white">{formatMoney(transaction.amount, transaction.account?.currency ?? 'RUB', { sign })}</div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
