import { useEffect, useMemo, useState } from 'react';
import { FinaCommandBar } from '@/features/fina/ui/FinaCommandBar';
import { useAccountsStore } from '@/features/accounts/model/accounts.store';
import { useAppModalStore } from '@/features/modals/model/appModal.store';
import { useNavigationStore } from '@/features/navigation/model/navigation.store';
import { useSectionsStore } from '@/features/sections/model/sections.store';
import { useTransactionsStore } from '@/features/transactions/model/transactions.store';
import { useI18n } from '@/shared/lib/i18n';
import { EmptyState } from '@/shared/ui/EmptyState';
import { ScreenTopBar } from '@/shared/ui/ScreenTopBar';
import {
  buildDuplicateTransactionPayload,
  buildJournalTagOptions,
  isInsideJournalPeriod,
  journalTransactionSearchText,
  journalTransactionTags,
  normalizeJournalText,
  toDateInput,
} from '@/pages/journal/lib/journalHelpers';
import type { JournalPeriod, JournalTypeFilter } from '@/pages/journal/lib/journalTypes';
import { JournalFilterPanel } from '@/pages/journal/ui/JournalFilterPanel';
import { JournalSummaryGrid } from '@/pages/journal/ui/JournalSummaryGrid';
import { JournalTransactionList } from '@/pages/journal/ui/JournalTransactionList';

