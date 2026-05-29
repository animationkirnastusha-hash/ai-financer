import type { OnboardingDraft } from '@/features/onboarding/model/onboarding.types';
import { OnboardingChoice, OnboardingStepShell } from '@/features/onboarding/ui/OnboardingStepShell';

const presets = ['Подушка безопасности', 'Отпуск', 'Ноутбук', 'Погасить кредит быстрее'];

export function GoalsStep({ draft, onChange }: { draft: OnboardingDraft; onChange: (draft: OnboardingDraft) => void }) {
  const goal = draft.goal;
  const patchGoal = (patch: Partial<typeof goal>) => onChange({ ...draft, goal: { ...goal, ...patch } });

  return (
    <OnboardingStepShell
      eyebrow="Цели"
      title="Добавим первую цель?"
      description="Цели помогают видеть, зачем ты экономишь и сколько осталось до результата."
    >
      <div className="onboarding-choice-grid two">
        <OnboardingChoice active={goal.enabled} title="Добавить цель" caption="Можно изменить позже" onClick={() => patchGoal({ enabled: true })} />
        <OnboardingChoice active={!goal.enabled} title="Пропустить" caption="Вернёшься позже" onClick={() => patchGoal({ enabled: false })} />
      </div>

      {goal.enabled ? (
        <div className="onboarding-form-card">
          <div className="onboarding-chip-row">
            {presets.map((preset) => (
              <button key={preset} type="button" className="onboarding-chip" onClick={() => patchGoal({ title: preset })}>
                {preset}
              </button>
            ))}
          </div>

          <label className="onboarding-field">
            <span>Название цели</span>
            <input value={goal.title} onChange={(event) => patchGoal({ title: event.target.value })} />
          </label>

          <label className="onboarding-field">
            <span>Сколько нужно накопить</span>
            <input type="number" min="0" inputMode="decimal" value={goal.targetAmount} onChange={(event) => patchGoal({ targetAmount: Number(event.target.value) || 0 })} />
          </label>
        </div>
      ) : null}
    </OnboardingStepShell>
  );
}
