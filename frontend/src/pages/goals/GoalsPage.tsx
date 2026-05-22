import { useEffect, useMemo, useState } from 'react';
import { goalsApi, type GoalDto } from '@/features/goals/api/goals.api';
import { GoalEditSheet } from '@/features/goals/ui/GoalEditSheet';
import { useNavigationStore } from '@/features/navigation/model/navigation.store';
import { ScreenTopBar } from '@/shared/ui/ScreenTopBar';
import { EmptyState } from '@/shared/ui/EmptyState';
import { formatMoney } from '@/shared/lib/money';

function clampProgress(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

export default function GoalsPage() {
  const openAIWithCommand = useNavigationStore((state) => state.openAIWithCommand);
  const [goals, setGoals] = useState<GoalDto[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sheet, setSheet] = useState<{ mode: 'create' } | { mode: 'edit'; goal: GoalDto } | null>(null);

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

  useEffect(() => {
    void loadGoals();
  }, []);

  const activeGoals = useMemo(() => goals.filter((goal) => goal.status !== 'archived'), [goals]);

  const saveGoal = async (payload: { title: string; targetAmount: number; currentAmount?: number; currency?: string; note?: string | null }) => {
    setIsSaving(true);
    try {
      if (sheet?.mode === 'edit') await goalsApi.update(sheet.goal.id, payload);
      else await goalsApi.create(payload);
      await loadGoals();
    } finally {
      setIsSaving(false);
    }
  };

  const deleteGoal = async (goal: GoalDto) => {
    setIsSaving(true);
    try {
      await goalsApi.delete(goal.id);
      await loadGoals();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="app-page text-white">
      <div className="app-page__inner space-y-4">
        <ScreenTopBar title="Цели" left="back" right={['home']} />

        <header className="app-card app-card--hero">
          <div className="app-eyebrow">Прогресс</div>
          <div className="mt-3 flex items-end justify-between gap-4">
            <div>
              <h1 className="text-[32px] font-semibold leading-none tracking-[-0.055em]">Цели</h1>
              <p className="mt-2 text-sm text-white/46">Крупные покупки и накопления.</p>
            </div>
            <button type="button" onClick={() => setSheet({ mode: 'create' })} className="app-primary-button shrink-0">+ Цель</button>
          </div>
        </header>

        <button type="button" onClick={() => openAIWithCommand('создай цель ноутбук 120000')} className="app-card w-full p-4 text-left active:scale-[0.99]">
          <div className="text-sm font-semibold text-white">Создать голосом</div>
          <div className="mt-1 text-xs text-white/42">Например: “создай цель ноутбук 120000”.</div>
        </button>

        {error ? <div className="app-error-box">{error}</div> : null}

        {isLoading ? (
          <div className="app-card p-5 text-sm text-white/55">Загружаю цели...</div>
        ) : activeGoals.length === 0 ? (
          <EmptyState
            eyebrow="Цели"
            title="Целей пока нет"
            description="Создай первую цель вручную или скажи AI: “создай цель отпуск 120000”."
            actionLabel="Создать цель"
            onAction={() => setSheet({ mode: 'create' })}
          />
        ) : (
          <div className="space-y-3">
            {activeGoals.map((goal) => {
              const progress = clampProgress(goal.progress ?? (goal.currentAmount / Math.max(goal.targetAmount, 1)) * 100);
              return (
                <button key={goal.id} type="button" onClick={() => setSheet({ mode: 'edit', goal })} className="app-card w-full p-5 text-left active:scale-[0.99]">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-lg font-semibold text-white">{goal.title}</div>
                      {goal.note ? <div className="mt-1 line-clamp-1 text-sm text-white/42">{goal.note}</div> : null}
                    </div>
                    <div className="shrink-0 text-right text-sm text-emerald-100/85">
                      {formatMoney(goal.targetAmount, goal.currency)}
                    </div>
                  </div>
                  <div className="mt-4 h-2 rounded-full bg-white/8">
                    <div className="h-2 rounded-full bg-emerald-200/70" style={{ width: `${progress}%` }} />
                  </div>
                  <div className="mt-2 flex justify-between text-xs text-white/42">
                    <span>{formatMoney(goal.currentAmount, goal.currency)}</span>
                    <span>{progress}%</span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <GoalEditSheet
        open={!!sheet}
        goal={sheet?.mode === 'edit' ? sheet.goal : null}
        isSaving={isSaving}
        onClose={() => setSheet(null)}
        onSave={saveGoal}
        onDelete={deleteGoal}
      />
    </div>
  );
}
