import { useEffect, useMemo, useState } from 'react';
import { useAppModalStore } from '@/features/modals/model/appModal.store';
import { useNavigationStore } from '@/features/navigation/model/navigation.store';
import type { TransactionDto } from '@/features/transactions/api/transactions.api';
import { useTransactionsStore } from '@/features/transactions/model/transactions.store';
import { useI18n } from '@/shared/lib/i18n';
import { formatMoney } from '@/shared/lib/money';
import { ScreenTopBar } from '@/shared/ui/ScreenTopBar';

type AnalyticsTab = 'overview' | 'expense' | 'income' | 'balance';
type PeriodPreset = 'day' | 'week' | 'month' | 'custom';
type MoneyMode = 'expense' | 'income';

type PeriodRange = {
  start: Date;
  end: Date;
};

type MoneyGroup = {
  key: string;
  name: string;
  amount: number;
  count: number;
  color: string;
  icon?: string | null;
};

type DailyPoint = {
  key: string;
  label: string;
  income: number;
  expense: number;
  balance: number;
};

const CHART_PALETTE = ['#67e8f9', '#6ee7b7', '#c4b5fd', '#fbbf24', '#fb7185', '#93c5fd', '#f9a8d4', '#a7f3d0'];
const MAX_GROUPS = 6;
const DAY_MS = 24 * 60 * 60 * 1000;

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function endOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
}

function toDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function fromDateInputValue(value: string, fallback: Date) {
  if (!value) return fallback;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? fallback : date;
}

function getPeriodRange(preset: PeriodPreset, customStart: string, customEnd: string): PeriodRange {
  const now = new Date();

  if (preset === 'day') {
    return { start: startOfDay(now), end: endOfDay(now) };
  }

  if (preset === 'week') {
    const start = startOfDay(now);
    start.setDate(now.getDate() - 6);
    return { start, end: endOfDay(now) };
  }

  if (preset === 'custom') {
    const fallbackStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const fallbackEnd = now;
    const start = startOfDay(fromDateInputValue(customStart, fallbackStart));
    const end = endOfDay(fromDateInputValue(customEnd, fallbackEnd));

    if (start.getTime() > end.getTime()) {
      return { start: startOfDay(end), end: endOfDay(start) };
    }

    return { start, end };
  }

  return {
    start: startOfDay(new Date(now.getFullYear(), now.getMonth(), 1)),
    end: endOfDay(now),
  };
}

function getPreviousRange(range: PeriodRange): PeriodRange {
  const duration = Math.max(DAY_MS, range.end.getTime() - range.start.getTime());
  return {
    start: startOfDay(new Date(range.start.getTime() - duration - 1)),
    end: endOfDay(new Date(range.start.getTime() - 1)),
  };
}

function isInsideRange(value: string, range: PeriodRange) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  return date.getTime() >= range.start.getTime() && date.getTime() <= range.end.getTime();
}

function getStableColor(seed: string) {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) % 100000;
  }
  return CHART_PALETTE[Math.abs(hash) % CHART_PALETTE.length];
}

function normalizeJournalTag(value: string) {
  return value
    .toLowerCase()
    .replaceAll('ё', 'е')
    .replace(/[^a-zа-я0-9\s-]+/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function formatPeriodLabel(range: PeriodRange) {
  const formatter = new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: 'short' });
  return `${formatter.format(range.start)} — ${formatter.format(range.end)}`;
}

function formatPercent(value: number) {
  if (!Number.isFinite(value)) return '0%';
  const rounded = Math.round(value);
  return `${rounded > 0 ? '+' : ''}${rounded}%`;
}

function calcChange(current: number, previous: number) {
  if (previous === 0 && current === 0) return 0;
  if (previous === 0) return 100;
  return ((current - previous) / Math.abs(previous)) * 100;
}

function sumTransactions(transactions: TransactionDto[], type: 'income' | 'expense') {
  return transactions
    .filter((item) => item.type === type)
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);
}