export default function JournalPage() {
  const { t } = useI18n();
  const openModal = useAppModalStore((state) => state.openModal);
  const transactions = useTransactionsStore((state) => state.items);
  const isLoading = useTransactionsStore((state) => state.isLoading);
  const isMutating = useTransactionsStore((state) => state.isMutating);
  const error = useTransactionsStore((state) => state.error);
  const loadTransactions = useTransactionsStore((state) => state.loadTransactions);
  const createItem = useTransactionsStore((state) => state.createItem);
  const accounts = useAccountsStore((state) => state.items);
  const loadAccounts = useAccountsStore((state) => state.loadAccounts);
  const categories = useSectionsStore((state) => state.categories);
  const loadTaxonomy = useSectionsStore((state) => state.loadAll);
  const consumeJournalFilters = useNavigationStore((state) => state.consumeJournalFilters);

  const [period, setPeriod] = useState<JournalPeriod>('month');
  const [type, setType] = useState<JournalTypeFilter>('all');
  const [accountId, setAccountId] = useState('all');
  const [categoryId, setCategoryId] = useState('all');
  const [selectedTag, setSelectedTag] = useState('all');
  const [query, setQuery] = useState('');
  const [dateFrom, setDateFrom] = useState(() => {
    const value = new Date();
    value.setDate(value.getDate() - 30);
    return toDateInput(value);
  });
  const [dateTo, setDateTo] = useState(() => toDateInput(new Date()));

  useEffect(() => {
    void Promise.allSettled([loadTransactions(true), loadAccounts(), loadTaxonomy()]);
  }, [loadAccounts, loadTaxonomy, loadTransactions]);

  useEffect(() => {
    const filters = consumeJournalFilters();
    if (!filters) return;
    if (filters.query !== undefined) setQuery(filters.query);
    if (filters.period !== undefined) setPeriod(filters.period);
    if (filters.type !== undefined) setType(filters.type);
    if (filters.accountId !== undefined) setAccountId(filters.accountId || 'all');
    if (filters.categoryId !== undefined) setCategoryId(filters.categoryId || 'all');
    if (filters.tag !== undefined) setSelectedTag(filters.tag || 'all');
  }, [consumeJournalFilters]);

  const tagOptions = useMemo(() => buildJournalTagOptions(transactions), [transactions]);

  const filtered = useMemo(() => {
    const q = normalizeJournalText(query);
    return transactions.filter((item) => {
      if (!isInsideJournalPeriod(item.date, period, dateFrom, dateTo)) return false;
      if (type !== 'all' && item.type !== type) return false;
      if (accountId !== 'all' && item.accountId !== accountId && item.toAccountId !== accountId) return false;
      if (categoryId !== 'all' && item.categoryId !== categoryId) return false;
      if (selectedTag !== 'all' && !journalTransactionTags(item).some((tag) => tag.value === selectedTag)) return false;
      if (!q) return true;
      return journalTransactionSearchText(item).includes(q);
    });
  }, [accountId, categoryId, dateFrom, dateTo, period, query, selectedTag, transactions, type]);

  const totals = useMemo(() => filtered.reduce((acc, item) => {
    if (item.type === 'income') acc.income += Number(item.amount) || 0;
    if (item.type === 'expense') acc.expenses += Number(item.amount) || 0;
    return acc;
  }, { income: 0, expenses: 0 }), [filtered]);

  const mainCurrency = accounts[0]?.currency || 'RUB';

  const resetFilters = () => {
    setPeriod('month');
    setType('all');
    setAccountId('all');
    setCategoryId('all');
    setSelectedTag('all');
    setQuery('');
  };

  const duplicateTransaction = async (item: Parameters<typeof buildDuplicateTransactionPayload>[0]) => {
    if (!item.accountId || Number(item.amount) <= 0) return;
    await createItem(buildDuplicateTransactionPayload(item));
    void loadTransactions(true);
  };

  return (
    <div className="app-page journal-page text-white">
      <div className="app-page__inner journal-layout">
        <ScreenTopBar title={t('screen.journal')} left="menu" right={['notifications', 'analytics', 'settings']} />

        <header className="app-card app-card--hero journal-hero">
          <div>
            <div className="app-eyebrow">{t('journal.hero.eyebrow')}</div>
            <h1>{t('journal.hero.title')}</h1>
            <p>{t('journal.hero.caption')}</p>
          </div>
          <button type="button" className="app-secondary-button" onClick={resetFilters}>{t('journal.filters.reset')}</button>
        </header>

        <FinaCommandBar
          titleKey="journal.command.title"
          captionKey="journal.command.caption"
          placeholderKey="journal.command.placeholder"
          suggestions={[
            { key: 'journal.command.today', command: 'покажи мои траты за сегодня' },
            { key: 'journal.command.cafe', command: 'найди траты на кафе за неделю' },
            { key: 'journal.command.fuel', command: 'покажи все траты на заправке' },
          ]}
        />

        <JournalFilterPanel
          query={query}
          period={period}
          type={type}
          accountId={accountId}
          categoryId={categoryId}
          selectedTag={selectedTag}
          dateFrom={dateFrom}
          dateTo={dateTo}
          accounts={accounts}
          categories={categories}
          tagOptions={tagOptions}
          onQueryChange={setQuery}
          onPeriodChange={setPeriod}
          onTypeChange={setType}
          onAccountChange={setAccountId}
          onCategoryChange={setCategoryId}
          onTagChange={setSelectedTag}
          onDateFromChange={setDateFrom}
          onDateToChange={setDateTo}
        />

        <JournalSummaryGrid count={filtered.length} expenses={totals.expenses} income={totals.income} currency={mainCurrency} />

        {error && transactions.length === 0 ? <div className="app-card app-card--danger">{error}</div> : null}

        {isLoading && transactions.length === 0 ? (
          <div className="app-card journal-loading-card">{t('journal.loading')}</div>
        ) : filtered.length === 0 ? (
          <EmptyState
            eyebrow={t('screen.journal')}
            title={t('journal.empty.title')}
            description={t('journal.empty.caption')}
            actionLabel={t('journal.filters.reset')}
            onAction={resetFilters}
          />
        ) : (
          <JournalTransactionList
            items={filtered}
            currency={mainCurrency}
            isMutating={isMutating}
            onEdit={(item) => openModal({ type: 'transaction-edit', transaction: item })}
            onDuplicate={(item) => void duplicateTransaction(item)}
          />
        )}
      </div>
    </div>
  );
}
