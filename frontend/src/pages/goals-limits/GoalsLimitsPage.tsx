import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { goalsApi, type GoalDto } from '@/features/goals/api/goals.api';
import { fetchSpendingLimits, type SpendingLimitDto } from '@/features/spending-limits/api/spendingLimits.api';
import { useNavigationStore } from '@/features/navigation/model/navigation.store';
import { ScreenTopBar } from '@/shared/ui/ScreenTopBar';
import { EmptyState } from '@/shared/ui/EmptyState';
import { formatMoney } from '@/shared/lib/money';
import { useI18n } from '@/shared/lib/i18n';

type PlannerTab = 'goals' | 'limits';

type FinaFlow = 'goal-create' | 'goal-edit' | 'limit-create' | 'limit-edit';

function clampProgress(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function amount(value: number | null | undefined) {
  return Number(value) || 0;
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

function buildFinaCommand(flow: FinaFlow, t: (key: string, params?: Record<string, string | number>) => string, item?: GoalDto | SpendingLimitDto) {
  if (flow === 'goal-create') return t('goalsLimits.command.goalCreate');

  if (flow === 'goal-edit') {
    const goal = item as GoalDto | undefined;
    return t('goalsLimits.command.goalEdit', { title: goal?.title ?? '' });
  }

  if (flow === 'limit-create') return t('goalsLimits.command.limitCreate');

  const limit = item as SpendingLimitDto | undefined;
  return t('goalsLimits.command.limitEdit', { amount: limit ? amount(limit.amount) : '' });
}


export default function GoalsLimitsPage() {
  const { t } = useI18n();
  const currentScreen = useNavigationStore((state) => state.currentScreen);
  const openAIWithPrompt = useNavigationStore((state) => state.openAIWithPrompt);
  const [tab, setTab] = useState<PlannerTab>(currentScreen === 'spending-limits' ? 'limits' : 'goals');
  const [goals, setGoals] = useState<GoalDto[]>([]);
  const [limits, setLimits] = useState<SpendingLimitDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const openFina = (flow: FinaFlow, item?: GoalDto | SpendingLimitDto) => {
    openAIWithPrompt(buildFinaCommand(flow, t, item));
  };

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
    acc.current += amount(goal.currentAmount);
    acc.target += amount(goal.targetAmount);
    if (goal.accountId || goal.account?.id) acc.accounts += 1;
    return acc;
  }, { current: 0, target: 0, accounts: 0 }), [activeGoals]);

  const limitTotals = useMemo(() => activeLimits.reduce((acc, limit) => {
    acc.amount += amount(limit.amount);
    acc.spent += amount(limit.usage?.spent);
    acc.remaining += Math.max(amount(limit.usage?.remaining), 0);
    return acc;
  }, { amount: 0, spent: 0, remaining: 0 }), [activeLimits]);

  const goalProgress = clampProgress((goalTotals.current / Math.max(goalTotals.target, 1)) * 100);
  const limitUsage = clampProgress((limitTotals.spent / Math.max(limitTotals.amount, 1)) * 100);
  const nearestGoal = useMemo(() => {
    return [...activeGoals].sort((a, b) => {
      const aLeft = Math.max(amount(a.targetAmount) - amount(a.currentAmount), 0);
      const bLeft = Math.max(amount(b.targetAmount) - amount(b.currentAmount), 0);
      return aLeft - bLeft;
    })[0] ?? null;
  }, [activeGoals]);
  const hottestLimit = useMemo(() => {
    return [...activeLimits].sort((a, b) => amount(b.usage?.percent) - amount(a.usage?.percent))[0] ?? null;
  }, [activeLimits]);

  const isGoalsTab = tab === 'goals';
  const activeItems = isGoalsTab ? activeGoals.length : activeLimits.length;
  const emptyTitle = isGoalsTab ? t('goalsLimits.empty.goals.title') : t('goalsLimits.empty.limits.title');
  const emptyCaption = isGoalsTab ? t('goalsLimits.empty.goals.caption') : t('goalsLimits.empty.limits.caption');

  return (
    <div className="app-page app-goals-limits-page text-white">
      <div className="app-page__inner app-goals-limits-shell">
        <ScreenTopBar title={t('screen.goalsLimits')} left="back" right={['notifications', 'home']} />

        <header className="app-card app-goals-limits-hero">
          <div className="app-goals-limits-hero__topline">
            <span className="app-eyebrow">{t('goalsLimits.hero.eyebrow')}</span>
            <span className="app-goals-limits-ai-pill">{t('goalsLimits.hero.aiOnly')}</span>
          </div>
          <div className="app-goals-limits-hero__main">
            <div>
              <h1 className="app-hero-title">{t('goalsLimits.hero.title')}</h1>
              <p className="app-hero-caption">{t('goalsLimits.hero.caption')}</p>
            </div>
            <button
              type="button"
              className="app-goals-limits-add"
              onClick={() => openFina(isGoalsTab ? 'goal-create' : 'limit-create')}
              aria-label={t('goalsLimits.action.add')}
            >
              +
            </button>
          </div>
          <div className="app-goals-limits-tabs" role="tablist" aria-label={t('screen.goalsLimits')}>
            <button type="button" data-active={isGoalsTab} onClick={() => setTab('goals')}>{t('goalsLimits.tab.goals')}</button>
            <button type="button" data-active={!isGoalsTab} onClick={() => setTab('limits')}>{t('goalsLimits.tab.limits')}</button>
          </div>
        </header>

        <section className="app-goals-limits-kpi" aria-label={t('goalsLimits.summary.title')}>
          <article className="app-card">
            <span>{isGoalsTab ? t('goalsLimits.kpi.goals') : t('goalsLimits.kpi.limits')}</span>
            <strong>{activeItems}</strong>
            <small>{isGoalsTab ? t('goalsLimits.kpi.activeGoals') : t('goalsLimits.kpi.activeLimits')}</small>
          </article>
          <article className="app-card">
            <span>{isGoalsTab ? t('goalsLimits.kpi.saved') : t('goalsLimits.kpi.spent')}</span>
            <strong>{formatMoney(isGoalsTab ? goalTotals.current : limitTotals.spent, 'RUB')}</strong>
            <small>{isGoalsTab ? `${goalProgress}%` : `${limitUsage}%`}</small>
          </article>
          <article className="app-card">
            <span>{isGoalsTab ? t('goalsLimits.kpi.left') : t('goalsLimits.kpi.available')}</span>
            <strong>{formatMoney(isGoalsTab ? Math.max(goalTotals.target - goalTotals.current, 0) : Math.max(limitTotals.amount - limitTotals.spent, 0), 'RUB')}</strong>
            <small>{isGoalsTab ? t('goalsLimits.kpi.goalAccounts', { count: goalTotals.accounts }) : t('goalsLimits.kpi.limitBudget')}</small>
          </article>
        </section>

        <section className="app-card app-goals-limits-focus">
          <div className="app-goals-limits-focus__copy">
            <span className="app-eyebrow">{t('goalsLimits.focus.eyebrow')}</span>
            <h2>{isGoalsTab ? t('goalsLimits.focus.goals.title') : t('goalsLimits.focus.limits.title')}</h2>
            <p>{isGoalsTab ? t('goalsLimits.focus.goals.caption') : t('goalsLimits.focus.limits.caption')}</p>
          </div>
          <div className="app-goals-limits-ring" style={{ '--value': `${isGoalsTab ? goalProgress : limitUsage}%` } as CSSProperties}>
            <strong>{isGoalsTab ? goalProgress : limitUsage}%</strong>
            <span>{isGoalsTab ? t('goalsLimits.focus.progress') : t('goalsLimits.focus.usage')}</span>
          </div>
        </section>

        {error ? <div className="app-error-box">{error}</div> : null}

        {isLoading ? (
          <div className="app-card app-goals-limits-loading">{t('common.loading')}</div>
        ) : activeItems === 0 ? (
          <EmptyState
            eyebrow={isGoalsTab ? t('goalsLimits.tab.goals') : t('goalsLimits.tab.limits')}
            title={emptyTitle}
            description={emptyCaption}
            actionLabel={t('goalsLimits.action.add')}
            onAction={() => openFina(isGoalsTab ? 'goal-create' : 'limit-create')}
          />
        ) : isGoalsTab ? (
          <section className="app-goals-limits-list" aria-label={t('goalsLimits.list.goals')}>
            <div className="app-goals-limits-section-head">
              <div>
                <span className="app-eyebrow">{t('goalsLimits.list.eyebrow')}</span>
                <h2>{t('goalsLimits.list.goals')}</h2>
              </div>
              {nearestGoal ? <small>{t('goalsLimits.goal.nearest', { title: nearestGoal.title })}</small> : null}
            </div>
            {activeGoals.map((goal) => {
              const progress = clampProgress(goal.progress ?? (amount(goal.currentAmount) / Math.max(amount(goal.targetAmount), 1)) * 100);
              const left = Math.max(amount(goal.targetAmount) - amount(goal.currentAmount), 0);
              return (
                <article key={goal.id} className="app-card app-goals-limits-row">
                  <div className="app-goals-limits-row__head">
                    <span>{goal.title}</span>
                    <strong>{formatMoney(goal.targetAmount, goal.currency)}</strong>
                  </div>
                  <div className="app-goals-limits-progress" aria-label={`${progress}%`}><span style={{ width: `${progress}%` }} /></div>
                  <div className="app-goals-limits-meta">
                    <span>{t('goalsLimits.goal.saved', { amount: formatMoney(goal.currentAmount, goal.currency) })}</span>
                    <span>{t('goalsLimits.goal.left', { amount: formatMoney(left, goal.currency) })}</span>
                  </div>
                  <div className="app-goals-limits-row__bottom">
                    <span>{goal.account?.name ?? t('goalsLimits.goal.noAccount')}</span>
                    <button type="button" onClick={() => openFina('goal-edit', goal)}>{t('goalsLimits.action.editWithFina')}</button>
                  </div>
                </article>
              );
            })}
          </section>
        ) : (
          <section className="app-goals-limits-list" aria-label={t('goalsLimits.list.limits')}>
            <div className="app-goals-limits-section-head">
              <div>
                <span className="app-eyebrow">{t('goalsLimits.list.eyebrow')}</span>
                <h2>{t('goalsLimits.list.limits')}</h2>
              </div>
              {hottestLimit ? <small>{t('goalsLimits.limit.hottest', { target: limitTarget(hottestLimit, t) })}</small> : null}
            </div>
            {activeLimits.map((limit) => {
              const usage = clampProgress(limit.usage?.percent ?? (amount(limit.usage?.spent) / Math.max(amount(limit.amount), 1)) * 100);
              const remaining = Math.max(amount(limit.amount) - amount(limit.usage?.spent), 0);
              return (
                <article key={limit.id} className="app-card app-goals-limits-row">
                  <div className="app-goals-limits-row__head">
                    <span>{limitTarget(limit, t)}</span>
                    <strong>{formatMoney(limit.amount, 'RUB')}</strong>
                  </div>
                  <div className="app-goals-limits-progress" aria-label={`${usage}%`}><span style={{ width: `${usage}%` }} /></div>
                  <div className="app-goals-limits-meta">
                    <span>{t('goalsLimits.limit.spent', { amount: formatMoney(limit.usage?.spent ?? 0, 'RUB') })}</span>
                    <span>{t('goalsLimits.limit.left', { amount: formatMoney(remaining, 'RUB') })}</span>
                  </div>
                  <div className="app-goals-limits-row__bottom">
                    <span>{periodLabel(limit.period, t)} · {t('goalsLimits.limit.notify', { percent: limit.notifyAt })}</span>
                    <button type="button" onClick={() => openFina('limit-edit', limit)}>{t('goalsLimits.action.editWithFina')}</button>
                  </div>
                </article>
              );
            })}
          </section>
        )}
      </div>
    </div>
  );
}
