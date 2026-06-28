import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { goalsApi, type GoalDto } from '@/features/goals/api/goals.api';
import { HOME_GOAL_SELECTION_EVENT, readHomeGoalSelection } from '@/features/goals/lib/homeGoalSelection';
import { useNavigationStore } from '@/features/navigation/model/navigation.store';
import { formatMoney } from '@/shared/lib/money';
import { useI18n } from '@/shared/lib/i18n';

function amount(value: number | null | undefined) {
  return Number(value) || 0;
}

function clampProgress(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function goalProgress(goal: GoalDto) {
  return clampProgress(goal.progress ?? (amount(goal.currentAmount) / Math.max(amount(goal.targetAmount), 1)) * 100);
}

function goalLeft(goal: GoalDto) {
  return Math.max(amount(goal.targetAmount) - amount(goal.currentAmount), 0);
}

function pickGoal(goals: GoalDto[], selectedGoalId: string | null) {
  const activeGoals = goals.filter((goal) => goal.status !== 'archived');
  if (activeGoals.length === 0) return null;

  const selected = selectedGoalId ? activeGoals.find((goal) => goal.id === selectedGoalId) : null;
  if (selected) return selected;

  return [...activeGoals].sort((a, b) => {
    const progressDelta = goalProgress(b) - goalProgress(a);
    if (progressDelta !== 0) return progressDelta;
    return goalLeft(a) - goalLeft(b);
  })[0] ?? null;
}

export function HomeGoalProgressWidget() {
  const { t } = useI18n();
  const navigateTo = useNavigationStore((state) => state.navigateTo);
  const [goals, setGoals] = useState<GoalDto[]>([]);
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(() => readHomeGoalSelection());

  useEffect(() => {
    let alive = true;

    goalsApi.list()
      .then((nextGoals) => {
        if (alive) setGoals(nextGoals);
      })
      .catch((error) => {
        console.error(error);
      });

    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const handleSelection = () => setSelectedGoalId(readHomeGoalSelection());
    window.addEventListener(HOME_GOAL_SELECTION_EVENT, handleSelection);
    window.addEventListener('storage', handleSelection);
    return () => {
      window.removeEventListener(HOME_GOAL_SELECTION_EVENT, handleSelection);
      window.removeEventListener('storage', handleSelection);
    };
  }, []);

  const goal = useMemo(() => pickGoal(goals, selectedGoalId), [goals, selectedGoalId]);
  if (!goal) return null;

  const progress = goalProgress(goal);
  const left = goalLeft(goal);

  return (
    <button
      type="button"
      className="app-home-goal-widget app-card"
      onClick={() => navigateTo('goals')}
      aria-label={t('dashboard.goals.open')}
    >
      <span className="app-home-goal-widget__eyebrow">{t('dashboard.goals.home')}</span>
      <span className="app-home-goal-widget__ring" style={{ '--value': `${progress}%` } as CSSProperties}>
        <strong>{progress}%</strong>
      </span>
      <span className="app-home-goal-widget__title">{goal.title}</span>
      <span className="app-home-goal-widget__caption">
        {left > 0
          ? t('dashboard.goals.left', { amount: formatMoney(left, goal.currency) })
          : t('dashboard.goals.done')}
      </span>
    </button>
  );
}
