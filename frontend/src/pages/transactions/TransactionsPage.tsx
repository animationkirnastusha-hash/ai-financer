import { useEffect, useMemo, useState } from 'react';
import { useAccountsStore } from '@/features/accounts/model/accounts.store';
import { FinaCommandBar } from '@/features/fina/ui/FinaCommandBar';
import { useAppModalStore } from '@/features/modals/model/appModal.store';
import { useSectionsStore } from '@/features/sections/model/sections.store';
import { useTransactionsStore } from '@/features/transactions/model/transactions.store';
import type { TransactionDto } from '@/features/transactions/api/transactions.api';
import { useI18n } from '@/shared/lib/i18n';
import { formatMoney } from '@/shared/lib/money';
import { EmptyState } from '@/shared/ui/EmptyState';
import { ScreenTopBar } from '@/shared/ui/ScreenTopBar';

type TransactionPeriod = 'today' | 'week' | 'month' | 'all';
type TransactionTypeFilter = 'all' | TransactionDto['type'];

function startOfDay(date: Date) {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
}

function isInsidePeriod(dateValue: string, period: TransactionPeriod) {
  if (period === 'all') return true;
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return true;

  const now = new Date();
  const today = startOfDay(now);

  if (period === 'today') return date >= today;

  if (period === 'week') {
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - 6);
    return date >= weekStart;
  }

  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
}

function transactionTitle(item: TransactionDto, fallback: string) {
  return item.title?.trim() || item.description?.trim() || item.category?.name || fallback;
}

function transactionIcon(item: TransactionDto) {
  if (item.type === 'income') return '↑';
  if (item.type === 'transfer') return '⇄';
  return item.category?.icon || item.section?.icon || '•';
}

function transactionAmountPrefix(item: TransactionDto) {
  if (item.type === 'income') return '+';
  if (item.type === 'expense') return '-';
  return '';
}

function normalize(value: string) {
  return value.trim().toLowerCase();
}

