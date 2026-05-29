import type { OnboardingDraft, OnboardingReminderTiming } from '@/features/onboarding/model/onboarding.types';
import { OnboardingStepShell } from '@/features/onboarding/ui/OnboardingStepShell';

const timings: Array<{ id: OnboardingReminderTiming; title: string }> = [
  { id: 'same_day', title: 'В день события' },
  { id: 'one_day', title: 'За 1 день' },
  { id: 'three_days', title: 'За 3 дня' },
  { id: 'off', title: 'Не напоминать' },
];

export function RemindersStep({ draft, onChange }: { draft: OnboardingDraft; onChange: (draft: OnboardingDraft) => void }) {
  const reminders = draft.reminders;
  const patchReminders = (patch: Partial<typeof reminders>) => onChange({ ...draft, reminders: { ...reminders, ...patch } });

  return (
    <OnboardingStepShell
      eyebrow="Напоминания"
      title="Когда напоминать о важном?"
      description="Настрой базовое поведение. Потом можно будет менять напоминания отдельно для целей, кредитов и регулярных расходов."
    >
      <div className="onboarding-chip-row">
        {timings.map((timing) => (
          <button
            key={timing.id}
            type="button"
            className={`onboarding-chip ${reminders.timing === timing.id ? 'is-active' : ''}`}
            onClick={() => patchReminders({ timing: timing.id })}
          >
            {timing.title}
          </button>
        ))}
      </div>

      <div className="onboarding-form-card">
        {([
          ['creditPayments', 'Кредиты и рассрочки'],
          ['goals', 'Цели'],
          ['regularExpenses', 'Регулярные расходы'],
          ['weeklySummary', 'Недельный финансовый итог'],
        ] as const).map(([key, label]) => (
          <label key={key} className="onboarding-check-row wide">
            <input
              type="checkbox"
              checked={reminders[key]}
              onChange={(event) => patchReminders({ [key]: event.target.checked })}
              disabled={reminders.timing === 'off'}
            />
            <span>{label}</span>
          </label>
        ))}
      </div>
    </OnboardingStepShell>
  );
}
