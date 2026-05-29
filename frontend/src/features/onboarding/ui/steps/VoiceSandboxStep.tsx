import type { OnboardingDraft } from '@/features/onboarding/model/onboarding.types';
import { OnboardingStepShell } from '@/features/onboarding/ui/OnboardingStepShell';

export function VoiceSandboxStep({ draft, onChange }: { draft: OnboardingDraft; onChange: (draft: OnboardingDraft) => void }) {
  const voice = draft.voice;
  const patchVoice = (patch: Partial<typeof voice>) => onChange({ ...draft, voice: { ...voice, ...patch } });

  return (
    <OnboardingStepShell
      eyebrow="Проверка"
      title="Проверь, как работает голос"
      description="Здесь ты спокойно потренируешься: зажми Фину, скажи короткую фразу и отпусти. Финансовые действия появятся только после подтверждения."
    >
      <div className="onboarding-form-card">
        <label className="onboarding-check-row wide">
          <input type="checkbox" checked={voice.voiceEnabled} onChange={(event) => patchVoice({ voiceEnabled: event.target.checked })} />
          <span>Использовать голосовой ввод</span>
        </label>
        <label className="onboarding-check-row wide">
          <input type="checkbox" checked={voice.textFallbackEnabled} onChange={(event) => patchVoice({ textFallbackEnabled: event.target.checked })} />
          <span>Оставить текстовый ввод как запасной вариант</span>
        </label>
      </div>

      <div className="onboarding-test-box">
        <span>Тестовая фраза</span>
        <strong>создай счёт Наличка</strong>
        <small>Это тренировочный пример. На следующем шаге создадим настоящие счета.</small>
      </div>
    </OnboardingStepShell>
  );
}
