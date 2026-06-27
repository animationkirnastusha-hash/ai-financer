import { useEffect, useMemo, useState } from 'react';
import { goalsApi, type GoalDto } from '@/features/goals/api/goals.api';
import { fetchSpendingLimits, type SpendingLimitDto } from '@/features/spending-limits/api/spendingLimits.api';
import { useAppModalStore } from '@/features/modals/model/appModal.store';
import { useNavigationStore } from '@/features/navigation/model/navigation.store';
import { ScreenTopBar } from '@/shared/ui/ScreenTopBar';
import { EmptyState } from '@/shared/ui/EmptyState';
import { formatMoney } from '@/shared/lib/money';
import { useI18n } from '@/shared/lib/i18n';

type PlannerTab = 'goals' | 'limits';

function clampProgress(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function limitTarget(limit: SpendingLimitDto, t: (key: string) => string) {
  if (limit.targetType === 'total') return t('goalsLimits.limit.total');
  if (limit.account?.name) return limit.account.name;
  if (limit.category?.name) return limit.category.name;
  return limit.targetType === 'account' ? t('goalsLimits.limit.account') : t('goalsLimits.limit.category');
}

function periodLabel(period: SpendingLimitDto['period'], t: (key: string) => string) {
  if (period === 'daily') return t('goalsLimits.period.day');
  if (period === 'weekly') return t('goalsLimits.period.week');
  return t('goalsLimits.period.month');
}

export default function GoalsLimitsPage() {
  const { t } = useI18n();
  const currentScreen = useNavigationStore((state) => state.currentScreen);
  const openAIWithCommand = useNavigationStore((state) => state.openAIWithCommand);
  const openModal = useAppModalStore((state) => state.openModal);
  const [tab, setTab] = useState<PlannerTab>(currentScreen === 'spending-limits' ? 'limits' : 'goals');
  const [goals, setGoals] = useState<GoalDto[]>([]);
  const [limits, setLimits] = useState<SpendingLimitDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [nextGoals, nextLimits] = await Promise.all([goalsApi.list(), fetchSpendingLimits()]);
      setGoals(nextGoals);
      setLimits(nextLimits);
    } catch (loadError) {
      console.error(loadError);
      setError(loadError instanceof Error ? loadError.message : t('goalsLimits.error.load'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const activeGoals = useMemo(() => goals.filter((goal) => goal.status !== 'archived'), [goals]);
  const activeLimits = useMemo(() => limits.filter((limit) => limit.isActive !== false), [limits]);
  const goalTotals = useMemo(() => activeGoals.reduce((acc, goal) => {
    acc.current += Number(goal.currentAmount) || 0;
    acc.target += Number(goal.targetAmount) || 0;
    return acc;
  }, { current: 0, target: 0 }), [activeGoals]);
  const limitTotals = useMemo(() => activeLimits.reduce((acc, limit) => {
    acc.amount += Number(limit.amount) || 0;
    acc.spent += Number(limit.usage?.spent) || 0;
    return acc;
  }, { amount: 0, spent: 0 }), [activeLimits]);
  const goalProgress = clampProgress((goalTotals.current / Math.max(goalTotals.target, 1)) * 100);
  const limitUsage = clampProgress((limitTotals.spent / Math.max(limitTotals.amount, 1)) * 100);

  const activeItems = tab === 'goals' ? activeGoals.length : activeLimits.length;
  const emptyTitle = tab === 'goals' ? t('goalsLimits.empty.goals.title') : t('goalsLimits.empty.limits.title');
  const emptyCaption = tab === 'goals' ? t('goalsLimits.empty.goals.caption') : t('goalsLimits.empty.limits.caption');
  const emptyCommand = tab === 'goals' ? 'Создай цель и отдельный счет для отпуска на 120000 рублей' : 'Создай лимит расходов на месяц';

  return (
    <div className="app-page app-goals-limits-page text-white">
      <div className="app-page__inner app-goals-limits-shell">
        <ScreenTopBar title={t('screen.goalsLimits')} left="back" right={['notifications', 'home']} />

        <header className="app-card app-goals-limits-hero">
          <div className="app-eyebrow">{t('goalsLimits.hero.eyebrow')}</div>
          <div className="app-goals-limits-hero__main">
            <div>
              <h1 className="app-hero-title">{t('goalsLimits.hero.title')}</h1>
              <p className="app-hero-caption">{t('goalsLimits.hero.caption')}</p>
            </div>
            <button
              type="button"
              className="app-goals-limits-add"
              onClick={() => openAIWithCommand(tab === 'goals' ? 'Создай цель и отдельный счет для цели' : 'Создай лимит расходов')}
              aria-label={t('goalsLimits.action.add')}
            >
              +
            </button>
          </div>
          <div className="app-goals-limits-tabs" role="tablist" aria-label={t('screen.goalsLimits')}>
            <button type="button" data-active={tab === 'goals'} onClick={() => setTab('goals')}>{t('goalsLimits.tab.goals')}</button>
            <button type="button" data-active={tab === 'limits'} onClick={() => setTab('limits')}>{t('goalsLimits.tab.limits')}</button>
          </div>
        </header>

        <section className="app-goals-limits-kpi" aria-label={t('goalsLimits.summary.title')}>
          <article className="app-card">
            <span>{t('goalsLimits.kpi.goals')}</span>
            <strong>{activeGoals.length}</strong>
            <small>{goalProgress}%</small>
          </article>
          <article className="app-card">
            <span>{t('goalsLimits.kpi.saved')}</span>
            <strong>{formatMoney(goalTotals.current, 'RUB')}</strong>
            <small>{formatMoney(Math.max(goalTotals.target - goalTotals.current, 0), 'RUB')}</small>
          </article>
          <article className="app-card">
            <span>{t('goalsLimits.kpi.limits')}</span>
            <strong>{activeLimits.length}</strong>
            <small>{limitUsage}%</small>
          </article>
        </section>

        {error ? <div className="app-error-box">{error}</div> : null}

        {isLoading ? (
          <div className="app-card app-goals-limits-loading">{t('common.loading')}</div>
        ) : activeItems === 0 ? (
          <EmptyState
            eyebrow={tab === 'goals' ? t('goalsLimits.tab.goals') : t('goalsLimits.tab.limits')}
            title={emptyTitle}
            description={emptyCaption}
            actionLabel={t('goalsLimits.action.addWithFina')}
            onAction={() => openAIWithCommand(emptyCommand)}
          />
        ) : tab === 'goals' ? (
          <div className="app-goals-limits-list">
            {activeGoals.map((goal) => {
              const progress = clampProgress(goal.progress ?? (goal.currentAmount / Math.max(goal.targetAmount, 1)) * 100);
              const left = Math.max((Number(goal.targetAmount) || 0) - (Number(goal.currentAmount) || 0), 0);
              return (
                <article key={goal.id} className="app-card app-goals-limits-row">
                  <button type="button" onClick={() => openModal({ type: 'goal-edit', goal, onAfterSave: load })}>
                    <span>{goal.title}</span>
                    <strong>{formatMoney(goal.targetAmount, goal.currency)}</strong>
                  </button>
                  <div className="app-goals-limits-progress"><span style={{ width: `${progress}%` }} /></div>
                  <div className="app-goals-limits-meta">
                    <span>{t('goalsLimits.goal.saved', { amount: formatMoney(goal.currentAmount, goal.currency) })}</span>
                    <span>{t('goalsLimits.goal.left', { amount: formatMoney(left, goal.currency) })}</span>
                  </div>
                  <div className="app-goals-limits-account">{goal.account?.name ?? t('goalsLimits.goal.noAccount')}</div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="app-goals-limits-list">
            {activeLimits.map((limit) => {
              const usage = clampProgress(limit.usage?.percent ?? ((Number(limit.usage?.spent) || 0) / Math.max(Number(limit.amount) || 1, 1)) * 100);
              return (
                <article key={limit.id} className="app-card app-goals-limits-row">
                  <div className="app-goals-limits-row__head">
                    <span>{limitTarget(limit, t)}</span>
                    <strong>{formatMoney(limit.amount, 'RUB')}</strong>
                  </div>
                  <div className="app-goals-limits-progress"><span style={{ width: `${usage}%` }} /></div>
                  <div className="app-goals-limits-meta">
                    <span>{t('goalsLimits.limit.spent', { amount: formatMoney(limit.usage?.spent ?? 0, 'RUB') })}</span>
                    <span>{periodLabel(limit.period, t)}</span>
                  </div>
                  <div className="app-goals-limits-account">{t('goalsLimits.limit.notify', { percent: limit.notifyAt })}</div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