function groupTransactions(transactions: TransactionDto[], fallbackName: string): MoneyGroup[] {
  const grouped = transactions.reduce<Record<string, MoneyGroup>>((acc, item) => {
    const category = item.category;
    const section = item.section ?? category?.section ?? null;
    const name = category?.name || section?.name || item.title || fallbackName;
    const key = category?.id || section?.id || name;
    const color = category?.color || getStableColor(key);
    const icon = category?.icon || section?.icon || null;

    if (!acc[key]) {
      acc[key] = { key, name, amount: 0, count: 0, color, icon };
    }

    acc[key].amount += Number(item.amount || 0);
    acc[key].count += 1;
    return acc;
  }, {});

  const groups = Object.values(grouped).sort((a, b) => b.amount - a.amount);

  if (groups.length <= MAX_GROUPS) return groups;

  const visible = groups.slice(0, MAX_GROUPS - 1);
  const hidden = groups.slice(MAX_GROUPS - 1);
  return [
    ...visible,
    {
      key: 'other',
      name: fallbackName,
      amount: hidden.reduce((sum, group) => sum + group.amount, 0),
      count: hidden.reduce((sum, group) => sum + group.count, 0),
      color: getStableColor('other'),
      icon: null,
    },
  ];
}

function buildDailyPoints(transactions: TransactionDto[], range: PeriodRange): DailyPoint[] {
  const days = Math.min(31, Math.max(1, Math.ceil((endOfDay(range.end).getTime() - startOfDay(range.start).getTime()) / DAY_MS)));
  const start = startOfDay(range.start);
  const formatter = new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: 'short' });

  const points = Array.from({ length: days }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return {
      key: toDateInputValue(date),
      label: formatter.format(date),
      income: 0,
      expense: 0,
      balance: 0,
    };
  });

  const indexByKey = new Map(points.map((point, index) => [point.key, index]));

  transactions.forEach((item) => {
    const date = new Date(item.date);
    const key = toDateInputValue(date);
    const index = indexByKey.get(key);
    if (index === undefined) return;

    if (item.type === 'income') points[index].income += Number(item.amount || 0);
    if (item.type === 'expense') points[index].expense += Number(item.amount || 0);
  });

  let runningBalance = 0;
  return points.map((point) => {
    runningBalance += point.income - point.expense;
    return { ...point, balance: runningBalance };
  });
}

