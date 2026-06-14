import type { AccountDto } from '@/features/accounts/api/accounts.api';
import type { CategoryDto } from '@/features/sections/api/sections.api';
import { useI18n } from '@/shared/lib/i18n';
import type { JournalPeriod, JournalTagOption, JournalTypeFilter } from '@/pages/journal/lib/journalTypes';

type Props = {
  query: string;
  period: JournalPeriod;
  type: JournalTypeFilter;
  accountId: string;
  categoryId: string;
  selectedTag: string;
  dateFrom: string;
  dateTo: string;
  accounts: AccountDto[];
  categories: CategoryDto[];
  tagOptions: JournalTagOption[];
  onQueryChange: (value: string) => void;
  onPeriodChange: (value: JournalPeriod) => void;
  onTypeChange: (value: JournalTypeFilter) => void;
  onAccountChange: (value: string) => void;
  onCategoryChange: (value: string) => void;
  onTagChange: (value: string) => void;
  onDateFromChange: (value: string) => void;
  onDateToChange: (value: string) => void;
};

const PERIODS: JournalPeriod[] = ['today', 'week', 'month', 'year', 'all', 'custom'];
const TYPES: JournalTypeFilter[] = ['all', 'expense', 'income', 'transfer'];

function typeLabelKey(type: JournalTypeFilter) {
  if (type === 'all') return 'journal.type.all';
  if (type === 'expense') return 'transaction.type.expense';
  if (type === 'income') return 'transaction.type.income';
  return 'transaction.type.transfer';
}

export function JournalFilterPanel({
  query,
  period,
  type,
  accountId,
  categoryId,
  selectedTag,
  dateFrom,
  dateTo,
  accounts,
  categories,
  tagOptions,
  onQueryChange,
  onPeriodChange,
  onTypeChange,
  onAccountChange,
  onCategoryChange,
  onTagChange,
  onDateFromChange,
  onDateToChange,
}: Props) {
  const { t } = useI18n();

  return (
    <section className="app-card journal-filter-card">
      <label className="journal-search-field">
        <span>{t('journal.filters.search')}</span>
        <input
          value={query}
          placeholder={t('journal.filters.searchPlaceholder')}
          onChange={(event) => onQueryChange(event.target.value)}
        />
      </label>

      <div className="journal-period-row" aria-label={t('journal.filters.period')}>
        {PERIODS.map((item) => (
          <button
            key={item}
            type="button"
            data-active={period === item}
            onClick={() => onPeriodChange(item)}
          >
            {t(`journal.period.${item}`)}
          </button>
        ))}
      </div>

      {period === 'custom' ? (
        <div className="journal-date-grid">
          <label>
            <span>{t('journal.filters.from')}</span>
            <input type="date" value={dateFrom} onChange={(event) => onDateFromChange(event.target.value)} />
          </label>
          <label>
            <span>{t('journal.filters.to')}</span>
            <input type="date" value={dateTo} onChange={(event) => onDateToChange(event.target.value)} />
          </label>
        </div>
      ) : null}

      <div className="journal-filter-grid">
        <label>
          <span>{t('journal.filters.type')}</span>
          <select value={type} onChange={(event) => onTypeChange(event.target.value as JournalTypeFilter)}>
            {TYPES.map((item) => <option key={item} value={item}>{t(typeLabelKey(item))}</option>)}
          </select>
        </label>

        <label>
          <span>{t('journal.filters.account')}</span>
          <select value={accountId} onChange={(event) => onAccountChange(event.target.value)}>
            <option value="all">{t('journal.account.all')}</option>
            {accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
          </select>
        </label>

        <label>
          <span>{t('journal.filters.category')}</span>
          <select value={categoryId} onChange={(event) => onCategoryChange(event.target.value)}>
            <option value="all">{t('journal.category.all')}</option>
            {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
          </select>
        </label>
      </div>

      <div className="journal-tag-row" aria-label={t('journal.filters.tag')}>
        <button type="button" data-active={selectedTag === 'all'} onClick={() => onTagChange('all')}>
          {t('journal.tag.all')}
        </button>
        {tagOptions.map((tag) => (
          <button
            key={tag.value}
            type="button"
            data-active={selectedTag === tag.value}
            onClick={() => onTagChange(tag.value)}
          >
            {tag.label}<span>{tag.count}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
