import { useEffect, useMemo } from 'react';
import { useAppModalStore } from '@/features/modals/model/appModal.store';
import { useNavigationStore } from '@/features/navigation/model/navigation.store';
import { useTransactionsStore } from '@/features/transactions/model/transactions.store';
import { useSubscriptionStore } from '@/features/subscription/model/subscription.store';
import { hasRealPremiumAccess, hasRealBusinessAccess } from '@/features/subscription/lib/entitlements';
import { formatMoney } from '@/shared/lib/money';
import { useI18n } from '@/shared/lib/i18n';
import { ScreenTopBar } from '@/shared/ui/ScreenTopBar';

function isCurrentMonth(value: string) {
  const date = new Date(value);
  const now = new Date();
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
}

function RingChart({ value, label }: { value: number; label: string }) {
  const radius = 42;
  const stroke = 11;
  const normalized = Math.min(Math.max(value, 0), 100);
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (normalized / 100) * circumference;

  return (
    <svg className="analytics-ring" viewBox="0 0 110 110" aria-label={label} role="img">
      <circle cx="55" cy="55" r={radius} strokeWidth={stroke} />
      <circle cx="55" cy="55" r={radius} strokeWidth={stroke} strokeDasharray={circumference} strokeDashoffset={offset} />
      <text x="55" y="60" textAnchor="middle">{Math.round(normalized)}%</text>
    </svg>
  );
}

function BarRow({ name, value, total }: { name: string; value: number; total: number }) {
  return (
    <div className="analytics-bar-row">
      <div><span>{name}</span><strong>{formatMoney(value, 'RUB')}</strong></div>
      <i><b style={{ width: `${Math.max(8, Math.min(100, total ? (value / total) * 100 : 0))}%` }} /></i>
    </div>
  );
}