function DonutChart({ groups, total, label }: { groups: MoneyGroup[]; total: number; label: string }) {
  const radius = 45;
  const stroke = 12;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className="analytics-v2-donut" aria-label={label} role="img">
      <svg viewBox="0 0 120 120" aria-hidden="true">
        <circle className="analytics-v2-donut__track" cx="60" cy="60" r={radius} strokeWidth={stroke} />
        {groups.filter((group) => group.amount > 0).map((group) => {
          const share = total > 0 ? group.amount / total : 0;
          const dash = Math.max(0, share * circumference);
          const segment = (
            <circle
              key={group.key}
              className="analytics-v2-donut__segment"
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
      <div className="analytics-v2-donut__center">
        <strong>{total > 0 ? formatMoney(total, 'RUB') : '—'}</strong>
        <span>{label}</span>
      </div>
    </div>
  );
}

function CategoryList({ groups, total, onOpen }: { groups: MoneyGroup[]; total: number; onOpen: (group: MoneyGroup) => void }) {
  const { rt, t } = useI18n();

  if (groups.length === 0) {
    return <div className="analytics-v2-empty">{t('analytics.v2.empty.groups')}</div>;
  }

  return (
    <div className="analytics-v2-category-list">
      {groups.map((group) => {
        const percent = total > 0 ? Math.round((group.amount / total) * 100) : 0;
        return (
          <button key={group.key} type="button" className="analytics-v2-category-row" onClick={() => onOpen(group)}>
            <span className="analytics-v2-category-row__icon" style={{ backgroundColor: group.color }}>{group.icon || ''}</span>
            <span className="analytics-v2-category-row__text">
              <b>{rt(group.name)}</b>
              <small>{group.count} · {percent}%</small>
            </span>
            <strong>{formatMoney(group.amount, 'RUB')}</strong>
          </button>
        );
      })}
    </div>
  );
}

function DynamicsChart({ points, mode }: { points: DailyPoint[]; mode: MoneyMode | 'balance' }) {
  const maxValue = Math.max(
    1,
    ...points.map((point) => Math.abs(mode === 'balance' ? point.balance : point[mode])),
  );

  return (
    <div className="analytics-v2-dynamics" aria-hidden="true">
      {points.map((point) => {
        const value = mode === 'balance' ? point.balance : point[mode];
        const height = Math.max(8, Math.round((Math.abs(value) / maxValue) * 86));
        const tone = value < 0 ? 'negative' : mode;
        return (
          <div key={point.key} className="analytics-v2-dynamics__item">
            <span className={`analytics-v2-dynamics__bar analytics-v2-dynamics__bar--${tone}`} style={{ height: `${height}%` }} />
            <small>{point.label}</small>
          </div>
        );
      })}
    </div>
  );
}

function KpiCard({ label, value, change, tone }: { label: string; value: string; change: number; tone: 'income' | 'expense' | 'balance' }) {
  const positive = change >= 0;
  return (
    <article className={`analytics-v2-kpi analytics-v2-kpi--${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <em className={positive ? 'is-positive' : 'is-negative'}>{formatPercent(change)}</em>
    </article>
  );
}

export default function AnalyticsPage() {
  const { t, rt } = useI18n();
  const openModal = useAppModalStore((state) => state.openModal);
  const openJournal = useNavigationStore((state) => state.openJournal);
  const transactions = useTransactionsStore((state) => state.items);
  const loadTransactions = useTransactionsStore((state) => state.loadTransactions);
  const [activeTab, setActiveTab] = useState<AnalyticsTab>('overview');
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>('month');
  const [chartMode, setChartMode] = useState<MoneyMode>('expense');
  const [dynamicMode, setDynamicMode] = useState<MoneyMode>('expense');
  const [customStart, setCustomStart] = useState(() => toDateInputValue(new Date(new Date().getFullYear(), new Date().getMonth(), 1)));
  const [customEnd, setCustomEnd] = useState(() => toDateInputValue(new Date()));

  useEffect(() => { void loadTransactions(); }, [loadTransactions]);

  const analytics = useMemo(() => {
    const range = getPeriodRange(periodPreset, customStart, customEnd);
    const previousRange = getPreviousRange(range);
    const current = transactions.filter((item) => isInsideRange(item.date, range));
    const previous = transactions.filter((item) => isInsideRange(item.date, previousRange));
    const expenses = current.filter((item) => item.type === 'expense');
    const income = current.filter((item) => item.type === 'income');
    const totalExpense = sumTransactions(current, 'expense');
    const totalIncome = sumTransactions(current, 'income');
    const previousExpense = sumTransactions(previous, 'expense');
    const previousIncome = sumTransactions(previous, 'income');
    const balance = totalIncome - totalExpense;
    const previousBalance = previousIncome - previousExpense;
    const expenseGroups = groupTransactions(expenses, t('analytics.uncategorized'));
    const incomeGroups = groupTransactions(income, t('analytics.income.default'));
    const dailyPoints = buildDailyPoints(current, range);
    const expenseRatio = totalIncome > 0 ? (totalExpense / totalIncome) * 100 : totalExpense > 0 ? 100 : 0;
    const profitRatio = totalIncome > 0 ? (balance / totalIncome) * 100 : 0;
    const topExpense = expenseGroups[0] ?? null;
    const topIncome = incomeGroups[0] ?? null;

    return {
      range,
      current,
      expenses,
      income,
      totalExpense,
      totalIncome,
      balance,
      expenseChange: calcChange(totalExpense, previousExpense),
      incomeChange: calcChange(totalIncome, previousIncome),
      balanceChange: calcChange(balance, previousBalance),
      expenseGroups,
      incomeGroups,
      dailyPoints,
      expenseRatio,
      profitRatio,
      topExpense,
      topIncome,
    };
  }, [customEnd, customStart, periodPreset, t, transactions]);

  const currentGroups = chartMode === 'expense' ? analytics.expenseGroups : analytics.incomeGroups;
  const currentTotal = chartMode === 'expense' ? analytics.totalExpense : analytics.totalIncome;
  const chartTitle = chartMode === 'expense' ? t('analytics.v2.chart.expense') : t('analytics.v2.chart.income');
  const periodLabel = formatPeriodLabel(analytics.range);

  const finaInsight = useMemo(() => {
    if (analytics.current.length === 0) return t('analytics.v2.fina.empty');
    if (analytics.balance < 0) return t('analytics.v2.fina.negative', { amount: formatMoney(Math.abs(analytics.balance), 'RUB') });
    if (analytics.expenseRatio > 80) return t('analytics.v2.fina.warning', { percent: Math.round(analytics.expenseRatio) });
    if (analytics.topExpense) return t('analytics.v2.fina.topExpense', { category: rt(analytics.topExpense.name), amount: formatMoney(analytics.topExpense.amount, 'RUB') });
    return t('analytics.v2.fina.positive');
  }, [analytics.balance, analytics.current.length, analytics.expenseRatio, analytics.topExpense, rt, t]);

  const openGroupJournal = (group: MoneyGroup, type: 'income' | 'expense') => {
    openJournal({ period: periodPreset === 'day' ? 'today' : periodPreset === 'week' ? 'week' : periodPreset === 'month' ? 'month' : 'custom', type, query: group.name, tag: normalizeJournalTag(group.name) });
  };

  const tabs: Array<{ value: AnalyticsTab; label: string }> = [
    { value: 'overview', label: t('analytics.v2.tab.overview') },
    { value: 'expense', label: t('analytics.v2.tab.expense') },
    { value: 'income', label: t('analytics.v2.tab.income') },
    { value: 'balance', label: t('analytics.v2.tab.balance') },
  ];

  const presets: Array<{ value: PeriodPreset; label: string }> = [
    { value: 'day', label: t('analytics.period.day') },
    { value: 'week', label: t('analytics.period.week') },
    { value: 'month', label: t('analytics.period.month') },
    { value: 'custom', label: t('analytics.v2.period.custom') },
  ];

  return (
    <div className="app-page app-analytics-page analytics-v2-page text-white">
      <div className="app-page__inner analytics-v2-page__inner">
        <ScreenTopBar title={t('common.analytics')} right={['notifications', 'settings']} />

        <section className="analytics-v2-tabs" aria-label={t('analytics.v2.tabs.label')}>
          {tabs.map((tab) => (
            <button
              key={tab.value}
              type="button"
              className={activeTab === tab.value ? 'is-active' : ''}
              onClick={() => setActiveTab(tab.value)}
            >
              {tab.label}
            </button>
          ))}
        </section>

        <section className="analytics-v2-period app-card" aria-label={t('analytics.period.label')}>
          <div className="analytics-v2-period__buttons">
            {presets.map((preset) => (
              <button
                key={preset.value}
                type="button"
                className={periodPreset === preset.value ? 'is-active' : ''}
                onClick={() => setPeriodPreset(preset.value)}
              >
                {preset.label}
              </button>
            ))}
          </div>
          <div className="analytics-v2-period__calendar">
            <label>
              <span>{t('analytics.v2.period.from')}</span>
              <input type="date" value={customStart} onChange={(event) => { setCustomStart(event.target.value); setPeriodPreset('custom'); }} />
            </label>
            <label>
              <span>{t('analytics.v2.period.to')}</span>
              <input type="date" value={customEnd} onChange={(event) => { setCustomEnd(event.target.value); setPeriodPreset('custom'); }} />
            </label>
          </div>
          <p>{periodLabel}</p>
        </section>

        {(activeTab === 'overview' || activeTab === 'expense' || activeTab === 'income' || activeTab === 'balance') && (
          <section className="analytics-v2-kpi-grid" aria-label={t('analytics.v2.kpi.label')}>
            <KpiCard label={t('analytics.kpi.expense')} value={formatMoney(analytics.totalExpense, 'RUB', { sign: 'minus' })} change={analytics.expenseChange} tone="expense" />
            <KpiCard label={t('analytics.kpi.income')} value={formatMoney(analytics.totalIncome, 'RUB', { sign: 'plus' })} change={analytics.incomeChange} tone="income" />
            <KpiCard label={t('analytics.v2.kpi.balance')} value={formatMoney(analytics.balance, 'RUB', { sign: 'auto' })} change={analytics.balanceChange} tone="balance" />
          </section>
        )}

        {(activeTab === 'overview' || activeTab === 'expense' || activeTab === 'income') && (
          <section className="app-card analytics-v2-chart-card">
            <div className="analytics-v2-section-head">
              <div>
                <span>{t('analytics.v2.section.structure')}</span>
                <h2>{chartTitle}</h2>
              </div>
              <div className="analytics-v2-switch">
                <button type="button" className={chartMode === 'expense' ? 'is-active' : ''} onClick={() => setChartMode('expense')}>{t('analytics.kpi.expense')}</button>
                <button type="button" className={chartMode === 'income' ? 'is-active' : ''} onClick={() => setChartMode('income')}>{t('analytics.kpi.income')}</button>
              </div>
            </div>

            <div className="analytics-v2-chart-layout">
              <DonutChart groups={currentGroups} total={currentTotal} label={chartTitle} />
              <CategoryList groups={currentGroups} total={currentTotal} onOpen={(group) => openGroupJournal(group, chartMode)} />
            </div>
          </section>
        )}

        <section className="analytics-v2-fina app-card">
          <div className="analytics-v2-fina__avatar" aria-hidden="true"><span /><span /></div>
          <div>
            <b>{t('analytics.fina.title')}</b>
            <p>{finaInsight}</p>
          </div>
        </section>

        {(activeTab === 'overview' || activeTab === 'expense' || activeTab === 'income') && (
          <section className="app-card analytics-v2-trend-card">
            <div className="analytics-v2-section-head">
              <div>
                <span>{t('analytics.v2.section.dynamic')}</span>
                <h2>{dynamicMode === 'expense' ? t('analytics.v2.dynamic.expense') : t('analytics.v2.dynamic.income')}</h2>
              </div>
              <div className="analytics-v2-switch">
                <button type="button" className={dynamicMode === 'expense' ? 'is-active' : ''} onClick={() => setDynamicMode('expense')}>{t('analytics.kpi.expense')}</button>
                <button type="button" className={dynamicMode === 'income' ? 'is-active' : ''} onClick={() => setDynamicMode('income')}>{t('analytics.kpi.income')}</button>
              </div>
            </div>
            <DynamicsChart points={analytics.dailyPoints} mode={dynamicMode} />
          </section>
        )}

        {(activeTab === 'overview' || activeTab === 'balance') && (
          <section className="app-card analytics-v2-balance-card">
            <div className="analytics-v2-section-head">
              <div>
                <span>{t('analytics.v2.section.balance')}</span>
                <h2>{t('analytics.v2.balance.title')}</h2>
              </div>
              <button type="button" className="analytics-v2-light-button" onClick={() => openJournal({ period: periodPreset === 'day' ? 'today' : periodPreset === 'week' ? 'week' : periodPreset === 'month' ? 'month' : 'custom' })}>{t('analytics.journal.action')}</button>
            </div>
            <DynamicsChart points={analytics.dailyPoints} mode="balance" />
            <div className="analytics-v2-ratio-grid">
              <article>
                <span>{t('analytics.v2.balance.expenseRatio')}</span>
                <strong>{Math.round(analytics.expenseRatio)}%</strong>
              </article>
              <article>
                <span>{t('analytics.v2.balance.profitRatio')}</span>
                <strong>{Math.round(analytics.profitRatio)}%</strong>
              </article>
              <article>
                <span>{t('analytics.v2.balance.operations')}</span>
                <strong>{analytics.current.length}</strong>
              </article>
            </div>
          </section>
        )}

        {(activeTab === 'expense' || activeTab === 'income') && (
          <section className="app-card analytics-v2-detail-card">
            <div className="analytics-v2-section-head">
              <div>
                <span>{activeTab === 'expense' ? t('analytics.expenses.eyebrow') : t('analytics.income.eyebrow')}</span>
                <h2>{activeTab === 'expense' ? t('analytics.v2.detail.expense') : t('analytics.v2.detail.income')}</h2>
              </div>
            </div>
            <CategoryList
              groups={activeTab === 'expense' ? analytics.expenseGroups : analytics.incomeGroups}
              total={activeTab === 'expense' ? analytics.totalExpense : analytics.totalIncome}
              onOpen={(group) => openGroupJournal(group, activeTab)}
            />
          </section>
        )}

        <section className="analytics-v2-actions">
          <button type="button" onClick={() => openModal({ type: 'ai-text-overlay', initialCommand: t('analytics.ask.topExpense'), autoSubmitInitialCommand: true })}>{t('analytics.v2.action.ask')}</button>
          <button type="button" onClick={() => openModal({ type: 'report-export', mode: 'base' })}>{t('analytics.report.action')}</button>
        </section>
      </div>
    </div>
  );
}
