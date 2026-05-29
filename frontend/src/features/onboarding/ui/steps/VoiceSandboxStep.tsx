import type { OnboardingDraft } from '@/features/onboarding/model/onboarding.types';
import { OnboardingStepShell } from '@/features/onboarding/ui/OnboardingStepShell';

export function VoiceSandboxStep({ draft, onChange }: { draft: OnboardingDraft; onChange: (draft: OnboardingDraft) => void }) {
  const voice = draft.voice;
  const patchVoice = (patch: Partial<typeof voice>) => onChange({ ...draft, voice: { ...voice, ...patch } });

  return (
    <OnboardingStepShell
      eyebrow="Проверка"
      title="Проверь голос без реальных операций"
      description="Этот шаг ничего не создаёт. Он нужен, чтобы понять механику: Фина слушает команду, показывает текст и только потом готовит действие."
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
        <strong>Фина, тест</strong>
        <small>Позже здесь подключим безопасную проверку микрофона без записи финансового действия.</small>
      </div>
    </OnboardingStepShell>
  );
}