export default function AnalyticsPage() {
  const { t } = useI18n();
  const openModal = useAppModalStore((state) => state.openModal);
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
    const top = Object.entries(
      expenses.reduce<Record<string, number>>((acc, item) => {
        const key = item.category?.name || t('analytics.uncategorized');
        acc[key] = (acc[key] || 0) + Number(item.amount || 0);
        return acc;
      }, {}),
    ).sort((a, b) => b[1] - a[1]).slice(0, 6);
    const incomeTop = Object.entries(
      income.reduce<Record<string, number>>((acc, item) => {
        const key = item.category?.name || t('analytics.uncategorized');
        acc[key] = (acc[key] || 0) + Number(item.amount || 0);
        return acc;
      }, {}),
    ).sort((a, b) => b[1] - a[1]).slice(0, 4);
    const operationsCount = monthTransactions.length;
    const balance = totalIncome - totalExpenses;
    const expenseShare = totalIncome > 0 ? (totalExpenses / totalIncome) * 100 : totalExpenses > 0 ? 100 : 0;
    const mainCategory = top[0]?.[0] ?? t('analytics.empty.noCategory');
    return { totalExpenses, totalIncome, top, incomeTop, operationsCount, balance, expenseShare, mainCategory };
  }, [t, transactions]);

  const mainInsight = data.operationsCount === 0
    ? t('analytics.insight.empty')
    : data.balance >= 0
      ? t('analytics.insight.positive')
      : t('analytics.insight.negative');

  return (
    <div className="app-page app-analytics-page text-white">
      <div className="app-page__inner space-y-4">
        <ScreenTopBar title={t('common.analytics')} right={['notifications', 'settings']} />

        <header className="app-card app-card--hero analytics-hero-card analytics-hero-card--final">
          <div className="analytics-hero-card__grid">
            <div>
              <div className="app-eyebrow">{t('analytics.hero.eyebrow')}</div>
              <h1 className="app-hero-title">{t('analytics.hero.title')}</h1>
              <p className="app-hero-caption">{t('analytics.hero.caption')}</p>
              <div className="analytics-period-chipline" aria-label={t('analytics.period.label')}>
                <span className="is-active">{t('analytics.period.month')}</span>
                <span>{t('analytics.period.week')}</span>
                <span>{t('analytics.period.day')}</span>
              </div>
            </div>
            <RingChart value={data.expenseShare} label={t('analytics.ring.label')} />
          </div>
          <div className="analytics-kpi-grid">
            <article><span>{t('analytics.kpi.income')}</span><strong>{formatMoney(data.totalIncome, 'RUB', { sign: 'plus' })}</strong></article>
            <article><span>{t('analytics.kpi.expense')}</span><strong>{formatMoney(data.totalExpenses, 'RUB', { sign: 'minus' })}</strong></article>
            <article><span>{t('analytics.kpi.result')}</span><strong>{formatMoney(data.balance, 'RUB', { sign: 'auto' })}</strong></article>
          </div>
        </header>

        <section className="analytics-fina-card app-card analytics-fina-card--floating">
          <div className="analytics-fina-card__avatar" aria-hidden="true"><span /><span /></div>
          <div>
            <b>{t('analytics.fina.title')}</b>
            <span>{mainInsight}</span>
          </div>
        </section>

        <section className="analytics-grid-two">
          <article className="app-card analytics-mini-card">
            <span className="analytics-mini-card__label">{t('analytics.mini.operations')}</span>
            <strong className="analytics-mini-card__value">{data.operationsCount}</strong>
            <small className="analytics-mini-card__caption">{t('analytics.mini.operationsCaption')}</small>
          </article>
          <article className="app-card analytics-mini-card">
            <span className="analytics-mini-card__label">{t('analytics.mini.mainCategory')}</span>
            <strong className="analytics-mini-card__value">{data.mainCategory}</strong>
            <small className="analytics-mini-card__caption">{t('analytics.mini.mainCategoryCaption')}</small>
          </article>
        </section>

        <section className="app-card analytics-section-card analytics-section-card--primary">
          <div className="analytics-section-card__head">
            <div className="analytics-section-card__title">
              <div className="app-eyebrow">{t('analytics.expenses.eyebrow')}</div>
              <h2>{t('analytics.expenses.title')}</h2>
            </div>
            <button type="button" className="app-secondary-button app-secondary-button--compact" onClick={() => openModal({ type: 'report-export', mode: 'base' })}>{t('analytics.report.action')}</button>
          </div>
          <div className="analytics-bars">
            {data.top.length === 0 ? <div className="analytics-empty-line">{t('analytics.empty.expenses')}</div> : data.top.map(([name, value]) => (
              <BarRow key={name} name={name} value={value} total={data.totalExpenses} />
            ))}
          </div>
        </section>

        <section className="app-card analytics-section-card">
          <div className="analytics-section-card__head">
            <div className="analytics-section-card__title">
              <div className="app-eyebrow">{t('analytics.income.eyebrow')}</div>
              <h2>{t('analytics.income.title')}</h2>
            </div>
          </div>
          <div className="analytics-income-grid">
            {data.incomeTop.length === 0 ? <div className="analytics-empty-line">{t('analytics.empty.income')}</div> : data.incomeTop.map(([name, value]) => (
              <article key={name}><span>{name}</span><strong>{formatMoney(value, 'RUB')}</strong></article>
            ))}
          </div>
        </section>

        <section className="app-card analytics-section-card analytics-section-card--actions">
          <div className="analytics-section-card__head">
            <div className="analytics-section-card__title">
              <div className="app-eyebrow">{t('analytics.actions.eyebrow')}</div>
              <h2>{t('analytics.actions.title')}</h2>
            </div>
          </div>
          <div className="analytics-action-grid">
            <button type="button" onClick={() => openModal({ type: 'ai-text-overlay', initialCommand: t('analytics.ask.topExpense'), autoSubmitInitialCommand: true })}>{t('analytics.ask.topExpense')}</button>
            <button type="button" onClick={() => openModal({ type: 'ai-text-overlay', initialCommand: t('analytics.ask.reduce'), autoSubmitInitialCommand: true })}>{t('analytics.ask.reduce')}</button>
            <button type="button" onClick={() => navigateTo('dashboard')}>{t('analytics.action.home')}</button>
          </div>
        </section>

        {canShowPremiumAnalytics ? (
          <section className="app-card analytics-section-card">
            <div className="analytics-section-card__head">
              <div className="analytics-section-card__title">
                <div className="app-eyebrow">{t('analytics.premium.eyebrow')}</div>
                <h2>{t('analytics.premium.title')}</h2>
              </div>
            </div>
            <p>{t('analytics.premium.caption')}</p>
            <div className="analytics-action-grid analytics-action-grid--two">
              <button type="button" onClick={() => openModal({ type: 'report-export', mode: 'premium' })}>{t('analytics.report.premium')}</button>
              <button type="button" onClick={() => navigateTo('store')}>{t('analytics.action.store')}</button>
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}
