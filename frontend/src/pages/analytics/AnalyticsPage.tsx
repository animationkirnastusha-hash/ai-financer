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
type ChartMode = MoneyMode | 'balance';

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

function addMonths(date: Date, diff: number) {
  return new Date(date.getFullYear(), date.getMonth() + diff, 1);
}

function getCalendarDays(month: Date) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const mondayOffset = (first.getDay() + 6) % 7;
  const start = new Date(first);
  start.setDate(first.getDate() - mondayOffset);

  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return day;
  });
}

function getAppLocale(language: string) {
  return language === 'en' ? 'en-US' : 'ru-RU';
}

function formatCalendarMonth(date: Date, language: string) {
  return new Intl.DateTimeFormat(getAppLocale(language), { month: 'long', year: 'numeric' }).format(date);
}

function getCalendarWeekdays(language: string) {
  const start = new Date(2026, 5, 22);
  const formatter = new Intl.DateTimeFormat(getAppLocale(language), { weekday: 'short' });
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return formatter.format(day).replace('.', '');
  });
}

function normalizeDateRange(start: string, end: string) {
  if (!start || !end) return { start, end };
  return start <= end ? { start, end } : { start: end, end: start };
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

function formatCompactMoney(value: number) {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${value < 0 ? '-' : ''}₽${Math.round(abs / 100_000) / 10}м`;
  if (abs >= 1_000) return `${value < 0 ? '-' : ''}₽${Math.round(abs / 100) / 10}к`;
  return formatMoney(value, 'RUB', { sign: value < 0 ? 'minus' : 'none' });
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

function LineChart({ points, mode }: { points: DailyPoint[]; mode: ChartMode }) {
  const { t } = useI18n();
  const values = points.map((point) => (mode === 'balance' ? point.balance : point[mode]));
  const maxValue = Math.max(0, ...values);
  const minValue = Math.min(0, ...values);
  const range = Math.max(1, maxValue - minValue);
  const width = 320;
  const height = 164;
  const padX = 12;
  const padY = 18;
  const plotWidth = width - padX * 2;
  const plotHeight = height - padY * 2;
  const xStep = points.length > 1 ? plotWidth / (points.length - 1) : 0;
  const zeroY = padY + ((maxValue - 0) / range) * plotHeight;
  const coordinates = points.map((point, index) => {
    const value = mode === 'balance' ? point.balance : point[mode];
    const x = padX + index * xStep;
    const y = padY + ((maxValue - value) / range) * plotHeight;
    return { point, value, x, y };
  });
  const line = coordinates.map((item) => `${item.x},${item.y}`).join(' ');
  const area = coordinates.length > 0
    ? `${padX},${zeroY} ${line} ${padX + xStep * (coordinates.length - 1)},${zeroY}`
    : '';
  const labelIndexes = Array.from(new Set([0, Math.floor((points.length - 1) / 2), points.length - 1])).filter((index) => index >= 0);
  const total = mode === 'balance' ? values[values.length - 1] || 0 : values.reduce((sum, value) => sum + value, 0);
  const peak = values.reduce((max, value) => Math.max(max, Math.abs(value)), 0);

  return (
    <div className={`analytics-v2-line analytics-v2-line--${mode}`}>
      <div className="analytics-v2-line__summary">
        <span>{t('analytics.v2.chart.total')}</span>
        <strong>{formatCompactMoney(total)}</strong>
        <small>{t('analytics.v2.chart.peak')}: {formatCompactMoney(peak)}</small>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" role="img" aria-label={t('analytics.v2.section.dynamic')}>
        <line className="analytics-v2-line__grid" x1={padX} x2={width - padX} y1={padY} y2={padY} />
        <line className="analytics-v2-line__grid" x1={padX} x2={width - padX} y1={height / 2} y2={height / 2} />
        <line className="analytics-v2-line__grid" x1={padX} x2={width - padX} y1={height - padY} y2={height - padY} />
        <line className="analytics-v2-line__zero" x1={padX} x2={width - padX} y1={zeroY} y2={zeroY} />
        {area ? <polygon className="analytics-v2-line__area" points={area} /> : null}
        {line ? <polyline className="analytics-v2-line__path" points={line} /> : null}
        {coordinates.map((item, index) => (
          item.value !== 0 || index === coordinates.length - 1
            ? <circle key={item.point.key} className="analytics-v2-line__dot" cx={item.x} cy={item.y} r="3.2" />
            : null
        ))}
      </svg>
      <div className="analytics-v2-line__labels">
        {labelIndexes.map((index) => <span key={points[index]?.key ?? index}>{points[index]?.label ?? ''}</span>)}
      </div>
    </div>
  );
}

function CalendarRangePicker({
  month,
  start,
  end,
  language,
  onMonthChange,
  onPick,
  onCancel,
  onApply,
}: {
  month: Date;
  start: string;
  end: string;
  language: string;
  onMonthChange: (month: Date) => void;
  onPick: (value: string) => void;
  onCancel: () => void;
  onApply: () => void;
}) {
  const { t } = useI18n();
  const days = getCalendarDays(month);
  const weekdays = getCalendarWeekdays(language);
  const range = normalizeDateRange(start, end);
  const canApply = Boolean(range.start && range.end);
  const hint = !start
    ? t('analytics.v2.calendar.pickStart')
    : !end
      ? t('analytics.v2.calendar.pickEnd')
      : t('analytics.v2.calendar.ready');

  return (
    <div className="analytics-v2-calendar-panel">
      <div className="analytics-v2-calendar-panel__head">
        <button type="button" onClick={() => onMonthChange(addMonths(month, -1))} aria-label={t('analytics.v2.calendar.prev')}>‹</button>
        <strong>{formatCalendarMonth(month, language)}</strong>
        <button type="button" onClick={() => onMonthChange(addMonths(month, 1))} aria-label={t('analytics.v2.calendar.next')}>›</button>
      </div>

      <div className="analytics-v2-calendar-panel__weekdays" aria-hidden="true">
        {weekdays.map((weekday) => <span key={weekday}>{weekday}</span>)}
      </div>

      <div className="analytics-v2-calendar-panel__days">
        {days.map((day) => {
          const value = toDateInputValue(day);
          const isOutside = day.getMonth() !== month.getMonth();
          const isStart = value === range.start;
          const isEnd = value === range.end;
          const isInside = Boolean(range.start && range.end && value > range.start && value < range.end);
          return (
            <button
              key={value}
              type="button"
              className={`${isOutside ? 'is-outside ' : ''}${isStart ? 'is-start ' : ''}${isEnd ? 'is-end ' : ''}${isInside ? 'is-inside ' : ''}`.trim()}
              onClick={() => onPick(value)}
            >
              {day.getDate()}
            </button>
          );
        })}
      </div>

      <div className="analytics-v2-calendar-panel__footer">
        <span>{hint}</span>
        <div>
          <button type="button" className="analytics-v2-calendar-panel__ghost" onClick={onCancel}>{t('common.cancel')}</button>
          <button type="button" className="analytics-v2-calendar-panel__apply" onClick={onApply} disabled={!canApply}>✓</button>
        </div>
      </div>
    </div>
  );
}

function KpiCard({ label, value, change, tone, caption }: { label: string; value: string; change: number; tone: 'income' | 'expense' | 'balance'; caption?: string }) {
  const positive = change >= 0;
  return (
    <article className={`analytics-v2-kpi analytics-v2-kpi--${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <em className={positive ? 'is-positive' : 'is-negative'}>{formatPercent(change)}</em>
      {caption ? <small>{caption}</small> : null}
    </article>
  );
}

function NewsCard({ label, value, caption }: { label: string; value: string; caption: string }) {
  return (
    <article className="analytics-v2-news-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{caption}</small>
    </article>
  );
}

export default function AnalyticsPage() {
  const { t, rt, language } = useI18n();
  const openModal = useAppModalStore((state) => state.openModal);
  const openJournal = useNavigationStore((state) => state.openJournal);
  const transactions = useTransactionsStore((state) => state.items);
  const loadTransactions = useTransactionsStore((state) => state.loadTransactions);
  const [activeTab, setActiveTab] = useState<AnalyticsTab>('overview');
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>('month');
  const [overviewStructureMode, setOverviewStructureMode] = useState<MoneyMode>('expense');
  const [overviewDynamicMode, setOverviewDynamicMode] = useState<MoneyMode>('expense');
  const [customStart, setCustomStart] = useState(() => toDateInputValue(new Date(new Date().getFullYear(), new Date().getMonth(), 1)));
  const [customEnd, setCustomEnd] = useState(() => toDateInputValue(new Date()));
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [draftStart, setDraftStart] = useState(customStart);
  const [draftEnd, setDraftEnd] = useState(customEnd);
  const [calendarMonth, setCalendarMonth] = useState(() => fromDateInputValue(customStart, new Date()));

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
    const averageExpense = dailyPoints.length > 0 ? totalExpense / dailyPoints.length : 0;
    const averageIncome = dailyPoints.length > 0 ? totalIncome / dailyPoints.length : 0;
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
      averageExpense,
      averageIncome,
      topExpense,
      topIncome,
    };
  }, [customEnd, customStart, periodPreset, t, transactions]);

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


  const openCalendarRange = () => {
    setPeriodPreset('custom');
    setDraftStart(customStart);
    setDraftEnd(customEnd);
    setCalendarMonth(fromDateInputValue(customStart, new Date()));
    setCalendarOpen(true);
  };

  const handlePresetClick = (preset: PeriodPreset) => {
    if (preset === 'custom') {
      openCalendarRange();
      return;
    }

    setPeriodPreset(preset);
    setCalendarOpen(false);
  };

  const handlePickCalendarDate = (value: string) => {
    if (!draftStart || draftEnd) {
      setDraftStart(value);
      setDraftEnd('');
      return;
    }

    if (value < draftStart) {
      setDraftEnd(draftStart);
      setDraftStart(value);
      return;
    }

    setDraftEnd(value);
  };

  const applyCalendarRange = () => {
    const range = normalizeDateRange(draftStart, draftEnd);
    if (!range.start || !range.end) return;
    setCustomStart(range.start);
    setCustomEnd(range.end);
    setPeriodPreset('custom');
    setCalendarOpen(false);
  };

  const cancelCalendarRange = () => {
    setDraftStart(customStart);
    setDraftEnd(customEnd);
    setCalendarOpen(false);
  };

  const finaInsight = useMemo(() => {
    if (analytics.current.length === 0) return t('analytics.v2.fina.empty');

    if (activeTab === 'expense') {
      if (analytics.topExpense) return t('analytics.v2.fina.expenseFocus', { category: rt(analytics.topExpense.name), amount: formatMoney(analytics.topExpense.amount, 'RUB') });
      return t('analytics.v2.fina.expenseCalm');
    }

    if (activeTab === 'income') {
      if (analytics.topIncome) return t('analytics.v2.fina.incomeFocus', { category: rt(analytics.topIncome.name), amount: formatMoney(analytics.topIncome.amount, 'RUB') });
      return t('analytics.v2.fina.incomeCalm');
    }

    if (activeTab === 'balance') {
      if (analytics.balance < 0) return t('analytics.v2.fina.negative', { amount: formatMoney(Math.abs(analytics.balance), 'RUB') });
      return t('analytics.v2.fina.balanceFocus', { percent: Math.round(analytics.profitRatio) });
    }

    if (analytics.balance < 0) return t('analytics.v2.fina.negative', { amount: formatMoney(Math.abs(analytics.balance), 'RUB') });
    if (analytics.expenseRatio > 80) return t('analytics.v2.fina.warning', { percent: Math.round(analytics.expenseRatio) });
    if (analytics.topExpense) return t('analytics.v2.fina.topExpense', { category: rt(analytics.topExpense.name), amount: formatMoney(analytics.topExpense.amount, 'RUB') });
    return t('analytics.v2.fina.positive');
  }, [activeTab, analytics.balance, analytics.current.length, analytics.expenseRatio, analytics.profitRatio, analytics.topExpense, analytics.topIncome, rt, t]);

  const openGroupJournal = (group: MoneyGroup, type: 'income' | 'expense') => {
    openJournal({ period: periodPreset === 'day' ? 'today' : periodPreset === 'week' ? 'week' : periodPreset === 'month' ? 'month' : 'custom', type, query: group.name, tag: normalizeJournalTag(group.name) });
  };

  const structureMode = activeTab === 'income' ? 'income' : activeTab === 'expense' ? 'expense' : overviewStructureMode;
  const dynamicMode = activeTab === 'income' ? 'income' : activeTab === 'expense' ? 'expense' : overviewDynamicMode;
  const structureGroups = structureMode === 'expense' ? analytics.expenseGroups : analytics.incomeGroups;
  const structureTotal = structureMode === 'expense' ? analytics.totalExpense : analytics.totalIncome;
  const structureTitle = structureMode === 'expense' ? t('analytics.v2.chart.expense') : t('analytics.v2.chart.income');
  const dynamicTitle = dynamicMode === 'expense' ? t('analytics.v2.dynamic.expense') : t('analytics.v2.dynamic.income');

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
                onClick={() => handlePresetClick(preset.value)}
              >
                {preset.label}
              </button>
            ))}
          </div>
          {periodPreset === 'custom' ? (
            <div className="analytics-v2-period__range">
              <span>{t('analytics.v2.calendar.range')}</span>
              <button type="button" onClick={openCalendarRange}>{formatPeriodLabel(analytics.range)}</button>
            </div>
          ) : null}

          {calendarOpen ? (
            <CalendarRangePicker
              month={calendarMonth}
              start={draftStart}
              end={draftEnd}
              language={language}
              onMonthChange={setCalendarMonth}
              onPick={handlePickCalendarDate}
              onCancel={cancelCalendarRange}
              onApply={applyCalendarRange}
            />
          ) : null}
        </section>

        {activeTab === 'overview' ? (
          <>
            <section className="analytics-v2-kpi-grid analytics-v2-kpi-grid--overview" aria-label={t('analytics.v2.kpi.label')}>
              <KpiCard label={t('analytics.kpi.expense')} value={formatMoney(analytics.totalExpense, 'RUB', { sign: 'minus' })} change={analytics.expenseChange} tone="expense" />
              <KpiCard label={t('analytics.kpi.income')} value={formatMoney(analytics.totalIncome, 'RUB', { sign: 'plus' })} change={analytics.incomeChange} tone="income" />
              <KpiCard label={t('analytics.v2.kpi.balance')} value={formatMoney(analytics.balance, 'RUB', { sign: 'auto' })} change={analytics.balanceChange} tone="balance" />
            </section>

            <section className="app-card analytics-v2-news">
              <div className="analytics-v2-section-head">
                <div>
                  <span>{t('analytics.v2.overview.eyebrow')}</span>
                  <h2>{t('analytics.v2.overview.title')}</h2>
                </div>
                <button type="button" className="analytics-v2-light-button" onClick={() => openJournal({ period: periodPreset === 'day' ? 'today' : periodPreset === 'week' ? 'week' : periodPreset === 'month' ? 'month' : 'custom' })}>{t('analytics.journal.action')}</button>
              </div>
              <div className="analytics-v2-news-grid">
                <NewsCard label={t('analytics.v2.news.balance')} value={formatMoney(analytics.balance, 'RUB', { sign: 'auto' })} caption={t('analytics.v2.news.balanceCaption')} />
                <NewsCard label={t('analytics.v2.news.topExpense')} value={analytics.topExpense ? rt(analytics.topExpense.name) : '—'} caption={analytics.topExpense ? formatMoney(analytics.topExpense.amount, 'RUB') : t('analytics.v2.empty.groups')} />
                <NewsCard label={t('analytics.v2.news.activity')} value={String(analytics.current.length)} caption={t('analytics.v2.balance.operations')} />
              </div>
            </section>
          </>
        ) : null}

        {activeTab === 'expense' ? (
          <section className="analytics-v2-focus-grid" aria-label={t('analytics.v2.tab.expense')}>
            <KpiCard label={t('analytics.kpi.expense')} value={formatMoney(analytics.totalExpense, 'RUB', { sign: 'minus' })} change={analytics.expenseChange} tone="expense" caption={t('analytics.v2.expense.totalCaption')} />
            <KpiCard label={t('analytics.v2.expense.average')} value={formatMoney(analytics.averageExpense, 'RUB')} change={0} tone="expense" caption={t('analytics.v2.expense.averageCaption')} />
          </section>
        ) : null}

        {activeTab === 'income' ? (
          <section className="analytics-v2-focus-grid" aria-label={t('analytics.v2.tab.income')}>
            <KpiCard label={t('analytics.kpi.income')} value={formatMoney(analytics.totalIncome, 'RUB', { sign: 'plus' })} change={analytics.incomeChange} tone="income" caption={t('analytics.v2.income.totalCaption')} />
            <KpiCard label={t('analytics.v2.income.average')} value={formatMoney(analytics.averageIncome, 'RUB')} change={0} tone="income" caption={t('analytics.v2.income.averageCaption')} />
          </section>
        ) : null}

        {activeTab === 'balance' ? (
          <section className="analytics-v2-focus-grid analytics-v2-focus-grid--balance" aria-label={t('analytics.v2.tab.balance')}>
            <KpiCard label={t('analytics.v2.kpi.balance')} value={formatMoney(analytics.balance, 'RUB', { sign: 'auto' })} change={analytics.balanceChange} tone="balance" caption={t('analytics.v2.balance.netCaption')} />
            <KpiCard label={t('analytics.v2.balance.expenseRatio')} value={`${Math.round(analytics.expenseRatio)}%`} change={0} tone="balance" caption={t('analytics.v2.balance.expenseRatioCaption')} />
            <KpiCard label={t('analytics.v2.balance.profitRatio')} value={`${Math.round(analytics.profitRatio)}%`} change={0} tone="balance" caption={t('analytics.v2.balance.profitRatioCaption')} />
          </section>
        ) : null}

        {(activeTab === 'overview' || activeTab === 'expense' || activeTab === 'income') ? (
          <section className="app-card analytics-v2-chart-card">
            <div className="analytics-v2-section-head">
              <div>
                <span>{t('analytics.v2.section.structure')}</span>
                <h2>{structureTitle}</h2>
              </div>
              {activeTab === 'overview' ? (
                <div className="analytics-v2-switch">
                  <button type="button" className={overviewStructureMode === 'expense' ? 'is-active' : ''} onClick={() => setOverviewStructureMode('expense')}>{t('analytics.kpi.expense')}</button>
                  <button type="button" className={overviewStructureMode === 'income' ? 'is-active' : ''} onClick={() => setOverviewStructureMode('income')}>{t('analytics.kpi.income')}</button>
                </div>
              ) : null}
            </div>

            <div className="analytics-v2-chart-layout">
              <DonutChart groups={structureGroups} total={structureTotal} label={structureTitle} />
              <CategoryList groups={structureGroups} total={structureTotal} onOpen={(group) => openGroupJournal(group, structureMode)} />
            </div>
          </section>
        ) : null}

        <section className="analytics-v2-fina app-card">
          <div className="analytics-v2-fina__avatar" aria-hidden="true"><span /><span /></div>
          <div>
            <b>{t('analytics.fina.title')}</b>
            <p>{finaInsight}</p>
          </div>
        </section>

        {(activeTab === 'overview' || activeTab === 'expense' || activeTab === 'income') ? (
          <section className="app-card analytics-v2-trend-card">
            <div className="analytics-v2-section-head">
              <div>
                <span>{t('analytics.v2.section.dynamic')}</span>
                <h2>{dynamicTitle}</h2>
              </div>
              {activeTab === 'overview' ? (
                <div className="analytics-v2-switch">
                  <button type="button" className={overviewDynamicMode === 'expense' ? 'is-active' : ''} onClick={() => setOverviewDynamicMode('expense')}>{t('analytics.kpi.expense')}</button>
                  <button type="button" className={overviewDynamicMode === 'income' ? 'is-active' : ''} onClick={() => setOverviewDynamicMode('income')}>{t('analytics.kpi.income')}</button>
                </div>
              ) : null}
            </div>
            <LineChart points={analytics.dailyPoints} mode={dynamicMode} />
          </section>
        ) : null}

        {activeTab === 'balance' ? (
          <section className="app-card analytics-v2-balance-card">
            <div className="analytics-v2-section-head">
              <div>
                <span>{t('analytics.v2.section.balance')}</span>
                <h2>{t('analytics.v2.balance.title')}</h2>
              </div>
              <button type="button" className="analytics-v2-light-button" onClick={() => openJournal({ period: periodPreset === 'day' ? 'today' : periodPreset === 'week' ? 'week' : periodPreset === 'month' ? 'month' : 'custom' })}>{t('analytics.journal.action')}</button>
            </div>
            <LineChart points={analytics.dailyPoints} mode="balance" />
            <div className="analytics-v2-ratio-grid">
              <article>
                <span>{t('analytics.v2.balance.income')}</span>
                <strong>{formatMoney(analytics.totalIncome, 'RUB')}</strong>
              </article>
              <article>
                <span>{t('analytics.v2.balance.expense')}</span>
                <strong>{formatMoney(analytics.totalExpense, 'RUB')}</strong>
              </article>
              <article>
                <span>{t('analytics.v2.balance.operations')}</span>
                <strong>{analytics.current.length}</strong>
              </article>
            </div>
          </section>
        ) : null}

        {(activeTab === 'expense' || activeTab === 'income') ? (
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
        ) : null}

        <section className="analytics-v2-actions">
          <button type="button" onClick={() => openModal({ type: 'ai-text-overlay', initialCommand: t('analytics.ask.topExpense'), autoSubmitInitialCommand: true })}>{t('analytics.v2.action.ask')}</button>
          <button type="button" onClick={() => openModal({ type: 'report-export', mode: 'base' })}>{t('analytics.report.action')}</button>
        </section>
      </div>
    </div>
  );
}
