import { useEffect, useMemo, type ReactNode } from 'react';
import { useAppModalStore } from '@/features/modals/model/appModal.store';
import { useNavigationStore } from '@/features/navigation/model/navigation.store';
import { useSubscriptionStore } from '@/features/subscription/model/subscription.store';
import { hasRealBusinessAccess, hasRealPremiumAccess } from '@/features/subscription/lib/entitlements';
import { useTransactionsStore } from '@/features/transactions/model/transactions.store';
import type { TransactionDto } from '@/features/transactions/api/transactions.api';
import { formatMoney } from '@/shared/lib/money';
import { useI18n } from '@/shared/lib/i18n';
import { ScreenTopBar } from '@/shared/ui/ScreenTopBar';

const CHART_PALETTE = ['#67e8f9', '#6ee7b7', '#c4b5fd', '#fbbf24', '#fb7185', '#93c5fd', '#f9a8d4', '#a7f3d0'];
const MAX_GROUPS = 6;

type MoneyGroup = {
  key: string;
  name: string;
  amount: number;
  count: number;
  color: string;
  icon?: string | null;
};

function isCurrentMonth(value: string) {
  const date = new Date(value);
  const now = new Date();
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
}

function normalizeJournalTag(value: string) {
  return value
    .toLowerCase()
    .replaceAll('ё', 'е')
    .replace(/[^a-zа-я0-9\s-]+/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function groupTransactions(
  transactions: TransactionDto[],
  fallbackName: string,
  mode: 'category' | 'section',
): MoneyGroup[] {
  const grouped = transactions.reduce<Record<string, MoneyGroup>>((acc, item) => {
    const category = item.category;
    const section = item.section ?? category?.section ?? null;
    const name = mode === 'section'
      ? section?.name || category?.name || fallbackName
      : category?.name || section?.name || fallbackName;
    const color = (mode === 'section' ? section?.color || category?.color : category?.color || section?.color) || '';
    const icon = (mode === 'section' ? section?.icon || category?.icon : category?.icon || section?.icon) || null;
    const key = `${mode}:${name}`;

    if (!acc[key]) {
      acc[key] = {
        key,
        name,
        amount: 0,
        count: 0,
        color,
        icon,
      };
    }

    acc[key].amount += Number(item.amount || 0);
    acc[key].count += 1;
    if (!acc[key].color && color) acc[key].color = color;
    if (!acc[key].icon && icon) acc[key].icon = icon;

    return acc;
  }, {});

  return Object.values(grouped)
    .sort((a, b) => b.amount - a.amount)
    .map((group, index) => ({
      ...group,
      color: group.color || CHART_PALETTE[index % CHART_PALETTE.length],
    }));
}

function compactGroups(groups: MoneyGroup[], fallbackName: string): MoneyGroup[] {
  if (groups.length <= MAX_GROUPS) return groups;

  const visible = groups.slice(0, MAX_GROUPS - 1);
  const rest = groups.slice(MAX_GROUPS - 1);
  const otherAmount = rest.reduce((sum, group) => sum + group.amount, 0);
  const otherCount = rest.reduce((sum, group) => sum + group.count, 0);

  return [
    ...visible,
    {
      key: 'other',
      name: fallbackName,
      amount: otherAmount,
      count: otherCount,
      color: CHART_PALETTE[(MAX_GROUPS - 1) % CHART_PALETTE.length],
    },
  ];
}

function DonutChart({ groups, total, label, emptyLabel }: { groups: MoneyGroup[]; total: number; label: string; emptyLabel: string }) {
  const radius = 45;
  const stroke = 12;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className="analytics-donut-wrap" aria-label={label} role="img">
      <svg className="analytics-donut" viewBox="0 0 120 120" aria-hidden="true">
        <circle className="analytics-donut__track" cx="60" cy="60" r={radius} strokeWidth={stroke} />
        {groups.filter((group) => group.amount > 0).map((group) => {
          const share = total > 0 ? group.amount / total : 0;
          const dash = Math.max(0, share * circumference);
          const segment = (
            <circle
              key={group.key}
              className="analytics-donut__segment"
              cx="60"
              cy="60"
              r={radius}
              stroke={group.color}
              strokeWidth={stroke}
              strokeDasharray={`${dash} ${circumference - dash}`}
              strokeDashoffset={-offset}
            />
          );
          offset += dash;
          return segment;
        })}
      </svg>
      <div className="analytics-donut-center">
        <strong>{total > 0 ? formatMoney(total, 'RUB') : emptyLabel}</strong>
        <span>{label}</span>
      </div>
    </div>
  );
}

function AnalyticsLegend({
  groups,
  total,
  onOpen,
}: {
  groups: MoneyGroup[];
  total: number;
  onOpen: (group: MoneyGroup) => void;
}) {
  const { rt } = useI18n();

  if (groups.length === 0) return null;

  return (
    <div className="analytics-legend-list">
      {groups.map((group) => {
        const percent = total > 0 ? Math.round((group.amount / total) * 100) : 0;
        return (
          <button key={group.key} type="button" className="analytics-legend-item" onClick={() => onOpen(group)}>
            <i aria-hidden="true" style={{ background: group.color }}>{group.icon || ''}</i>
            <span>
              <b>{rt(group.name)}</b>
              <small>{percent}% · {formatMoney(group.amount, 'RUB')} · {group.count}</small>
            </span>
          </button>
        );
      })}
    </div>
  );
}

function AnalyticsFoldout({
  title,
  eyebrow,
  children,
  defaultOpen = false,
}: {
  title: string;
  eyebrow: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details className="app-card analytics-foldout" open={defaultOpen}>
      <summary>
        <span>
          <small>{eyebrow}</small>
          <b>{title}</b>
        </span>
        <i aria-hidden="true" />
      </summary>
      <div className="analytics-foldout__body">{children}</div>
    </details>
  );
}

function MoneyBarRow({ group, total, onOpen }: { group: MoneyGroup; total: number; onOpen: () => void }) {
  const { rt } = useI18n();
  const percent = total > 0 ? Math.max(6, Math.min(100, (group.amount / total) * 100)) : 0;

  return (
    <button type="button" className="analytics-bar-row" onClick={onOpen}>
      <div>
        <span><i aria-hidden="true" style={{ background: group.color }}>{group.icon || ''}</i>{rt(group.name)}</span>
        <strong>{formatMoney(group.amount, 'RUB')}</strong>
      </div>
      <em><b style={{ width: `${percent}%`, background: group.color }} /></em>
    </button>
  );
}

export default function AnalyticsPage() {
  const { t, rt } = useI18n();
  const openModal = useAppModalStore((state) => state.openModal);
  const openJournal = useNavigationStore((state) => state.openJournal);
  const navigateTo = useNavigationStore((state) => state.navigateTo);
  const subscription = useSubscriptionStore((state) => state.status);
  const canShowPremiumAnalytics = hasRealPremiumAccess(subscription) || hasRealBusinessAccess(subscription);
  const transactions = useTransactionsStore((state) => state.items);
  const loadTransactions = useTransactionsStore((state) => state.loadTransactions);

  useEffect(() => { void loadTransactions(); }, [loadTransactions]);

  const data = useMemo(() => {
    const monthTransactions = transactions.filter((item) => isCurrentMonth(item.date));
    const expenses = monthTransactions.filter((item) => item.type === 'expense');
    const income = monthTransactions.filter((item) => item.type === 'income');
    const totalExpenses = expenses.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const totalIncome = income.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const balance = totalIncome - totalExpenses;
    const operationsCount = monthTransactions.length;
    const expenseShare = totalIncome > 0 ? Math.min(999, (totalExpenses / totalIncome) * 100) : totalExpenses > 0 ? 100 : 0;
    const sectionGroups = compactGroups(groupTransactions(expenses, t('analytics.uncategorized'), 'section'), t('analytics.group.other'));
    const categoryGroups = compactGroups(groupTransactions(expenses, t('analytics.uncategorized'), 'category'), t('analytics.group.other'));
    const incomeGroups = compactGroups(groupTransactions(income, t('analytics.income.default'), 'category'), t('analytics.group.other'));
    const mainCategory = categoryGroups[0]?.name ?? t('analytics.empty.noCategory');

    return {
      monthTransactions,
      expenses,
      income,
      totalExpenses,
      totalIncome,
      balance,
      operationsCount,
      expenseShare,
      sectionGroups,
      categoryGroups,
      incomeGroups,
      mainCategory,
    };
  }, [t, transactions]);

  const mainInsight = data.operationsCount === 0
    ? t('analytics.insight.empty')
    : data.balance >= 0
      ? t('analytics.insight.positive')
      : t('analytics.insight.negative');

  const openMonthJournal = () => openJournal({ period: 'month' });
  const openGroupJournal = (group: MoneyGroup, type: 'income' | 'expense') => {
    openJournal({ period: 'month', type, query: group.name, tag: normalizeJournalTag(group.name) });
  };

  return (
    <div className="app-page app-analytics-page text-white">
      <div className="app-page__inner">
        <ScreenTopBar title={t('common.analytics')} right={['notifications', 'analytics', 'settings']} />

        <header className="app-card app-card--hero analytics-hero-card">
          <div className="analytics-hero-main">
            <div>
              <div className="app-eyebrow">{t('analytics.hero.eyebrow')}</div>
              <h1 className="app-hero-title">{t('analytics.hero.title')}</h1>
              <p className="app-hero-caption">{t('analytics.hero.caption')}</p>
            </div>
            <div className="analytics-period-pill" aria-label={t('analytics.period.label')}>{t('analytics.period.month')}</div>
          </div>

          <div className="analytics-kpi-grid">
            <article><span>{t('analytics.kpi.income')}</span><strong>{formatMoney(data.totalIncome, 'RUB', { sign: 'plus' })}</strong></article>
            <article><span>{t('analytics.kpi.expense')}</span><strong>{formatMoney(data.totalExpenses, 'RUB', { sign: 'minus' })}</strong></article>
            <article><span>{t('analytics.kpi.result')}</span><strong>{formatMoney(data.balance, 'RUB', { sign: 'auto' })}</strong></article>
          </div>
        </header>

        <section className="analytics-fina-card app-card">
          <div className="analytics-fina-card__avatar" aria-hidden="true"><span /><span /></div>
          <div>
            <b>{t('analytics.fina.title')}</b>
            <span>{mainInsight}</span>
          </div>
        </section>

        <section className="app-card analytics-chart-card">
          <div className="analytics-section-card__head">
            <div className="analytics-section-card__title">
              <div className="app-eyebrow">{t('analytics.overview.eyebrow')}</div>
              <h2>{t('analytics.overview.title')}</h2>
            </div>
            <button type="button" className="app-secondary-button app-secondary-button--compact" onClick={openMonthJournal}>{t('analytics.journal.action')}</button>
          </div>

          <div className="analytics-chart-layout">
            <DonutChart
              groups={data.sectionGroups}
              total={data.totalExpenses}
              label={t('analytics.chart.expenses')}
              emptyLabel={t('analytics.empty.noCategory')}
            />
            <AnalyticsLegend groups={data.sectionGroups} total={data.totalExpenses} onOpen={(group) => openGroupJournal(group, 'expense')} />
          </div>
        </section>

        <section className="analytics-grid-two">
          <button type="button" className="app-card analytics-mini-card analytics-mini-card--button" onClick={openMonthJournal}>
            <span className="analytics-mini-card__label">{t('analytics.mini.operations')}</span>
            <strong className="analytics-mini-card__value">{data.operationsCount}</strong>
            <small className="analytics-mini-card__caption">{t('analytics.mini.operationsCaption')}</small>
          </button>
          <button type="button" className="app-card analytics-mini-card analytics-mini-card--button" onClick={() => openGroupJournal(data.categoryGroups[0] ?? { key: 'empty', name: data.mainCategory, amount: 0, count: 0, color: CHART_PALETTE[0] }, 'expense')}>
            <span className="analytics-mini-card__label">{t('analytics.mini.mainCategory')}</span>
            <strong className="analytics-mini-card__value">{rt(data.mainCategory)}</strong>
            <small className="analytics-mini-card__caption">{t('analytics.mini.mainCategoryCaption')}</small>
          </button>
        </section>

        <AnalyticsFoldout title={t('analytics.expenses.title')} eyebrow={t('analytics.expenses.eyebrow')} defaultOpen>
          <div className="analytics-bars">
            {data.categoryGroups.length === 0 ? <div className="analytics-empty-line">{t('analytics.empty.expenses')}</div> : data.categoryGroups.map((group) => (
              <MoneyBarRow key={group.key} group={group} total={data.totalExpenses} onOpen={() => openGroupJournal(group, 'expense')} />
            ))}
          </div>
        </AnalyticsFoldout>

        <AnalyticsFoldout title={t('analytics.income.title')} eyebrow={t('analytics.income.eyebrow')}>
          <div className="analytics-income-grid">
            {data.incomeGroups.length === 0 ? <div className="analytics-empty-line">{t('analytics.empty.income')}</div> : data.incomeGroups.map((group) => (
              <button key={group.key} type="button" onClick={() => openGroupJournal(group, 'income')}>
                <span><i aria-hidden="true" style={{ background: group.color }}>{group.icon || ''}</i>{rt(group.name)}</span>
                <strong>{formatMoney(group.amount, 'RUB')}</strong>
              </button>
            ))}
          </div>
        </AnalyticsFoldout>

        <AnalyticsFoldout title={t('analytics.actions.title')} eyebrow={t('analytics.actions.eyebrow')}>
          <div className="analytics-action-grid">
            <button type="button" onClick={() => openModal({ type: 'ai-text-overlay', initialCommand: t('analytics.ask.topExpense'), autoSubmitInitialCommand: true })}>{t('analytics.ask.topExpense')}</button>
            <button type="button" onClick={() => openModal({ type: 'ai-text-overlay', initialCommand: t('analytics.ask.reduce'), autoSubmitInitialCommand: true })}>{t('analytics.ask.reduce')}</button>
            <button type="button" onClick={() => openModal({ type: 'report-export', mode: 'base' })}>{t('analytics.report.action')}</button>
          </div>
        </AnalyticsFoldout>

        {canShowPremiumAnalytics ? (
          <AnalyticsFoldout title={t('analytics.premium.title')} eyebrow={t('analytics.premium.eyebrow')}>
            <p className="analytics-premium-caption">{t('analytics.premium.caption')}</p>
            <div className="analytics-action-grid analytics-action-grid--two">
              <button type="button" onClick={() => openModal({ type: 'report-export', mode: 'premium' })}>{t('analytics.report.premium')}</button>
              <button type="button" onClick={() => navigateTo('store')}>{t('analytics.action.store')}</button>
            </div>
          </AnalyticsFoldout>
        ) : null}
      </div>
    </div>
  );
}
