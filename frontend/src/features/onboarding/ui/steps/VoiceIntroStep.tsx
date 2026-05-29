import { OnboardingStepShell } from '@/features/onboarding/ui/OnboardingStepShell';

const examples = [
  'Фина, кофе 300 с налички',
  'Фина, у меня есть 20000 на карте',
  'Фина, создай цель отпуск 120000',
];

export function VoiceIntroStep() {
  return (
    <OnboardingStepShell
      eyebrow="Голос"
      title="Говори обычными словами"
      description="Фина реагирует на своё имя, показывает понятное действие и просит уточнение, если чего-то не хватает."
    >
      <div className="onboarding-voice-card">
        <div className="onboarding-voice-card__pulse" />
        <div>
          <strong>Сначала имя, потом команда</strong>
          <span>Так приложение не будет реагировать на посторонние слова.</span>
        </div>
      </div>

      <div className="onboarding-example-list">
        {examples.map((example) => (
          <div key={example} className="onboarding-example-item">
            <span>{example}</span>
            <small>Фина подготовит действие, ты проверишь результат</small>
          </div>
        ))}
      </div>
    </OnboardingStepShell>
  );
}