export default function TransactionsPage() {
  const { t } = useI18n();
  const openModal = useAppModalStore((state) => state.openModal);
  const transactions = useTransactionsStore((state) => state.items);
  const isLoading = useTransactionsStore((state) => state.isLoading);
  const error = useTransactionsStore((state) => state.error);
  const loadTransactions = useTransactionsStore((state) => state.loadTransactions);
  const accounts = useAccountsStore((state) => state.items);
  const loadAccounts = useAccountsStore((state) => state.loadAccounts);
  const categories = useSectionsStore((state) => state.categories);
  const loadTaxonomy = useSectionsStore((state) => state.loadAll);

  const [period, setPeriod] = useState<TransactionPeriod>('month');
  const [type, setType] = useState<TransactionTypeFilter>('all');
  const [accountId, setAccountId] = useState('all');
  const [categoryId, setCategoryId] = useState('all');
  const [query, setQuery] = useState('');

  useEffect(() => {
    void Promise.allSettled([loadTransactions(true), loadAccounts(), loadTaxonomy()]);
  }, [loadAccounts, loadTaxonomy, loadTransactions]);

  const filtered = useMemo(() => {
    const q = normalize(query);
    return transactions.filter((item) => {
      if (!isInsidePeriod(item.date, period)) return false;
      if (type !== 'all' && item.type !== type) return false;
      if (accountId !== 'all' && item.accountId !== accountId && item.toAccountId !== accountId) return false;
      if (categoryId !== 'all' && item.categoryId !== categoryId) return false;

      if (!q) return true;
      const haystack = [
        item.title,
        item.description,
        item.account?.name,
        item.toAccount?.name,
        item.category?.name,
        item.category?.section?.name,
        item.section?.name,
      ].filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(q);
    });
  }, [accountId, categoryId, period, query, transactions, type]);

  const totals = useMemo(() => filtered.reduce((acc, item) => {
    if (item.type === 'income') acc.income += Number(item.amount) || 0;
    if (item.type === 'expense') acc.expenses += Number(item.amount) || 0;
    return acc;
  }, { income: 0, expenses: 0 }), [filtered]);

  const mainCurrency = accounts[0]?.currency || 'RUB';

  return (
    <div className="app-page transactions-workbench-page text-white">
      <div className="app-page__inner transactions-workbench">
        <ScreenTopBar title={t('screen.transactions')} left="menu" right={['notifications', 'analytics', 'settings']} />

        <header className="app-card app-card--hero transactions-workbench-hero">
          <div>
            <div className="app-eyebrow">{t('transactions.page.eyebrow')}</div>
            <h1>{t('transactions.page.title')}</h1>
            <p>{t('transactions.page.caption')}</p>
          </div>
          <button type="button" className="app-primary-button" onClick={() => openModal({ type: 'transaction-create' })}>
            {t('transactions.page.add')}
          </button>
        </header>

        <FinaCommandBar
          titleKey="transactions.command.title"
          captionKey="transactions.command.caption"
          placeholderKey="transactions.command.placeholder"
          suggestions={[
            { key: 'transactions.command.today', command: 'сколько я потратил сегодня' },
            { key: 'transactions.command.cafe', command: 'покажи траты за неделю на кафе' },
            { key: 'transactions.command.find', command: 'найди все траты на бензин' },
          ]}
        />

        <section className="app-card transactions-filter-card" data-no-swipe="true">
          <label className="transactions-search-field">
            <span>{t('transactions.filters.search')}</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('transactions.filters.searchPlaceholder')} />
          </label>

          <div className="transactions-filter-grid">
            <label>
              <span>{t('transactions.filters.period')}</span>
              <select value={period} onChange={(event) => setPeriod(event.target.value as TransactionPeriod)}>
                <option value="today">{t('transactions.period.today')}</option>
                <option value="week">{t('transactions.period.week')}</option>
                <option value="month">{t('transactions.period.month')}</option>
                <option value="all">{t('transactions.period.all')}</option>
              </select>
            </label>
            <label>
              <span>{t('transactions.filters.type')}</span>
              <select value={type} onChange={(event) => setType(event.target.value as TransactionTypeFilter)}>
                <option value="all">{t('transactions.type.all')}</option>
                <option value="expense">{t('transaction.type.expense')}</option>
                <option value="income">{t('transaction.type.income')}</option>
                <option value="transfer">{t('transaction.type.transfer')}</option>
              </select>
            </label>
            <label>
              <span>{t('transactions.filters.account')}</span>
              <select value={accountId} onChange={(event) => setAccountId(event.target.value)}>
                <option value="all">{t('transactions.account.all')}</option>
                {accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
              </select>
            </label>
            <label>
              <span>{t('transactions.filters.category')}</span>
              <select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
                <option value="all">{t('transactions.category.all')}</option>
                {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
              </select>
            </label>
          </div>
        </section>

        <section className="transactions-summary-grid">
          <article className="app-card"><span>{t('transactions.summary.count')}</span><strong>{filtered.length}</strong></article>
          <article className="app-card"><span>{t('transactions.summary.expenses')}</span><strong>{formatMoney(totals.expenses, mainCurrency)}</strong></article>
          <article className="app-card"><span>{t('transactions.summary.income')}</span><strong>{formatMoney(totals.income, mainCurrency)}</strong></article>
        </section>

        {error && transactions.length === 0 ? <div className="app-card app-card--danger">{error}</div> : null}

        {isLoading && transactions.length === 0 ? (
          <div className="app-card transactions-loading-card">{t('transactions.loading')}</div>
        ) : filtered.length === 0 ? (
          <EmptyState
            eyebrow={t('screen.transactions')}
            title={t('transactions.empty.title')}
            description={t('transactions.empty.caption')}
            actionLabel={t('transactions.page.add')}
            onAction={() => openModal({ type: 'transaction-create' })}
          />
        ) : (
          <section className="transactions-list-card app-card">
            {filtered.map((item) => {
              const currency = item.account?.currency || mainCurrency;
              return (
                <button key={item.id} type="button" className="transactions-list-row" onClick={() => openModal({ type: 'transaction-edit', transaction: item })}>
                  <span className="transactions-list-row__avatar">{transactionIcon(item)}</span>
                  <span className="transactions-list-row__main">
                    <b>{transactionTitle(item, t('transactions.item.fallback'))}</b>
                    <small>{item.category?.name || item.section?.name || t('transactions.item.noCategory')} · {item.account?.name || t('transactions.item.noAccount')}</small>
                  </span>
                  <span className="transactions-list-row__meta">
                    <b data-type={item.type}>{transactionAmountPrefix(item)}{formatMoney(Number(item.amount) || 0, currency)}</b>
                    <small>{new Date(item.date).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' })}</small>
                  </span>
                </button>
              );
            })}
          </section>
        )}
      </div>
    </div>
  );
}
