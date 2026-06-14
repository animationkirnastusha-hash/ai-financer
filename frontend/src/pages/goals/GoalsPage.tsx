import { useEffect, useMemo, useState } from 'react';
import { goalsApi, type GoalDto } from '@/features/goals/api/goals.api';
import { useAppModalStore } from '@/features/modals/model/appModal.store';
import { FinaCommandBar } from '@/features/fina/ui/FinaCommandBar';
import { ScreenTopBar } from '@/shared/ui/ScreenTopBar';
import { EmptyState } from '@/shared/ui/EmptyState';
import { formatMoney } from '@/shared/lib/money';
import { useI18n } from '@/shared/lib/i18n';

function clampProgress(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

export default function GoalsPage() {
  const { t } = useI18n();
  const [goals, setGoals] = useState<GoalDto[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const openModal = useAppModalStore((state) => state.openModal);

  const loadGoals = async () => {
    setIsLoading(true);
    setError(null);
    try {
      setGoals(await goalsApi.list());
    } catch (error) {
      console.error(error);
      setError(error instanceof Error ? error.message : 'Цели не загрузились');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { void loadGoals(); }, []);

  const activeGoals = useMemo(() => goals.filter((goal) => goal.status !== 'archived'), [goals]);
  const totals = useMemo(() => activeGoals.reduce((acc, goal) => {
    acc.current += Number(goal.currentAmount) || 0;
    acc.target += Number(goal.targetAmount) || 0;
    return acc;
  }, { current: 0, target: 0 }), [activeGoals]);
  const totalProgress = clampProgress((totals.current / Math.max(totals.target, 1)) * 100);


  return (
    <div className="app-page app-goals-page text-white">
      <div className="app-page__inner space-y-4">
        <ScreenTopBar title="Цели" left="back" right={['notifications', 'home']} />

        <header className="app-card app-card--hero">
          <div className="app-eyebrow">Прогресс</div>
          <div className="app-goals-hero__top mt-3">
            <div className="min-w-0">
              <h1 className="app-hero-title">Цели</h1>
              <p className="app-hero-caption">Накопления, крупные покупки и понятный путь к ним.</p>
            </div>
            <button type="button" onClick={() => openModal({ type: 'goal-edit', onAfterSave: loadGoals })} className="app-primary-button shrink-0">+ Цель</button>
          </div>
          <div className="app-goals-summary">
            <div><strong>{activeGoals.length}</strong><small>активных</small></div>
            <div><strong>{totalProgress}%</strong><small>общий прогресс</small></div>
            <div><strong>{formatMoney(Math.max(totals.target - totals.current, 0), 'RUB')}</strong><small>осталось</small></div>
          </div>
        </header>

        <FinaCommandBar
          titleKey="goals.command.title"
          captionKey="goals.command.caption"
          placeholderKey="goals.command.placeholder"
          suggestions={[
            { key: 'goals.command.create', command: 'создай цель отпуск 120000 рублей' },
            { key: 'goals.command.plan', command: 'предложи план взносов для цели отпуск' },
            { key: 'goals.command.status', command: 'сколько осталось до цели отпуск' },
          ]}
        />

        {error ? <div className="app-error-box">{error}</div> : null}

        {isLoading ? (
          <div className="app-card p-5 text-sm text-white/55">Загружаю цели...</div>
        ) : activeGoals.length === 0 ? (
          <EmptyState
            eyebrow="Цели"
            title="Целей пока нет"
            description="Создай первую цель вручную или скажи Фине, что хочешь накопить."
            actionLabel="Создать цель"
            onAction={() => openModal({ type: 'goal-edit', onAfterSave: loadGoals })}
          />
        ) : (
          <div className="space-y-3">
            {activeGoals.map((goal) => {
              const progress = clampProgress(goal.progress ?? (goal.currentAmount / Math.max(goal.targetAmount, 1)) * 100);
              const left = Math.max((Number(goal.targetAmount) || 0) - (Number(goal.currentAmount) || 0), 0);
              return (
                <button key={goal.id} type="button" onClick={() => openModal({ type: 'goal-edit', goal, onAfterSave: loadGoals })} className="app-goal-card">
                  <div className="app-goal-card__head">
                    <div className="min-w-0">
                      <div className="app-goal-card__title">{goal.title}</div>
                      {goal.note ? <div className="app-goal-card__note">{goal.note}</div> : <div className="app-goal-card__note">Нажми, чтобы изменить цель или прогресс.</div>}
                    </div>
                    <div className="app-goal-card__money">{formatMoney(goal.targetAmount, goal.currency)}</div>
                  </div>
                  <div className="app-goal-progress"><span style={{ width: `${progress}%` }} /></div>
                  <div className="mt-2 flex justify-between gap-3 text-xs text-white/42">
                    <span>{formatMoney(goal.currentAmount, goal.currency)} собрано</span>
                    <span>{formatMoney(left, goal.currency)} осталось · {progress}%</span>
                  </div>
                  <div className="app-goal-card__account">
                    <span>{goal.account?.name ?? t('goals.account.autoCreated')}</span>
                    {Number(goal.autoSavePercent ?? 0) > 0 ? <strong>{t('goals.account.autoSave', { percent: goal.autoSavePercent ?? 0 })}</strong> : <strong>{t('goals.account.manual')}</strong>}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}
